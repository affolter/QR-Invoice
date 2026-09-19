import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { describe, it } from "node:test";
import jsQR from "jsqr";
import { convert } from "./backend.js";
import { unwrap } from "./either.js";
import { buildSwissQrPayload } from "./fixtures.js";
import { swissQrPng } from "./pdfWrite.js";

describe("backend convert", () => {
  it("returns SPC bytes a future UI can turn into a download", async () => {
    const result = unwrap(await convert(buildSwissQrPayload(), { output: "spc" }));
    assert.equal(result.mediaType, "text/plain;charset=utf-8");
    assert.ok(result.bytes);
    assert.match(new TextDecoder().decode(result.bytes), /^SPC\n/);
    assert.equal(result.invoice?.account, "CH4431999123000889012");
  });

  it("returns PDF bytes when output is pdf", async () => {
    const result = unwrap(await convert(buildSwissQrPayload(), { output: "pdf" }));
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
