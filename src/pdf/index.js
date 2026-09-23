/** @import { ConvertInputOptions, Converted, EitherType, InvoiceData } from "../index.js" */

import { analyze, asBytes, buildQrPayload, canWrite, extractSwissQrPayload, isPdf, left, right } from "../index.js";
import { extractSwissQrFromPdf } from "./qr.js";
import { buildInvoicePdf } from "./write.js";

export { extractSwissQrFromPdf } from "./qr.js";
export { swissQrPng } from "./write.js";

/**
 * Emit SPC or PDF bytes from already-reviewed InvoiceData. Re-extracts the QR box if needed.
 *
 * @param   { InvoiceData } invoice
 * @param   { {
 *   output?:      "pdf" | "spc" | "auto",
 *   originalPdf?: Uint8Array,
 *   qrBox?:       import("./qr.js").QrBox,
 * } } [options]
 * @returns { Promise<EitherType<string, { bytes: Uint8Array, mediaType: "application/pdf" | "text/plain;charset=utf-8" }>> }
 */
export const writeInvoice = async (invoice, options = {}) => {
  try {
    /** @type { import("./qr.js").QrBox | undefined } */
    let qrBox = options.qrBox;
    const originalPdf = options.originalPdf;
    const wantPdf = options.output === "pdf" || (options.output !== "spc" && Boolean(originalPdf));
    if (wantPdf && originalPdf && !qrBox) {
      const qr = await extractSwissQrFromPdf(originalPdf);
      if (qr.ok) qrBox = qr.value.box;
    }
    if (wantPdf) {
      return right({
        bytes:     await buildInvoicePdf(invoice, { originalPdf, qrBox }),
        mediaType: "application/pdf",
      });
    }
    return right({
      bytes:     new TextEncoder().encode(buildQrPayload(invoice)),
      mediaType: "text/plain;charset=utf-8",
    });
  } catch (error) {
    return left(error instanceof Error ? error.message : String(error));
  }
};

/**
 * PDF-capable in-memory convert. Loads pdfjs / pdf-lib / jsqr / qrcode.
 *
 * @param   { Uint8Array | ArrayBuffer | string } input
 * @param   { ConvertInputOptions }               [options]
 * @returns { Promise<EitherType<string, Converted>> }
 */
export const convert = async (input, options = {}) => {
  const bytes = asBytes(input);

  /** @type { string } */
  let rawQr;
  /** @type { Uint8Array | undefined } */
  let originalPdf;
  /** @type { import("./qr.js").QrBox | undefined } */
  let qrBox;
  if (isPdf(bytes)) {
    const qr = await extractSwissQrFromPdf(bytes);
    if (!qr.ok) return qr;
    rawQr = qr.value.payload;
    originalPdf = bytes;
    qrBox = qr.value.box;
  } else {
    const extracted = extractSwissQrPayload(new TextDecoder().decode(bytes));
    if (!extracted.ok) return extracted;
    rawQr = extracted.value;
  }

  const analyzed = analyze(rawQr);
  if (!analyzed.ok) return analyzed;
  const result = analyzed.value;
  const gate = canWrite(result, options);
  if (!gate.ok) return right(result);

  const written = await writeInvoice(gate.value, { output: options.output, originalPdf, qrBox });
  if (!written.ok) return written;
  return right({
    ...result,
    bytes:     written.value.bytes,
    mediaType: written.value.mediaType,
  });
};
