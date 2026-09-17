import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseQrPayload, QrPayloadParseError } from "./qrParser.js";
import { buildSwissQrPayload } from "./qr-payload-fixtures.js";

describe("parseQrPayload", () => {
  it("parses a structured (S) QR-IBAN payload", () => {
    const parsed = parseQrPayload(buildSwissQrPayload());
    assert.equal(parsed.qrType.value, "SPC");
    assert.equal(parsed.qrVersion.value, "0200");
    assert.equal(parsed.account.value, "CH4431999123000889012");
    assert.equal(parsed.amount.value, 1949.75);
    assert.equal(parsed.currency.value, "CHF");
    assert.equal(parsed.referenceType.value, "QRR");
    assert.equal(parsed.reference.value, "210000000003139471430009017");
    assert.equal(parsed.creditor.addressType.value, "S");
    assert.equal(parsed.creditor.name.value, "Robert Schneider AG");
    assert.equal(parsed.creditor.street.value, "Rue du Lac");
    assert.equal(parsed.creditor.buildingNumber.value, "1268");
    assert.equal(parsed.creditor.postalCode.value, "2501");
    assert.equal(parsed.creditor.city.value, "Biel");
    assert.equal(parsed.creditor.country.value, "CH");
    assert.equal(parsed.debtor?.name.value, "Pia-Maria Rutschmann-Schnyder");
    assert.equal(parsed.account.source, "qr");
    assert.equal(parsed.amount.confidence, 1);
  });

  it("parses CRLF and a combined (K) legacy address without rewriting it", () => {
    const parsed = parseQrPayload(
      buildSwissQrPayload({
        addressType: "K",
        street: "Musterstrasse 12a",
        buildingNumber: "8001 Zürich",
        postalCode: "",
        city: "",
        eol: "\r\n",
      }),
    );
    assert.equal(parsed.creditor.addressType.value, "K");
    assert.equal(parsed.creditor.street.value, "Musterstrasse 12a");
    assert.equal(parsed.creditor.buildingNumber.value, "8001 Zürich");
    assert.equal(parsed.creditor.postalCode.value, null);
  });

  it("keeps an empty amount as missing rather than inventing 0", () => {
    const parsed = parseQrPayload(buildSwissQrPayload({ amount: "" }));
    assert.equal(parsed.amount.value, null);
    assert.equal(parsed.amount.confidence, 0);
  });

  it("does not coerce a comma amount into a number", () => {
    const parsed = parseQrPayload(buildSwissQrPayload({ amount: "12,50" }));
    assert.equal(parsed.amount.value, null);
  });

  it("rejects payloads that are not Swiss Payments Code", () => {
    assert.throws(() => parseQrPayload("NOTSPC\n0200\n1"), QrPayloadParseError);
  });

  it("rejects a missing EPD trailer", () => {
    const raw = buildSwissQrPayload().replace("\nEPD\n", "\nXXX\n");
    assert.throws(() => parseQrPayload(raw), /Trailer must be EPD/);
  });
});
