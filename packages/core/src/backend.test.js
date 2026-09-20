import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { convert } from "./backend.js";
import { unwrap } from "./either.js";
import { buildSwissQrPayload } from "./fixtures.js";

describe("backend convert", () => {
  it("returns SPC bytes a future UI can turn into a download", async () => {
    const result = unwrap(await convert(buildSwissQrPayload(), { output: "spc" }));
    assert.equal(result.mediaType, "text/plain;charset=utf-8");
    assert.ok(result.bytes);
    assert.match(new TextDecoder().decode(result.bytes), /^SPC\n/);
    assert.equal(result.invoice?.account, "CH4431999123000889012");
  });

  it("does not load the PDF adapter for PDF input", async () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    const converted = await convert(pdf);
    assert.equal(converted.ok, false);
    if (!converted.ok) assert.match(converted.error, /@qr-invoice\/pdf/);
  });
});
