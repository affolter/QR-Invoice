import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { left, right, type Either } from "./either.js";
import type { InvoiceData, ParsedInvoice, ReviewField } from "./models.js";
import { extractSwissQrPayload, parseQrPayload } from "./parse.js";
import { normalizeInvoice } from "./normalize.js";
import { validateInvoice, type ValidationResult } from "./validate.js";
import { buildQrPayload } from "./build.js";

export type ConversionResult = {
  rawQr: string;
  parsed: ParsedInvoice;
  invoice: InvoiceData | null;
  review: ReviewField[];
  validation: ValidationResult;
  outputPath?: string;
};

export type ConvertOptions = {
  outputPath: string;
  acceptReview?: boolean;
  strict?: boolean;
};

export function canWrite(
  result: Pick<ConversionResult, "validation" | "review" | "invoice">,
  options: Pick<ConvertOptions, "acceptReview" | "strict">,
): Either<string, InvoiceData> {
  if (!result.invoice || !result.validation.valid) {
    return left("Generation blocked by validation errors. IBAN, amount, currency and reference were not modified.");
  }
  if (result.review.length > 0 && !options.acceptReview) {
    return left("Generation blocked until ambiguous address fields are reviewed. Re-run with --accept-review only if you accept the inferred values.");
  }
  if (options.strict && result.validation.issues.some((issue) => issue.severity === "warning")) {
    return left("Generation blocked by --strict (warnings present).");
  }
  return right(result.invoice);
}

export async function convertQrPayload(rawQr: string, options: ConvertOptions): Promise<ConversionResult> {
  const parsed = parseQrPayload(rawQr);
  if (!parsed.ok) throw new Error(parsed.error);
  const normalized = normalizeInvoice(parsed.value);
  const result: ConversionResult = {
    rawQr,
    parsed: normalized.parsed,
    invoice: normalized.invoice,
    review: normalized.review,
    validation: validateInvoice(normalized.invoice),
  };
  const gate = canWrite(result, options);
  if (gate.ok) {
    await mkdir(dirname(options.outputPath), { recursive: true });
    await writeFile(options.outputPath, buildQrPayload(gate.value), "utf8");
    result.outputPath = options.outputPath;
  }
  return result;
}

export async function convertInvoiceFile(inputPath: string, options: ConvertOptions): Promise<ConversionResult> {
  const extracted = extractSwissQrPayload(await readFile(inputPath, "utf8"));
  if (!extracted.ok) throw new Error(extracted.error);
  return convertQrPayload(extracted.value, options);
}
