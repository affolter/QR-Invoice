import { readFile } from "node:fs/promises";
import type { InvoiceData, ReviewField } from "./models/invoice.js";
import type { ParsedInvoice } from "./models/invoice.js";
import { parseQrPayload } from "./parser/qrParser.js";
import { extractQrFromPdf } from "./parser/pdfParser.js";
import { normalizeInvoice } from "./normalizer/invoiceNormalizer.js";
import { validateInvoice, type ValidationResult } from "./validation/invoiceValidator.js";
import { generateInvoicePdf } from "./generator/pdfGenerator.js";

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

export async function convertInvoicePdf(
  inputPath: string,
  options: ConvertOptions,
): Promise<ConversionResult> {
  const bytes = await readFile(inputPath);
  const extraction = await extractQrFromPdf(new Uint8Array(bytes));
  if (!extraction.payload) {
    throw new Error(extraction.error ?? `No Swiss QR code in ${inputPath}`);
  }
  return convertQrPayload(extraction.payload, options);
}

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

  await generateInvoicePdf(normalized.invoice, options.outputPath);
  result.outputPath = options.outputPath;
  return result;
}
