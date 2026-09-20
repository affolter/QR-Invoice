import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { fileFromUrl } from "./serve.js";

const here = dirname(fileURLToPath(import.meta.url));

describe("optional static server", () => {
  it("does not import PDF libraries or convert()", () => {
    const text = readFileSync(join(here, "serve.js"), "utf8");
    assert.equal(/pdfjs-dist|pdf-lib|jsqr|qrcode|@qr-invoice\/pdf|convert\(/.test(text), false);
  });

  it("maps / to index.html and rejects path traversal", () => {
    const dist = "/tmp/qr-invoice-dist";
    assert.equal(fileFromUrl(dist, "/"), join(dist, "index.html"));
    assert.equal(fileFromUrl(dist, "/assets/app.js"), join(dist, "assets/app.js"));
    assert.equal(fileFromUrl(dist, "/../secret"), null);
  });
});
