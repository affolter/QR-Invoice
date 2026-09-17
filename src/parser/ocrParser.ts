export class OcrNotImplementedError extends Error {
  constructor() {
    super("OCR is out of scope. Pass a Swiss QR SPC text payload instead of a scanned PDF.");
    this.name = "OcrNotImplementedError";
  }
}

export function parseWithOcr(): never {
  throw new OcrNotImplementedError();
}
