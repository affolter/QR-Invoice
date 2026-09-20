/** @import { ConvertInputOptions, Converted } from "@qr-invoice/core" */
/** @import { EitherType } from "@qr-invoice/core" */

import { analyze, buildQrPayload, canWrite, extractSwissQrPayload, isPdf, left, right } from "@qr-invoice/core";
import { extractSwissQrFromPdf } from "./pdfQr.js";
import { buildInvoicePdf } from "./pdfWrite.js";

export { isPdf, canWrite };
export { extractSwissQrFromPdf } from "./pdfQr.js";
export { buildInvoicePdf, swissQrPng } from "./pdfWrite.js";

/**
 * Emit SPC or PDF bytes from already-reviewed InvoiceData. Re-extracts the QR box if needed.
 *
 * @param   { import("@qr-invoice/core").InvoiceData } invoice
 * @param   { {
 *   output?: "pdf" | "spc" | "auto",
 *   originalPdf?: Uint8Array,
 *   qrBox?: import("./pdfQr.js").QrBox,
 * } } [options]
 * @returns { Promise<EitherType<string, { bytes: Uint8Array, mediaType: "application/pdf" | "text/plain;charset=utf-8" }>> }
 */
export async function writeInvoice(invoice, options = {}) {
  try {
    /** @type { import("./pdfQr.js").QrBox | undefined } */
    let qrBox = options.qrBox;
    const originalPdf = options.originalPdf;
    const wantPdf = options.output === "pdf" || (options.output !== "spc" && Boolean(originalPdf));
    if (wantPdf && originalPdf && !qrBox) {
      const qr = await extractSwissQrFromPdf(originalPdf);
      if (qr.ok) qrBox = qr.value.box;
    }
    if (wantPdf) {
      return right({
        bytes: await buildInvoicePdf(invoice, { originalPdf, qrBox }),
        mediaType: "application/pdf",
      });
    }
    return right({
      bytes: new TextEncoder().encode(buildQrPayload(invoice)),
      mediaType: "text/plain;charset=utf-8",
    });
  } catch (error) {
    return left(error instanceof Error ? error.message : String(error));
  }
}

/**
 * PDF-capable in-memory convert. Loads pdfjs / pdf-lib / jsqr / qrcode.
 *
 * @param   { Uint8Array | ArrayBuffer | string } input
 * @param   { ConvertInputOptions }               [options]
 * @returns { Promise<EitherType<string, Converted>> }
 */
export async function convert(input, options = {}) {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : input instanceof Uint8Array
        ? input
        : new Uint8Array(input);

  /** @type { string } */
  let rawQr;
  /** @type { Uint8Array | undefined } */
  let originalPdf;
  /** @type { import("./pdfQr.js").QrBox | undefined } */
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
  result.bytes = written.value.bytes;
  result.mediaType = written.value.mediaType;
  return right(result);
}
