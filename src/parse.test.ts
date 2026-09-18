import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { unwrap } from "./either.js";
import { buildSwissQrPayload } from "./fixtures.js";
import { extractSwissQrPayload, parseQrPayload } from "./parse.js";

describe("parseQrPayload", () => {
  it("parses a structured (S) QR-IBAN payload", () => {
    const parsed = unwrap(parseQrPayload(buildSwissQrPayload()));
    assert.equal(parsed.qrType.value, "SPC");
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

  it("parses a debtor-less payload as a missing debtor", () => {
    const parsed = unwrap(
      parseQrPayload(
        buildSwissQrPayload({
          debtorType: "",
          debtorName: "",
          debtorStreet: "",
          debtorBuilding: "",
          debtorPostal: "",
          debtorCity: "",
          debtorCountry: "",
        }),
      ),
    );
    assert.equal(parsed.debtor, null);
  });

  it("parses CRLF and a combined (K) legacy address without rewriting it", () => {
    const parsed = unwrap(
      parseQrPayload(
        buildSwissQrPayload({
          addressType: "K",
          street: "Musterstrasse 12a",
          buildingNumber: "8001 Zürich",
          postalCode: "",
          city: "",
          eol: "\r\n",
        }),
      ),
    );
    assert.equal(parsed.creditor.addressType.value, "K");
    assert.equal(parsed.creditor.street.value, "Musterstrasse 12a");
    assert.equal(parsed.creditor.buildingNumber.value, "8001 Zürich");
    assert.equal(parsed.creditor.postalCode.value, null);
  });

  it("keeps an empty amount as missing rather than inventing 0", () => {
    const parsed = unwrap(parseQrPayload(buildSwissQrPayload({ amount: "" })));
    assert.equal(parsed.amount.value, null);
    assert.equal(parsed.amount.confidence, 0);
  });

  it("does not coerce a comma amount into a number", () => {
    assert.equal(unwrap(parseQrPayload(buildSwissQrPayload({ amount: "12,50" }))).amount.value, null);
  });

  it("rejects payloads that are not Swiss Payments Code", () => {
    assert.equal(parseQrPayload("NOTSPC\n0200\n1").ok, false);
  });

  it("rejects a missing EPD trailer", () => {
    const parsed = parseQrPayload(buildSwissQrPayload().replace("\nEPD\n", "\nXXX\n"));
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.match(parsed.error, /Trailer must be EPD/);
  });
});

describe("extractSwissQrPayload", () => {
  it("returns the payload from a plain text file", () => {
    const raw = buildSwissQrPayload();
    assert.equal(unwrap(extractSwissQrPayload(raw)), raw);
  });

  it("rejects files with no SPC payload", () => {
    assert.equal(extractSwissQrPayload("%PDF-1.4 with no qr").ok, false);
  });

  it("finds SPC after a BOM and leading noise using the same stripped string", () => {
    const payload = unwrap(extractSwissQrPayload(`\uFEFFnoise\n${buildSwissQrPayload()}`));
    assert.equal(payload.split("\n")[0], "SPC");
    assert.equal(payload.split("\n")[30], "EPD");
  });
});
