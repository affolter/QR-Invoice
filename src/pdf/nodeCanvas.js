/**
 * Node-only DOM globals that pdf.js needs. The browser already has these.
 * @returns { Promise<void> }
 */
export const installNodePdfGlobals = async () => {
  if (typeof document !== "undefined") return;
  if (globalThis.DOMMatrix && globalThis.ImageData && globalThis.Path2D) return;
  const { DOMMatrix, ImageData, Path2D } = await import("@napi-rs/canvas");
  if (!DOMMatrix || !ImageData || !Path2D) {
    throw new Error("Cannot polyfill DOMMatrix, ImageData, or Path2D from @napi-rs/canvas");
  }
  globalThis.DOMMatrix = DOMMatrix;
  globalThis.ImageData = ImageData;
  globalThis.Path2D = Path2D;
};
