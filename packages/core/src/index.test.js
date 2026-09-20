import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const srcDir = dirname(fileURLToPath(import.meta.url));
const banned = /["'](?:pdfjs-dist|pdf-lib|jsqr|qrcode|node:)/;

/**
 * @param { string } file
 * @param { Set<string> } [seen]
 */
function walk(file, seen = new Set()) {
  const path = join(srcDir, file);
  if (seen.has(path)) return seen;
  seen.add(path);
  const text = readFileSync(path, "utf8");
  assert.equal(banned.test(text), false, `${file} must not import PDF packages or Node builtins`);
  for (const match of text.matchAll(/from ["'](\.\/[^"']+)["']/g)) {
    const spec = match[1];
    if (spec?.endsWith(".js")) walk(spec.slice(2), seen);
  }
  return seen;
}

describe("core entry", () => {
  it("does not import PDF packages or Node builtins", () => {
    const seen = walk("index.js");
    assert.ok(seen.has(join(srcDir, "backend.js")));
    assert.ok(seen.has(join(srcDir, "pdfMagic.js")));
  });
});
