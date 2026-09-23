/** @import { InvoiceData, ParsedInvoice, ReviewField } from "./models.js" */
/** @import { EitherType } from "./either.js" */
/** @import { ValidationResult } from "./validate.js" */

import { left, right } from "./either.js";
import { extractSwissQrPayload, parseQrPayload } from "./parse.js";
import { normalizeInvoice } from "./normalize.js";
import { validateInvoice } from "./validate.js";
import { buildQrPayload } from "./build.js";

/**
 * @param   { Uint8Array | ArrayBuffer | string } input
 * @returns { Uint8Array }
 * @pure
 */
export const asBytes = input =>
  typeof input === "string"
    ? new TextEncoder().encode(input)
    : input instanceof Uint8Array
      ? input
      : new Uint8Array(input);

/**
 * @param   { Uint8Array } bytes
 * @returns { boolean }
 * @pure
 */
export const isPdf = bytes =>
  bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;

/**
 * @typedef { {
 *   rawQr:       string,
 *   parsed:      ParsedInvoice,
 *   invoice:     InvoiceData | null,
 *   review:      ReviewField[],
 *   validation:  ValidationResult,
 *   bytes?:      Uint8Array,
 *   mediaType?:  "application/pdf" | "text/plain;charset=utf-8",
 * } } Converted
 *
 * @typedef { {
 *   acceptReview?: boolean,
 *   strict?:       boolean,
 *   output?:       "pdf" | "spc" | "auto",
 * } } ConvertInputOptions
 */

/**
 * Single write policy. The webpage calls this before offering a download.
 * @param   { Pick<Converted, "validation" | "review" | "invoice"> } result
 * @param   { Pick<ConvertInputOptions, "acceptReview" | "strict"> } options
 * @returns { EitherType<string, InvoiceData> }
 * @pure
 */
export const canWrite = (result, options) => {
  if (!result.invoice || !result.validation.valid) {
    return left("This QR-bill cannot be written. IBAN, amount, currency and reference were not modified.");
  }
  if (result.review.length > 0 && !options.acceptReview) {
    return left("Address fields need review before writing. In the page, edit them and accept. In the CLI, pass --accept-review only if you accept the inferred values.");
  }
  if (options.strict && result.validation.issues.some(issue => issue.severity === "warning")) {
    return left("Writing blocked by --strict (warnings present).");
  }
  return right(result.invoice);
};

/**
 * Parse + normalize + validate. No output bytes yet.
 * @param   { string } rawQr
 * @returns { EitherType<string, Converted> }
 * @pure
 */
export const analyze = rawQr => {
  const parsed = parseQrPayload(rawQr);
  if (!parsed.ok) return parsed;
  const normalized = normalizeInvoice(parsed.value);
  return right({
    rawQr,
    parsed:     normalized.parsed,
    invoice:    normalized.invoice,
    review:     normalized.review,
    validation: validateInvoice(normalized.invoice),
  });
};

/**
 * Text convert. PDF bytes belong in src/pdf.
 *
 * @param   { Uint8Array | ArrayBuffer | string } input
 * @param   { ConvertInputOptions }               [options]
 * @returns { Promise<EitherType<string, Converted>> }
 */
export const convert = async (input, options = {}) => {
  const bytes = asBytes(input);
  if (isPdf(bytes)) return left("PDF input needs the PDF converter.");
  const extracted = extractSwissQrPayload(new TextDecoder().decode(bytes));
  if (!extracted.ok) return extracted;
  const analyzed = analyze(extracted.value);
  if (!analyzed.ok) return analyzed;
  const result = analyzed.value;
  const gate   = canWrite(result, options);
  if (!gate.ok) return right(result);
  return right({
    ...result,
    bytes:     new TextEncoder().encode(buildQrPayload(gate.value)),
    mediaType: "text/plain;charset=utf-8",
  });
};
