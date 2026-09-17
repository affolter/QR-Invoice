import {
  extractQrFromPdf,
  extractQrFromPdfFile,
  type QrExtractionResult,
} from "./extractQrFromPdf.js";

export { extractQrFromPdf, extractQrFromPdfFile, type QrExtractionResult };

export class QrExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QrExtractionError";
  }
}

export async function inspectPdf(path: string): Promise<QrExtractionResult> {
  return extractQrFromPdfFile(path);
}
