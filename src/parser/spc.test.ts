import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { unwrap } from "../either.js";
import { extractSwissQrPayload } from "./spc.js";
import { buildSwissQrPayload } from "./qr-payload-fixtures.js";

describe("extractSwissQrPayload", () => {
  it("returns the payload from a plain text file", () => {
    const raw = buildSwissQrPayload();
    assert.equal(unwrap(extractSwissQrPayload(raw)), raw);
  });

  it("rejects files with no SPC payload", () => {
    const extracted = extractSwissQrPayload("%PDF-1.4 with no qr");
    assert.equal(extracted.ok, false);
  });

  it("finds SPC after leading noise", () => {
    const payload = unwrap(extractSwissQrPayload(`noise\n${buildSwissQrPayload()}`));
    assert.equal(payload.split("\n")[0], "SPC");
    assert.equal(payload.split("\n")[30], "EPD");
  });
});
