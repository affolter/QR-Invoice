/** @import { InvoiceData } from "@qr-invoice/core" */
/** @import { IncomingMessage, ServerResponse } from "node:http" */

import { validateInvoice } from "@qr-invoice/core";

export const BODY_LIMIT = 32 * 1024;

const CAPABILITIES = {
  validate: true,
  convert: false,
  pdf: false,
  images: false,
  storage: false,
};

/**
 * @param { IncomingMessage } req
 * @param { ServerResponse } res
 * @returns { Promise<boolean> } true if this was an API route
 */
export async function handleApi(req, res) {
  const path = (req.url ?? "/").split("?")[0];
  if (!path?.startsWith("/api/")) return false;
  cors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }
  try {
    if (req.method === "GET" && path === "/api/health") {
      json(res, 200, { ok: true });
      return true;
    }
    if (req.method === "GET" && path === "/api/capabilities") {
      json(res, 200, CAPABILITIES);
      return true;
    }
    if (req.method === "POST" && path === "/api/validate") {
      await validateRoute(req, res);
      return true;
    }
    json(res, 404, { ok: false, error: "Not found" });
  } catch (error) {
    const status = error instanceof Error && error.message === "too large" ? 413 : 400;
    json(res, status, { ok: false, error: "Bad request" });
  }
  return true;
}

/**
 * @param { IncomingMessage } req
 * @param { ServerResponse } res
 */
async function validateRoute(req, res) {
  const type = String(req.headers["content-type"] ?? "");
  if (!type.includes("application/json")) {
    json(res, 415, { ok: false, error: "JSON InvoiceData required" });
    return;
  }
  const raw = await readLimited(req, BODY_LIMIT);
  if (raw.length >= 4 && raw[0] === 0x25 && raw[1] === 0x50 && raw[2] === 0x44 && raw[3] === 0x46) {
    json(res, 415, { ok: false, error: "PDF is not accepted" });
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    json(res, 400, { ok: false, error: "JSON InvoiceData required" });
    return;
  }
  const invoice = asInvoiceData(parsed);
  if (!invoice) {
    json(res, 400, { ok: false, error: "JSON InvoiceData required" });
    return;
  }
  json(res, 200, validateInvoice(invoice));
}

/**
 * Accepts InvoiceData JSON only. Rejects bytes, files, and image payloads.
 * @param { unknown } value
 * @returns { InvoiceData | null }
 */
export function asInvoiceData(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = /** @type { Record<string, unknown> } */ (value);
  if ("bytes" in row || "pdf" in row || "image" in row || "file" in row) return null;
  if (typeof row.account !== "string" || typeof row.currency !== "string" || typeof row.referenceType !== "string") {
    return null;
  }
  if (!row.creditor || typeof row.creditor !== "object") return null;
  return /** @type { InvoiceData } */ (value);
}

/**
 * @param { IncomingMessage } req
 * @param { number } limit
 * @returns { Promise<Uint8Array> }
 */
function readLimited(req, limit) {
  return new Promise((resolve, reject) => {
    /** @type { Buffer[] } */
    const chunks = [];
    let size = 0;
let settled = false;
    req.on("data", chunk => {
      if (settled) return;
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buf.length;
      if (size > limit) {
        settled = true;
        req.pause();
        reject(new Error("too large"));
        return;
      }
      chunks.push(buf);
    });
    req.on("end", () => {
      if (settled) return;
      settled = true;
      resolve(new Uint8Array(Buffer.concat(chunks)));
    });
    req.on("error", reject);
  });
}

/**
 * @param { ServerResponse } res
 */
function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
}

/**
 * @param { ServerResponse } res
 * @param { number } status
 * @param { object } body
 */
function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json;charset=utf-8" });
  res.end(JSON.stringify(body));
}
