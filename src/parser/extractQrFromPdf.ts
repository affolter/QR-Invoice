import { PNG } from "pngjs";
import jpeg from "jpeg-js";
import jsQR from "jsqr";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";

export interface QrExtractionResult {
  payload: string | null;
  method: "embedded-image" | "none";
  page: number | null;
  error?: string;
}

const PAINT_OPS = new Set<number>([
  OPS.paintImageXObject,
  OPS.paintInlineImageXObject,
  OPS.paintImageXObjectRepeat,
]);

interface Raster {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

function toRgba(width: number, height: number, raw: Uint8Array, channels: number): Raster {
  const data = new Uint8ClampedArray(width * height * 4);
  if (channels === 4) {
    data.set(raw.subarray(0, data.length));
    return { data, width, height };
  }
  for (let i = 0, j = 0; i < width * height; i += 1, j += channels) {
    if (channels === 1) {
      const g = raw[j] ?? 0;
      data[i * 4] = g;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = g;
      data[i * 4 + 3] = 255;
    } else {
      data[i * 4] = raw[j] ?? 0;
      data[i * 4 + 1] = raw[j + 1] ?? 0;
      data[i * 4 + 2] = raw[j + 2] ?? 0;
      data[i * 4 + 3] = 255;
    }
  }
  return { data, width, height };
}

function decodeEncodedImage(bytes: Uint8Array): Raster | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    const png = PNG.sync.read(Buffer.from(bytes));
    return toRgba(png.width, png.height, png.data, 4);
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    const decoded = jpeg.decode(bytes, { maxMemoryUsageInMB: 64 });
    return { data: new Uint8ClampedArray(decoded.data), width: decoded.width, height: decoded.height };
  }
  return null;
}

function rasterFromPdfImage(image: unknown): Raster | null {
  if (!image || typeof image !== "object") {
    return null;
  }
  const img = image as {
    data?: Uint8Array | Uint8ClampedArray;
    width?: number;
    height?: number;
    kind?: number;
  };
  if (!img.data || !img.width || !img.height) {
    return decodeEncodedImage(img.data instanceof Uint8Array ? img.data : new Uint8Array());
  }
  const raw = img.data instanceof Uint8Array ? img.data : new Uint8Array(img.data.buffer);
  if (raw[0] === 0x89 || raw[0] === 0xff) {
    const encoded = decodeEncodedImage(raw);
    if (encoded) {
      return encoded;
    }
  }
  const pixels = img.width * img.height;
  const channels = Math.round(raw.length / pixels);
  if (channels === 1 || channels === 3 || channels === 4) {
    return toRgba(img.width, img.height, raw, channels);
  }
  return null;
}

function tryDecodeQr(raster: Raster): string | null {
  const result = jsQR(raster.data, raster.width, raster.height, { inversionAttempts: "attemptBoth" });
  if (result?.data?.startsWith("SPC\n") || result?.data?.startsWith("SPC\r")) {
    return result.data;
  }
  return null;
}

async function resolveImage(page: { objs: { get: (n: string) => unknown } }, name: unknown): Promise<unknown> {
  if (typeof name !== "string") {
    return name;
  }
  const objs = page.objs as { get: (id: string, callback?: (value: unknown) => void) => unknown };
  return new Promise((resolve) => {
    try {
      const immediate = objs.get(name, (value: unknown) => resolve(value));
      if (immediate && typeof immediate === "object") {
        resolve(immediate);
      }
    } catch {
      resolve(null);
    }
  });
}

/**
 * Decode a Swiss QR payload from raster images embedded in the PDF.
 * Vector-only QR codes (paths, not images) are not decoded in this milestone.
 */
export async function extractQrFromPdf(pdfBytes: Uint8Array): Promise<QrExtractionResult> {
  const loadingTask = getDocument({
    data: pdfBytes,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const ops = await page.getOperatorList();
      const seen = new Set<string>();

      for (let i = 0; i < ops.fnArray.length; i += 1) {
        const fn = ops.fnArray[i];
        if (fn === undefined || !PAINT_OPS.has(fn)) {
          continue;
        }
        const args = ops.argsArray[i] ?? [];
        const name = args[0];
        const key = String(name);
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);

        const image = typeof name === "string" ? await resolveImage(page, name) : args[0];
        const raster = rasterFromPdfImage(image);
        if (!raster) {
          continue;
        }
        const payload = tryDecodeQr(raster);
        if (payload) {
          return { payload, method: "embedded-image", page: pageNumber };
        }
      }
    }

    return {
      payload: null,
      method: "none",
      page: null,
      error:
        "No Swiss QR code found in embedded PDF images. Vector-drawn codes need a later render path; add a real fixture under tests/fixtures/pdfs/real/.",
    };
  } finally {
    await pdf.destroy();
  }
}

export async function extractQrFromPdfFile(path: string): Promise<QrExtractionResult> {
  const { readFile } = await import("node:fs/promises");
  const bytes = await readFile(path);
  return extractQrFromPdf(new Uint8Array(bytes));
}
