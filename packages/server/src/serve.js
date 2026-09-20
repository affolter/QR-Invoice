/**
 * Optional static file server plus a tiny JSON API.
 * Never loads PDF libraries, never stores invoices, never logs IBAN or addresses.
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { handleApi } from "./api.js";

/**
 * @param { string } file
 * @returns { string }
 * @pure
 */
function contentType(file) {
  const ext = extname(file);
  if (ext === ".css") return "text/css;charset=utf-8";
  if (ext === ".html") return "text/html;charset=utf-8";
  if (ext === ".js") return "text/javascript;charset=utf-8";
  if (ext === ".json" || ext === ".map") return "application/json;charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".woff2") return "font/woff2";
  return "application/octet-stream";
}

/**
 * @param { string } dist
 * @param { string } urlPath
 * @returns { string | null }
 * @pure
 */
export function fileFromUrl(dist, urlPath) {
  const raw = urlPath.split("?")[0] ?? "/";
  let decoded;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const target = resolve(join(dist, relative));
  const root = resolve(dist);
  if (target !== root && !target.startsWith(root + "/")) return null;
  return target;
}

/**
 * @param { { dist: string, host?: string, port?: number } } options
 * @returns { import("node:http").Server }
 */
export function serveStatic(options) {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 43188;
  const server = createServer((req, res) => {
    void handle(options.dist, req, res);
  });
  server.listen(port, host, () => {
    console.log(`UI+JSON API http://${host}:${port} — convert stays in the browser`);
  });
  return server;
}

/**
 * @param { string } dist
 * @param { import("node:http").IncomingMessage } req
 * @param { import("node:http").ServerResponse } res
 */
async function handle(dist, req, res) {
  if (await handleApi(req, res)) return;
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    res.end();
    return;
  }
  const path = fileFromUrl(dist, req.url ?? "/");
  if (!path) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  try {
    let file = path;
    const info = await stat(file);
    if (info.isDirectory()) file = join(file, "index.html");
    res.writeHead(200, { "content-type": contentType(file) });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(resolve(entry)).href) {
  const dist = resolve(join(dirname(fileURLToPath(import.meta.url)), "../../../dist"));
  serveStatic({ dist, port: Number(process.env.PORT) || 43188 });
}
