import { readFile } from "node:fs/promises";
import type { InvoiceData, ParsedInvoice, ReviewField } from "./models/invoice.js";
import { parseQrPayload } from "./parser/qrParser.js";
import { extractSwissQrPayloadFromBytes } from "./parser/pdfParser.js";
import { normalizeInvoice } from "./normalizer/invoiceNormalizer.js";
import { validateInvoice, type ValidationResult } from "./validation/invoiceValidator.js";
import { generateInvoicePayload } from "./generator/pdfGenerator.js";

export interface ConversionResult {
  rawQr: string;
  parsed: ParsedInvoice;
  invoice: InvoiceData | null;
  review: ReviewField[];
  validation: ValidationResult;
  outputPath?: string;
}

export interface ConvertOptions {
  outputPath: string;
  acceptReview?: boolean;
  strict?: boolean;
}

export async function convertInvoiceFile(
  inputPath: string,
  options: ConvertOptions,
): Promise<ConversionResult> {
  const bytes = await readFile(inputPath);
  const rawQr = extractSwissQrPayloadFromBytes(new Uint8Array(bytes));
  return convertQrPayload(rawQr, options);
}

/** @deprecated Use convertInvoiceFile. Kept so existing call sites keep working. */
export const convertInvoicePdf = convertInvoiceFile;

export async function convertQrPayload(
  rawQr: string,
  options: ConvertOptions,
): Promise<ConversionResult> {
  const parsed = parseQrPayload(rawQr);
  const normalized = normalizeInvoice(parsed);
  const validation = validateInvoice(normalized.invoice);

  const result: ConversionResult = {
    rawQr,
    parsed: normalized.parsed,
    invoice: normalized.invoice,
    review: normalized.review,
    validation,
  };

  if (!validation.valid) {
    return result;
  }
  if (normalized.review.length > 0 && !options.acceptReview) {
    return result;
  }
  if (options.strict && validation.issues.some((issue) => issue.severity === "warning")) {
    return result;
  }
  if (!normalized.invoice) {
    return result;
  }

  await generateInvoicePayload(normalized.invoice, options.outputPath);
  result.outputPath = options.outputPath;
  return result;
}
