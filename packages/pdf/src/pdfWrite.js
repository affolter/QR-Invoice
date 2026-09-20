/** @import { InvoiceData } from "@qr-invoice/core" */
/** @import { QrBox } from "./pdfQr.js" */

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import { buildQrPayload } from "@qr-invoice/core";
import { encodePng } from "./png.js";

/**
 * @param { Uint8ClampedArray } data
 * @param { number } size
 */
function stampSwissCross(data, size) {
  const square = Math.round(size * (7 / 46));
  const origin = Math.round((size - square) / 2);
  const u = square / 32;
  /** @param { number } x @param { number } y @param { number } w @param { number } h @param { number } r @param { number } g @param { number } b */
  const fill = (x, y, w, h, r, g, b) => {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(size, Math.ceil(x + w));
    const y1 = Math.min(size, Math.ceil(y + h));
    for (let yy = y0; yy < y1; yy += 1) {
      for (let xx = x0; xx < x1; xx += 1) {
        const i = (yy * size + xx) * 4;
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255;
      }
    }
  };
  fill(origin, origin, square, square, 255, 255, 255);
  fill(origin + 13 * u, origin + 6 * u, 6 * u, 20 * u, 0, 0, 0);
  fill(origin + 6 * u, origin + 13 * u, 20 * u, 6 * u, 0, 0, 0);
}

/**
 * @param { string } payload
 * @param { number } [px=512]
 * @returns { Uint8Array }
 */
export function swissQrPng(payload, px = 512) {
  const qr = QRCode.create(payload, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const scale = Math.max(1, Math.floor(px / n));
  const size = n * scale;
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      const dark = qr.modules.get(x, y);
      const tone = dark ? 0 : 255;
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          const i = ((y * scale + dy) * size + (x * scale + dx)) * 4;
          data[i] = tone;
          data[i + 1] = tone;
          data[i + 2] = tone;
          data[i + 3] = 255;
        }
      }
    }
  }
  stampSwissCross(data, size);
  return encodePng(data, size, size);
}

/**
 * @param { InvoiceData } invoice
 * @param { { originalPdf?: Uint8Array, qrBox?: QrBox } } [options]
 * @returns { Promise<Uint8Array> }
 */
export async function buildInvoicePdf(invoice, options = {}) {
  const payload = buildQrPayload(invoice);
  const qrBytes = swissQrPng(payload);
  if (options.originalPdf && options.qrBox) {
    const pdf = await PDFDocument.load(options.originalPdf.slice());
    const page = pdf.getPage(options.qrBox.pageIndex);
    if (!page) throw new Error("QR page is missing from the source PDF.");
    const image = await pdf.embedPng(qrBytes);
    const { x, y, width, height } = options.qrBox;
    page.drawRectangle({
      x: x - 1,
      y: y - 1,
      width: width + 2,
      height: height + 2,
      color: rgb(1, 1, 1),
    });
    page.drawImage(image, { x, y, width, height });
    return pdf.save();
  }

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const image = await pdf.embedPng(qrBytes);
  page.drawText("Swiss QR-bill (structured address)", { x: 48, y: 792, size: 14, font: bold });
  page.drawText(`${invoice.creditor.name}  ·  ${invoice.account}`, { x: 48, y: 768, size: 10, font });
  page.drawText(
    `${invoice.amount === undefined ? "open" : invoice.amount.toFixed(2)} ${invoice.currency}  ·  ${invoice.referenceType} ${invoice.reference ?? ""}`,
    { x: 48, y: 752, size: 10, font },
  );
  if (invoice.debtor) page.drawText(`Debtor: ${invoice.debtor.name}`, { x: 48, y: 736, size: 10, font });
  page.drawImage(image, { x: 190.92, y: 120, width: 128.4, height: 128.4 });
  return pdf.save();
}
