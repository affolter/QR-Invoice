import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { canWrite, convertInvoiceFile, convertQrPayload } from "./pipeline.js";
import { buildSwissQrPayload } from "./parser/qr-payload-fixtures.js";

describe("convertQrPayload", () => {
  it("writes a normalized SPC file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qr-invoice-"));
    const outputPath = join(dir, "new-payload.txt");
    const result = await convertQrPayload(buildSwissQrPayload(), { outputPath });
    assert.equal(result.validation.valid, true);
    assert.equal(canWrite(result, {}).ok, true);
    assert.equal(result.outputPath, outputPath);
    const written = await readFile(outputPath, "utf8");
    assert.match(written, /^SPC\n/);
    assert.match(written, /\nEPD\n/);
  });
});

describe("convertInvoiceFile", () => {
  it("reads SPC text wrapped in junk bytes without a PDF library", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qr-invoice-file-"));
    const input = join(dir, "old.txt");
    const output = join(dir, "new.txt");
    await writeFile(input, `header\n${buildSwissQrPayload()}\ntrailer\n`, "utf8");
    const result = await convertInvoiceFile(input, { outputPath: output });
    assert.equal(result.validation.valid, true);
    assert.equal(result.outputPath, output);
  });
});
