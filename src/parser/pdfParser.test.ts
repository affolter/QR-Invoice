import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractSwissQrPayload } from "./pdfParser.js";
import { buildSwissQrPayload } from "./qr-payload-fixtures.js";
import { QrPayloadParseError } from "./qrParser.js";

describe("extractSwissQrPayload", () => {
  it("returns the payload from a plain text file", () => {
    const raw = buildSwissQrPayload();
    assert.equal(extractSwissQrPayload(raw), raw);
  });

  it("rejects files with no SPC payload", () => {
    assert.throws(() => extractSwissQrPayload("%PDF-1.4 with no qr"), QrPayloadParseError);
  });
});
