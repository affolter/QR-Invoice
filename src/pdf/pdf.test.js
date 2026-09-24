import { TestSuite, asyncTest } from "../../kolibri/util/test.js";
import { inflateSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import jsQR from "jsqr";
import { applyAddressReview, isPdf } from "../index.js";
import { unwrap } from "../either.js";
import { buildSwissQrPayload } from "../synthetic.js";
import { convert, extractSwissQrFromPdf, swissQrPng, writeInvoice } from "./index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const spcSample = join(root, "samples", "combined-k.txt");
const pdfSample = join(root, "samples", "combined-k.pdf");

const suite = TestSuite("PDF QR restamp");

suite.add("detects PDF magic bytes", assert => {
  assert.is(isPdf(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])), true);
  assert.is(isPdf(new TextEncoder().encode("SPC\n0200")), false);
});

suite.run();

asyncTest("PDF QR restamp — explains a PDF that has no Swiss QR image", async assert => {
  const emptyPdf = new TextEncoder().encode(
    "%PDF-1.1\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000068 00000 n \n0000000125 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n203\n%%EOF\n",
  );
  const extracted = await extractSwissQrFromPdf(emptyPdf);
  assert.is(extracted.ok, false);
  if (!extracted.ok) assert.isTrue(/no Swiss QR code/i.test(extracted.error));
});

asyncTest("PDF QR restamp — explains a file that only looks like a PDF", async assert => {
  const extracted = await extractSwissQrFromPdf(new TextEncoder().encode("%PDF-1.4 not a real pdf"));
  assert.is(extracted.ok, false);
  if (!extracted.ok) assert.is(extracted.error, "This file is not a readable PDF.");
});

asyncTest("PDF QR restamp — reads the combined-k PDF and restamps S with 8 B", async assert => {
  const source = unwrap(await extractSwissQrFromPdf(new Uint8Array(await readFile(pdfSample))));
  assert.isTrue(/^SPC/.test(source.payload));
  assert.isTrue(/Seestrasse 8 B/.test(source.payload));

  const result = unwrap(await convert(new Uint8Array(await readFile(pdfSample)), { output: "pdf" }));
  assert.is(result.validation.valid, true);
  assert.is(result.invoice?.creditor.buildingNumber, "8 B");
  assert.is(result.invoice?.creditor.street, "Seestrasse");
  assert.isTrue(Boolean(result.bytes));
  assert.is(result.mediaType, "application/pdf");

  const restamped = unwrap(await extractSwissQrFromPdf(result.bytes ?? new Uint8Array()));
  assert.isTrue(/^SPC/.test(restamped.payload));
  assert.isTrue(/\nS\nAffolter Test AG\nSeestrasse\n8 B\n8700\nKüsnacht\nCH\n/.test(restamped.payload));
  assert.is(restamped.box.pageIndex, 0);
});

asyncTest("PDF QR restamp — still writes SPC text when output is spc", async assert => {
  const result = unwrap(await convert(new Uint8Array(await readFile(pdfSample)), { output: "spc" }));
  assert.isTrue(Boolean(result.bytes));
  const text = new TextDecoder().decode(result.bytes);
  assert.isTrue(/^SPC\n/.test(text));
  assert.isTrue(/\nS\nAffolter Test AG\nSeestrasse\n8 B\n/.test(text));
});

asyncTest("PDF QR restamp — returns PDF bytes when output is pdf", async assert => {
  const result = unwrap(await convert(await readFile(spcSample, "utf8"), { output: "pdf" }));
  assert.is(result.mediaType, "application/pdf");
  assert.isTrue(Boolean(result.bytes));
  assert.is(result.bytes?.[0], 0x25);
  assert.is(result.bytes?.[1], 0x50);
});

asyncTest("PDF QR restamp — restamps from patched InvoiceData without rewriting the IBAN", async assert => {
  const source = unwrap(await convert(new Uint8Array(await readFile(pdfSample)), { output: "pdf" }));
  assert.isTrue(source.invoice != null);
  if (!source.invoice) return;
  const iban = source.invoice.account;
  const applied = applyAddressReview(source.invoice, {
    "creditor.street": "Seestrasse",
    "creditor.buildingNumber": "8 B",
    account: "CH9300762011623852957",
  });
  const written = unwrap(
    await writeInvoice(applied.invoice, { originalPdf: new Uint8Array(await readFile(pdfSample)), output: "pdf" }),
  );
  const restamped = unwrap(await extractSwissQrFromPdf(written.bytes));
  assert.isTrue(/\nSeestrasse\n8 B\n/.test(restamped.payload));
  assert.isTrue(new RegExp(`\n${iban}\n`).test(restamped.payload));
  assert.isTrue(!/CH9300762011623852957/.test(restamped.payload));
});

const pngSuite = TestSuite("own QR + PNG");

pngSuite.add("jsQR reads a Swiss QR PNG stamped without canvas", assert => {
  const payload = buildSwissQrPayload();
  const png = swissQrPng(payload, 256);
  assert.is(png[0], 0x89);
  const rgba = decodePngRgba(png);
  const decode = typeof jsQR === "function" ? jsQR : /** @type { { default: typeof jsQR } } */ (jsQR).default;
  const qr = decode(rgba.data, rgba.width, rgba.height);
  assert.isTrue(Boolean(qr?.data.startsWith("SPC")));
  assert.isTrue(/\nCH4431999123000889012\n/.test(qr?.data ?? ""));
});

pngSuite.run();

/**
 * @param { Uint8Array } png
 */
function decodePngRgba(png) {
  let offset = 8;
  let idat = Buffer.alloc(0);
  let width = 0;
  let height = 0;
  const buf = Buffer.from(png);
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    }
    if (type === "IDAT") idat = Buffer.concat([idat, data]);
    offset += 12 + len;
  }
  if (!width || !height) throw new Error("bad test png");
  const raw = inflateSync(idat);
  const rgba = new Uint8ClampedArray(width * height * 4);
  const row = 1 + width * 4;
  for (let y = 0; y < height; y += 1) rgba.set(raw.subarray(y * row + 1, (y + 1) * row), y * width * 4);
  return { data: rgba, width, height };
}
