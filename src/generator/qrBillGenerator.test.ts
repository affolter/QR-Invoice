import { describe, expect, it } from "vitest";
import { convertQrPayload } from "../pipeline.js";
import { SwissQrBillGenerator } from "./qrBillGenerator.js";
import { parseQrPayload } from "../parser/qrParser.js";
import { buildSwissQrPayload } from "../parser/qr-payload-fixtures.js";
import { normalizeInvoice } from "../normalizer/invoiceNormalizer.js";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("SwissQrBillGenerator", () => {
  it("wraps swissqrbill and writes a PDF", async () => {
    const parsed = parseQrPayload(buildSwissQrPayload());
    const { invoice } = normalizeInvoice(parsed);
    expect(invoice).not.toBeNull();
    const bytes = await new SwissQrBillGenerator().generate(invoice!);
    const header = Buffer.from(bytes.subarray(0, 5)).toString("ascii");
    expect(header).toBe("%PDF-");
  });
});

describe("convertQrPayload", () => {
  it("writes an output PDF from a synthetic payload", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qr-invoice-"));
    const outputPath = join(dir, "new-invoice.pdf");
    const result = await convertQrPayload(buildSwissQrPayload(), { outputPath });
    expect(result.validation.valid).toBe(true);
    expect(result.outputPath).toBe(outputPath);
    const written = await readFile(outputPath);
    expect(written.subarray(0, 4).toString()).toBe("%PDF");
  });
});
