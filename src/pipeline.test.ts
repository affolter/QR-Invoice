import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { convertInvoicePdf } from "./pipeline.js";
import { buildSwissQrPayload } from "./parser/qr-payload-fixtures.js";

async function writeSyntheticInvoice(path: string, payload: string): Promise<void> {
  const png = await QRCode.toBuffer(payload, {
    errorCorrectionLevel: "M",
    margin: 4,
    width: 400,
    type: "png",
  });
  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ size: "A4" });
  const pdfBytes = await new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.image(png, 50, 50, { width: 200 });
    doc.end();
  });
  await writeFile(path, pdfBytes);
}

describe("convertInvoicePdf", () => {
  it("runs extract → parse → normalize → validate → generate", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qr-invoice-cli-"));
    const input = join(dir, "old-invoice.pdf");
    const output = join(dir, "new-invoice.pdf");
    await writeSyntheticInvoice(input, buildSwissQrPayload());
    const result = await convertInvoicePdf(input, { outputPath: output });
    expect(result.validation.valid).toBe(true);
    expect(result.outputPath).toBe(output);
  });
});
