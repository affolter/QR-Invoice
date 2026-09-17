import { describe, expect, it } from "vitest";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { extractQrFromPdf } from "./extractQrFromPdf.js";
import { buildSwissQrPayload } from "./qr-payload-fixtures.js";

async function pdfWithEmbeddedQr(payload: string): Promise<Uint8Array> {
  const png = await QRCode.toBuffer(payload, {
    errorCorrectionLevel: "M",
    margin: 4,
    width: 400,
    type: "png",
  });

  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ size: "A4" });
  const done = new Promise<Uint8Array>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    doc.on("error", reject);
  });
  doc.image(png, 50, 50, { width: 200 });
  doc.end();
  return done;
}

describe("extractQrFromPdf", () => {
  it("decodes a Swiss QR payload from an embedded PNG", async () => {
    const payload = buildSwissQrPayload();
    const pdf = await pdfWithEmbeddedQr(payload);
    const result = await extractQrFromPdf(pdf);
    expect(result.method).toBe("embedded-image");
    expect(result.payload?.replace(/\r\n/g, "\n")).toBe(payload);
  });
});
