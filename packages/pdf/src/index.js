/** @import { ConvertInputOptions, Converted } from "@qr-invoice/core" */
/** @import { EitherType } from "@qr-invoice/core" */

import { analyze, buildQrPayload, canWrite, extractSwissQrPayload, isPdf, left, right } from "@qr-invoice/core";
import { extractSwissQrFromPdf } from "./pdfQr.js";
import { buildInvoicePdf } from "./pdfWrite.js";

export { isPdf, canWrite };
export { extractSwissQrFromPdf } from "./pdfQr.js";
export { buildInvoicePdf, swissQrPng } from "./pdfWrite.js";

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

  const wantPdf = options.output === "pdf" || (options.output !== "spc" && Boolean(originalPdf));
  try {
    if (wantPdf) {
      result.bytes = await buildInvoicePdf(gate.value, { originalPdf, qrBox });
      result.mediaType = "application/pdf";
    } else {
      result.bytes = new TextEncoder().encode(buildQrPayload(gate.value));
      result.mediaType = "text/plain;charset=utf-8";
    }
  } catch (error) {
    return left(error instanceof Error ? error.message : String(error));
  }
  return right(result);
}
