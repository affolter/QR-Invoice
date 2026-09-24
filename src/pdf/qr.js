/** @import { EitherType } from "../index.js" */

import jsQR from "jsqr";
import { left, right } from "../index.js";
import { installNodePdfGlobals } from "./nodeCanvas.js";

/**
 * @typedef { {
 *   x:         number,
 *   y:         number,
 *   width:     number,
 *   height:    number,
 *   pageIndex: number,
 * } } QrBox
 * @typedef { {
 *   payload: string,
 *   box:     QrBox,
 * } } PdfQr
 */

/**
 * @param { Uint8ClampedArray } data
 * @param { number } width
 * @param { number } height
 * @returns { { data: string } | null }
 */
function decodeQr(data, width, height) {
  const decode = typeof jsQR === "function" ? jsQR : /** @type { { default: typeof jsQR } } */ (jsQR).default;
  return decode(data, width, height);
}

/**
 * Node uses the pdf.js legacy build; the browser uses the generic build.
 * The generic build still reads workerSrc even when disableWorker is true.
 * @returns { Promise<{ getDocument: typeof import("pdfjs-dist").getDocument, OPS: typeof import("pdfjs-dist").OPS, GlobalWorkerOptions?: { workerSrc: string } }> }
 */
async function loadPdfjs() {
  if (typeof document === "undefined") {
    await installNodePdfGlobals();
    return import("pdfjs-dist/legacy/build/pdf.mjs");
  }
  const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
  if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = String(worker.default);
  }
  return pdfjs;
}

/**
 * @param { Uint8Array } bytes
 * @returns { Uint8Array }
 * @pure
 */
function pdfjsData(bytes) {
  return bytes.slice();
}

/**
 * @param { [number, number, number, number, number, number] } m
 * @param { number[] } n
 * @returns { [number, number, number, number, number, number] }
 * @pure
 */
function mul(m, n) {
  const a = m[0] ?? 0;
  const b = m[1] ?? 0;
  const c = m[2] ?? 0;
  const d = m[3] ?? 0;
  const e = m[4] ?? 0;
  const f = m[5] ?? 0;
  const na = n[0] ?? 0;
  const nb = n[1] ?? 0;
  const nc = n[2] ?? 0;
  const nd = n[3] ?? 0;
  const ne = n[4] ?? 0;
  const nf = n[5] ?? 0;
  return [a * na + c * nb, b * na + d * nb, a * nc + c * nd, b * nc + d * nd, a * ne + c * nf + e, b * ne + d * nf + f];
}

/**
 * @param { { width?: number, height?: number, data?: Uint8Array | Uint8ClampedArray, kind?: number, bitmap?: ImageBitmap } | ImageBitmap | null } img
 * @returns { Promise<{ data: Uint8ClampedArray, width: number, height: number } | null> }
 */
async function imageRgba(img) {
  if (!img) return null;
  const bitmap =
    typeof ImageBitmap !== "undefined" && img instanceof ImageBitmap
      ? img
      : "bitmap" in img
        ? img.bitmap
        : undefined;
  if (bitmap && typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    return { data, width, height };
  }
  return toRgba(/** @type { { width: number, height: number, data: Uint8Array | Uint8ClampedArray, kind?: number } } */ (img));
}

/**
 * @param { { width: number, height: number, data: Uint8Array | Uint8ClampedArray, kind?: number } } img
 * @returns { { data: Uint8ClampedArray, width: number, height: number } | null }
 * @pure
 */
function toRgba(img) {
  const width = img.width;
  const height = img.height;
  const src = img.data;
  if (!width || !height || !src) return null;
  if (src.length >= width * height * 4) {
    return { data: new Uint8ClampedArray(src.buffer, src.byteOffset, width * height * 4), width, height };
  }
  if (src.length === width * height * 3) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0, j = 0; i < src.length; i += 3, j += 4) {
      data[j] = src[i] ?? 0;
      data[j + 1] = src[i + 1] ?? 0;
      data[j + 2] = src[i + 2] ?? 0;
      data[j + 3] = 255;
    }
    return { data, width, height };
  }
  if (src.length === width * height) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0, j = 0; i < src.length; i += 1, j += 4) {
      const tone = src[i] ?? 0;
      data[j] = tone;
      data[j + 1] = tone;
      data[j + 2] = tone;
      data[j + 3] = 255;
    }
    return { data, width, height };
  }
  return null;
}

/**
 * @param { import("pdfjs-dist").PDFPageProxy } page
 * @param { typeof import("pdfjs-dist").OPS } OPS
 * @returns { Promise<Map<string, QrBox>> }
 */
async function imageBoxes(page, OPS) {
  const ops = await page.getOperatorList();
  /** @type { [number, number, number, number, number, number] } */
  let ctm = [1, 0, 0, 1, 0, 0];
  /** @type { Array<[number, number, number, number, number, number]> } */
  const stack = [];
  /** @type { Map<string, QrBox> } */
  const boxes = new Map();
  for (let i = 0; i < ops.fnArray.length; i += 1) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i] ?? [];
    if (fn === OPS.save) stack.push(/** @type { typeof ctm } */ (ctm.slice()));
    else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.transform && args.length >= 6) ctm = mul(ctm, args);
    else if (fn === OPS.paintImageXObject && typeof args[0] === "string") {
      boxes.set(args[0], {
        x:         ctm[4],
        y:         ctm[5],
        width:     Math.abs(ctm[0]),
        height:    Math.abs(ctm[3]),
        pageIndex: 0,
      });
    }
  }
  return boxes;
}

/**
 * @param { import("pdfjs-dist").PDFPageProxy } page
 * @param { string } name
 */
function getImage(page, name) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out reading PDF image ${name}`)), 8000);
    page.objs.get(name, /** @param { unknown } img */ img => {
      clearTimeout(timer);
      resolve(img);
    });
  });
}

/**
 * Read the Swiss QR payload from embedded PDF images. Does not OCR and does not rasterize the page.
 * @param { Uint8Array } bytes
 * @returns { Promise<EitherType<string, PdfQr>> }
 */
export const extractSwissQrFromPdf = async bytes => {
  /** @type { { numPages: number, getPage: (n: number) => Promise<unknown>, destroy: () => Promise<void> } | undefined } */
  let doc;
  try {
    const { getDocument, OPS } = await loadPdfjs();
    const browser = typeof document !== "undefined";
    doc = await getDocument(
      /** @type { object } */ ({
        data: pdfjsData(bytes),
        disableWorker: !browser,
        isEvalSupported: false,
      }),
    ).promise;
    /** @type { PdfQr | null } */
    let found = null;
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = /** @type { import("pdfjs-dist").PDFPageProxy } */ (await doc.getPage(pageNumber));
      const boxes = await imageBoxes(page, OPS);
      for (const [name, box] of boxes) {
        const img = await getImage(page, name);
        const rgba = await imageRgba(img);
        if (!rgba) continue;
        const qr = decodeQr(rgba.data, rgba.width, rgba.height);
        const payload = qr?.data?.replace(/^\uFEFF/, "") ?? "";
        if (payload.startsWith("SPC")) {
          found = { payload, box: { ...box, pageIndex: pageNumber - 1 } };
        }
      }
    }
    return found
      ? right(found)
      : left("This PDF has no Swiss QR code. The tool reads an embedded QR image, not a photograph of a page.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/DOMMatrix|ImageData|Path2D|@napi-rs\/canvas/i.test(message)) return left(message);
    return left("This file is not a readable PDF.");
  } finally {
    if (doc) await doc.destroy();
  }
};
