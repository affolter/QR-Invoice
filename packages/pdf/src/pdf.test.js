import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import jsQR from "jsqr";
import { isPdf } from "@qr-invoice/core";
import { unwrap } from "../../core/src/either.js";
import { buildSwissQrPayload } from "../../core/src/fixtures.js";
import { convert, extractSwissQrFromPdf, swissQrPng } from "./index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const spcFixture = join(root, "fixtures", "spc", "affolter-27338.txt");
const pdfFixture = join(root, "fixtures", "pdf", "affolter-27338.pdf");

describe("PDF QR restamp", () => {
  it("detects PDF magic bytes", () => {
    assert.equal(isPdf(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])), true);
    assert.equal(isPdf(new TextEncoder().encode("SPC\n0200")), false);
  });

  it("reads the git-tracked Affolter PDF fixture and restamps S with 8 B", async () => {
    const source = unwrap(await extractSwissQrFromPdf(new Uint8Array(await readFile(pdfFixture))));
    assert.match(source.payload, /^SPC/);
    assert.match(source.payload, /Seestrasse 8 B/);

    const result = unwrap(await convert(new Uint8Array(await readFile(pdfFixture)), { output: "pdf" }));
    assert.equal(result.validation.valid, true);
    assert.equal(result.invoice?.creditor.buildingNumber, "8 B");
    assert.equal(result.invoice?.creditor.street, "Seestrasse");
    assert.ok(result.bytes);
    assert.equal(result.mediaType, "application/pdf");

    const restamped = unwrap(await extractSwissQrFromPdf(result.bytes));
    assert.match(restamped.payload, /^SPC/);
    assert.match(restamped.payload, /\nS\nAffolter Test AG\nSeestrasse\n8 B\n8700\nKüsnacht\nCH\n/);
    assert.equal(restamped.box.pageIndex, 0);
  });

  it("still writes SPC text when output is spc", async () => {
    const result = unwrap(await convert(new Uint8Array(await readFile(pdfFixture)), { output: "spc" }));
    assert.ok(result.bytes);
    const text = new TextDecoder().decode(result.bytes);
    assert.match(text, /^SPC\n/);
    assert.match(text, /\nS\nAffolter Test AG\nSeestrasse\n8 B\n/);
  });

  it("returns PDF bytes from the PDF adapter when output is pdf", async () => {
    const result = unwrap(await convert(await readFile(spcFixture, "utf8"), { output: "pdf" }));
    assert.equal(result.mediaType, "application/pdf");
    assert.ok(result.bytes);
    assert.equal(result.bytes[0], 0x25);
    assert.equal(result.bytes[1], 0x50);
  });
});

describe("own QR + PNG", () => {
  it("jsQR reads a Swiss QR PNG stamped without canvas", () => {
    const payload = buildSwissQrPayload();
    const png = swissQrPng(payload, 256);
    assert.equal(png[0], 0x89);
    const rgba = decodePngRgba(png);
    const decode = typeof jsQR === "function" ? jsQR : /** @type { { default: typeof jsQR } } */ (jsQR).default;
    const qr = decode(rgba.data, rgba.width, rgba.height);
    assert.ok(qr?.data.startsWith("SPC"));
    assert.match(qr?.data ?? "", /\nCH4431999123000889012\n/);
  });
});

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
