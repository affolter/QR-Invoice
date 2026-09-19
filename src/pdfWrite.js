/** @import { InvoiceData } from "./models.js" */
/** @import { QrBox } from "./pdfQr.js" */

import { createCanvas, loadImage } from "@napi-rs/canvas";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import { buildQrPayload } from "./build.js";

/**
 * Official Swiss-cross cutout (7 mm on a 46 mm QR, flag proportions 32×32).
 * @param { import("@napi-rs/canvas").SKRSContext2D } ctx
 * @param { number } size
 */
function stampSwissCross(ctx, size) {
  const square = size * (7 / 46);
  const origin = (size - square) / 2;
  const u = square / 32;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(origin, origin, square, square);
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = Math.max(1, size * 0.004);
  ctx.strokeRect(origin, origin, square, square);
  ctx.fillStyle = "#000000";
  ctx.fillRect(origin + 13 * u, origin + 6 * u, 6 * u, 20 * u);
  ctx.fillRect(origin + 6 * u, origin + 13 * u, 20 * u, 6 * u);
}

/**
 * @param { string } payload
 * @param { number } [px=512]
 * @returns { Promise<Uint8Array> }
 */
export async function swissQrPng(payload, px = 512) {
  const png = await QRCode.toBuffer(payload, {
    errorCorrectionLevel: "M",
    margin: 0,
    width: px,
    type: "png",
    color: { dark: "#000000", light: "#ffffff" },
  });
  const image = await loadImage(png);
  const canvas = createCanvas(px, px);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, px, px);
  stampSwissCross(ctx, px);
  return new Uint8Array(canvas.toBuffer("image/png"));
}

/**
 * @param { InvoiceData } invoice
 * @param { { originalPdf?: Uint8Array, qrBox?: QrBox } } [options]
 * @returns { Promise<Uint8Array> }
 */
export async function buildInvoicePdf(invoice, options = {}) {
  const payload = buildQrPayload(invoice);
  const qrBytes = await swissQrPng(payload);
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
