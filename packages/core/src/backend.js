/** @import { InvoiceData, ParsedInvoice, ReviewField } from "./models.js" */
/** @import { EitherType } from "./either.js" */
/** @import { ValidationResult } from "./validate.js" */

import { left, right } from "./either.js";
import { extractSwissQrPayload, parseQrPayload } from "./parse.js";
import { normalizeInvoice } from "./normalize.js";
import { validateInvoice } from "./validate.js";
import { buildQrPayload } from "./build.js";
import { isPdf } from "./pdfMagic.js";

/**
 * @typedef { {
 *   rawQr: string,
 *   parsed: ParsedInvoice,
 *   invoice: InvoiceData | null,
 *   review: ReviewField[],
 *   validation: ValidationResult,
 *   bytes?: Uint8Array,
 *   mediaType?: "application/pdf" | "text/plain;charset=utf-8",
 * } } Converted
 *
 * @typedef { {
 *   acceptReview?: boolean,
 *   strict?: boolean,
 *   output?: "pdf" | "spc" | "auto",
 * } } ConvertInputOptions
 */

/**
 * Single write policy. The webpage calls this before offering a download.
 * @param   { Pick<Converted, "validation" | "review" | "invoice"> } result
 * @param   { Pick<ConvertInputOptions, "acceptReview" | "strict"> } options
 * @returns { EitherType<string, InvoiceData> }
 * @pure
 */
export function canWrite(result, options) {
  if (!result.invoice || !result.validation.valid) {
    return left("Generation blocked by validation errors. IBAN, amount, currency and reference were not modified.");
  }
  if (result.review.length > 0 && !options.acceptReview) {
    return left("Generation blocked until ambiguous address fields are reviewed. Re-run with --accept-review only if you accept the inferred values.");
  }
  if (options.strict && result.validation.issues.some(issue => issue.severity === "warning")) {
    return left("Generation blocked by --strict (warnings present).");
  }
  return right(result.invoice);
}

/**
 * Parse + normalize + validate. No output bytes yet.
 * @param   { string } rawQr
 * @returns { EitherType<string, Converted> }
 * @pure
 */
export function analyze(rawQr) {
  const parsed = parseQrPayload(rawQr);
  if (!parsed.ok) return parsed;
  const normalized = normalizeInvoice(parsed.value);
  return right({
    rawQr,
    parsed: normalized.parsed,
    invoice: normalized.invoice,
    review: normalized.review,
    validation: validateInvoice(normalized.invoice),
  });
}

/**
 * In-memory SPC convert for a future UI. No HTTP. No PDF libraries.
 * PDF bytes: import `qr-invoice/pdf` instead.
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
  if (isPdf(bytes)) {
    return left("PDF input needs the PDF adapter (import '@qr-invoice/pdf').");
  }
  const extracted = extractSwissQrPayload(new TextDecoder().decode(bytes));
  if (!extracted.ok) return extracted;
  const analyzed = analyze(extracted.value);
  if (!analyzed.ok) return analyzed;
  const result = analyzed.value;
  const gate = canWrite(result, options);
  if (!gate.ok) return right(result);
  result.bytes = new TextEncoder().encode(buildQrPayload(gate.value));
  result.mediaType = "text/plain;charset=utf-8";
  return right(result);
}
