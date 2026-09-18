import { readFile } from "node:fs/promises";
import { andThen, left, right, type Either } from "./either.js";
import type { InvoiceData, ParsedInvoice, ReviewField } from "./models/invoice.js";
import { parseQrPayload } from "./parser/qrParser.js";
import { extractSwissQrPayloadFromBytes } from "./parser/spc.js";
import { normalizeInvoice } from "./normalizer/invoiceNormalizer.js";
import { validateInvoice, type ValidationResult } from "./validation/invoiceValidator.js";
import { writePayload } from "./generator/buildQrPayload.js";

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
    return left(
      "Generation blocked until ambiguous address fields are reviewed. Re-run with --accept-review only if you accept the inferred values.",
    );
  }
  if (options.strict && result.validation.issues.some((issue) => issue.severity === "warning")) {
    return left("Generation blocked by --strict (warnings present).");
  }
  return right(result.invoice);
}

function analyzed(rawQr: string, parsed: ParsedInvoice): ConversionResult {
  const normalized = normalizeInvoice(parsed);
  return {
    rawQr,
    parsed: normalized.parsed,
    invoice: normalized.invoice,
    review: normalized.review,
    validation: validateInvoice(normalized.invoice),
  };
}

export function convert(rawQr: string, options: Pick<ConvertOptions, "acceptReview" | "strict">): Either<string, ConversionResult> {
  return andThen(parseQrPayload(rawQr), (parsed) => {
    const result = analyzed(rawQr, parsed);
    return andThen(canWrite(result, options), () => right(result));
  });
}

export async function convertQrPayload(rawQr: string, options: ConvertOptions): Promise<ConversionResult> {
  const parsedE = parseQrPayload(rawQr);
  if (!parsedE.ok) {
    throw new Error(parsedE.error);
  }
  const result = analyzed(rawQr, parsedE.value);
  const gate = canWrite(result, options);
  if (gate.ok) {
    await writePayload(gate.value, options.outputPath);
    result.outputPath = options.outputPath;
  }
  return result;
}

export async function convertInvoiceFile(inputPath: string, options: ConvertOptions): Promise<ConversionResult> {
  const extracted = extractSwissQrPayloadFromBytes(new Uint8Array(await readFile(inputPath)));
  if (!extracted.ok) {
    throw new Error(extracted.error);
  }
  return convertQrPayload(extracted.value, options);
}
