export class OcrNotImplementedError extends Error {
  constructor() {
    super("OCR is out of scope for this milestone. Provide a PDF that contains a decodable Swiss QR code.");
    this.name = "OcrNotImplementedError";
  }
}

export function parseWithOcr(): never {
  throw new OcrNotImplementedError();
}
