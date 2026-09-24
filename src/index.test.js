import { TestSuite } from "../kolibri/util/test.js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const srcDir = dirname(fileURLToPath(import.meta.url));
const banned = /["'](?:pdfjs-dist|pdf-lib|jsqr|qrcode|node:)/;

/**
 * @param { string } file
 * @param { Set<string> } [seen]
 */
const walk = (file, seen = new Set()) => {
  const path = join(srcDir, file);
  if (seen.has(path)) return seen;
  seen.add(path);
  const text = readFileSync(path, "utf8");
  if (banned.test(text)) {
    throw new Error(`${file} must not import PDF packages or Node builtins`);
  }
  for (const match of text.matchAll(/from ["'](\.\/[^"']+)["']/g)) {
    const spec = match[1];
    if (spec?.endsWith(".js")) walk(spec.slice(2), seen);
  }
  return seen;
};

const suite = TestSuite("core entry");

suite.add("does not import PDF packages or Node builtins", assert => {
  const seen = walk("index.js");
  assert.isTrue(seen.has(join(srcDir, "convert.js")));
  assert.isTrue(seen.has(join(srcDir, "review.js")));
});

suite.run();
