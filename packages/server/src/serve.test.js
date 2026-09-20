import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { QR_IBAN } from "../../core/src/fixtures.js";
import { asInvoiceData, BODY_LIMIT, handleApi } from "./api.js";
import { fileFromUrl } from "./serve.js";

const here = dirname(fileURLToPath(import.meta.url));

/** @returns { import("../../core/src/models.js").InvoiceData } */
function sampleInvoice() {
  return {
    qrType: "SPC",
    qrVersion: "0200",
    account: QR_IBAN,
    currency: "CHF",
    amount: 1949.75,
    referenceType: "QRR",
    reference: "210000000003139471430009017",
    creditor: {
      name: "Robert Schneider AG",
      account: QR_IBAN,
      street: "Rue du Lac",
      buildingNumber: "1268",
      postalCode: "2501",
      city: "Biel",
      country: "CH",
    },
  };
}

/**
 * @param { string } method
 * @param { string } url
 * @param { string } [body]
 * @param { Record<string, string> } [headers]
 * @returns { Promise<{ status: number, body: string }> }
 */
function request(method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      void handleApi(req, res);
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("no port"));
        return;
      }
      const payload = body === undefined ? undefined : Buffer.from(body);
      const sent = httpRequest(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          method,
          path: url,
          headers: { "content-length": String(payload?.length ?? 0), ...headers },
        },
        res => {
          /** @type { Buffer[] } */
          const chunks = [];
          res.on("data", c => chunks.push(c));
          res.on("end", () => {
            server.close();
            resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") });
          });
        },
      );
      sent.on("error", err => {
        server.close();
        reject(err);
      });
      sent.end(payload);
    });
  });
}

describe("optional static server", () => {
  it("does not import PDF libraries or convert()", () => {
    const text = readFileSync(join(here, "serve.js"), "utf8") + readFileSync(join(here, "api.js"), "utf8");
    assert.equal(/pdfjs-dist|pdf-lib|jsqr|qrcode|@qr-invoice\/pdf|convert\(/.test(text), false);
  });

  it("maps / to index.html and rejects path traversal", () => {
    const dist = "/tmp/qr-invoice-dist";
    assert.equal(fileFromUrl(dist, "/"), join(dist, "index.html"));
    assert.equal(fileFromUrl(dist, "/assets/app.js"), join(dist, "assets/app.js"));
    assert.equal(fileFromUrl(dist, "/../secret"), null);
  });
});

describe("JSON API", () => {
  it("serves health and capabilities without PDF", async () => {
    const health = await request("GET", "/api/health");
    assert.equal(health.status, 200);
    assert.equal(JSON.parse(health.body).ok, true);
    const caps = await request("GET", "/api/capabilities");
    assert.deepEqual(JSON.parse(caps.body), {
      validate: true,
      convert: false,
      pdf: false,
      images: false,
      storage: false,
    });
  });

  it("validates InvoiceData JSON and rejects PDF / oversized bodies", async () => {
    const ok = await request("POST", "/api/validate", JSON.stringify(sampleInvoice()), {
      "content-type": "application/json",
    });
    assert.equal(ok.status, 200);
    assert.equal(JSON.parse(ok.body).valid, true);

    const pdf = await request("POST", "/api/validate", "%PDF-1.4", { "content-type": "application/json" });
    assert.equal(pdf.status, 415);

    const huge = "x".repeat(BODY_LIMIT + 8);
    const tooBig = await request("POST", "/api/validate", huge, { "content-type": "application/json" });
    assert.equal(tooBig.status, 413);

    assert.equal(asInvoiceData({ account: QR_IBAN, bytes: [1] }), null);
  });

  it("does not log IBAN or address fields", () => {
    const text = readFileSync(join(here, "api.js"), "utf8");
    assert.equal(/console\.(log|info|debug|error)\([^)]*(iban|account|street|address)/i.test(text), false);
    assert.equal(/console\.(log|info|debug)\(/.test(text), false);
  });
});
