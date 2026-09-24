declare module "qrcode" {
  const QRCode: {
    create: (
      text: string,
      options?: { errorCorrectionLevel?: string },
    ) => { modules: { size: number; get: (x: number, y: number) => boolean } };
  };
  export default QRCode;
}

declare module "jsqr" {
  function jsQR(
    data: Uint8ClampedArray,
    width: number,
    height: number,
  ): { data: string } | null;
  export default jsQR;
}

declare module "pdfjs-dist/build/pdf.mjs";
declare module "pdfjs-dist/legacy/build/pdf.mjs";
declare module "pdfjs-dist/build/pdf.worker.min.mjs?url" {
  const url: string;
  export default url;
}

declare module "@napi-rs/canvas" {
  export const DOMMatrix: typeof globalThis.DOMMatrix;
  export const ImageData: typeof globalThis.ImageData;
  export const Path2D: typeof globalThis.Path2D;
}

