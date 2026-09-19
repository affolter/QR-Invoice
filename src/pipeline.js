/** @import { InvoiceData, ParsedInvoice, ReviewField } from "./models.js" */
/** @import { EitherType } from "./either.js" */
/** @import { ValidationResult } from "./validate.js" */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { left, right } from "./either.js";
import { extractSwissQrPayload, parseQrPayload } from "./parse.js";
import { normalizeInvoice } from "./normalize.js";
import { validateInvoice } from "./validate.js";
import { buildQrPayload } from "./build.js";

/**
 * @typedef { {
 *   rawQr: string,
 *   parsed: ParsedInvoice,
 *   invoice: InvoiceData | null,
 *   review: ReviewField[],
 *   validation: ValidationResult,
 *   outputPath?: string,
 * } } ConversionResult
 *
 * @typedef { {
 *   outputPath: string,
 *   acceptReview?: boolean,
 *   strict?: boolean,
 * } } ConvertOptions
 */

/**
 * Single write policy for CLI and pipeline.
 * @param   { Pick<ConversionResult, "validation" | "review" | "invoice"> } result
 * @param   { Pick<ConvertOptions, "acceptReview" | "strict"> }             options
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
 * Left = parse/IO failure. Right may still have no outputPath when canWrite blocks.
 * @param   { string }         rawQr
 * @param   { ConvertOptions } options
 * @returns { Promise<EitherType<string, ConversionResult>> }
 */
export async function convertQrPayload(rawQr, options) {
  const parsed = parseQrPayload(rawQr);
  if (!parsed.ok) return parsed;
  const normalized = normalizeInvoice(parsed.value);
  /** @type { ConversionResult } */
  const result = {
    rawQr,
    parsed: normalized.parsed,
    invoice: normalized.invoice,
    review: normalized.review,
    validation: validateInvoice(normalized.invoice),
  };
  const gate = canWrite(result, options);
  if (!gate.ok) return right(result);
  try {
    await mkdir(dirname(options.outputPath), { recursive: true });
    await writeFile(options.outputPath, buildQrPayload(gate.value), "utf8");
  } catch (error) {
    return left(error instanceof Error ? error.message : String(error));
  }
  result.outputPath = options.outputPath;
  return right(result);
}

/**
 * @param   { string }         inputPath
 * @param   { ConvertOptions } options
 * @returns { Promise<EitherType<string, ConversionResult>> }
 */
export async function convertInvoiceFile(inputPath, options) {
  let text;
  try {
    text = await readFile(inputPath, "utf8");
  } catch (error) {
    return left(error instanceof Error ? error.message : String(error));
  }
  const extracted = extractSwissQrPayload(text);
  if (!extracted.ok) return extracted;
  return convertQrPayload(extracted.value, options);
}
