import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";
import { unwrap } from "./either.js";
import { extractSwissQrFromPdf, isPdf } from "./pdfQr.js";
import { swissQrPng } from "./pdfWrite.js";
import { convertInvoiceFile } from "./pipeline.js";

const fixture = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "spc", "affolter-27338.txt");

/**
 * @param { string } payload
 * @returns { Promise<Uint8Array> }
 */
async function invoicePdfWithQr(payload) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const png = swissQrPng(payload, 256);
  const image = await pdf.embedPng(png);
  page.drawImage(image, { x: 190.92, y: 120, width: 128.4, height: 128.4 });
  return pdf.save();
}

describe("PDF QR restamp", () => {
  it("detects PDF magic bytes", () => {
    assert.equal(isPdf(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])), true);
    assert.equal(isPdf(new TextEncoder().encode("SPC\n0200")), false);
  });

  it("reads a K QR from a PDF and restamps S with 8 B on the same page", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qr-invoice-pdf-"));
    const input = join(dir, "old.pdf");
    const output = join(dir, "new.pdf");
    const payload = await readFile(fixture, "utf8");
    await writeFile(input, await invoicePdfWithQr(payload.replace(/\n+$/, "")));

    const result = unwrap(await convertInvoiceFile(input, { outputPath: output }));
    assert.equal(result.validation.valid, true);
    assert.equal(result.invoice?.creditor.buildingNumber, "8 B");
    assert.equal(result.invoice?.creditor.street, "Seestrasse");
    assert.equal(result.outputPath, output);

    const restamped = unwrap(await extractSwissQrFromPdf(new Uint8Array(await readFile(output))));
    assert.match(restamped.payload, /^SPC/);
    assert.match(restamped.payload, /\nS\nAffolter Test AG\nSeestrasse\n8 B\n8700\nKüsnacht\nCH\n/);
    assert.equal(restamped.box.pageIndex, 0);
  });

  it("still writes SPC text when the output is .txt", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qr-invoice-pdf-txt-"));
    const input = join(dir, "old.pdf");
    const output = join(dir, "new.txt");
    await writeFile(input, await invoicePdfWithQr((await readFile(fixture, "utf8")).replace(/\n+$/, "")));
    const result = unwrap(await convertInvoiceFile(input, { outputPath: output }));
    const text = await readFile(output, "utf8");
    assert.equal(result.outputPath, output);
    assert.match(text, /^SPC\n/);
    assert.match(text, /\nS\nAffolter Test AG\nSeestrasse\n8 B\n/);
  });
});
