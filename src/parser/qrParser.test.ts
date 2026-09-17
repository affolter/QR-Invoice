import { describe, expect, it } from "vitest";
import { parseQrPayload, QrPayloadParseError } from "./qrParser.js";
import { buildSwissQrPayload } from "./qr-payload-fixtures.js";

describe("parseQrPayload", () => {
  it("parses a structured (S) QR-IBAN payload", () => {
    const raw = buildSwissQrPayload();
    const parsed = parseQrPayload(raw);

    expect(parsed.qrType.value).toBe("SPC");
    expect(parsed.qrVersion.value).toBe("0200");
    expect(parsed.account.value).toBe("CH4431999123000889012");
    expect(parsed.amount.value).toBe(1949.75);
    expect(parsed.currency.value).toBe("CHF");
    expect(parsed.referenceType.value).toBe("QRR");
    expect(parsed.reference.value).toBe("210000000003139471430009017");
    expect(parsed.creditor.addressType.value).toBe("S");
    expect(parsed.creditor.name.value).toBe("Robert Schneider AG");
    expect(parsed.creditor.street.value).toBe("Rue du Lac");
    expect(parsed.creditor.buildingNumber.value).toBe("1268");
    expect(parsed.creditor.postalCode.value).toBe("2501");
    expect(parsed.creditor.city.value).toBe("Biel");
    expect(parsed.creditor.country.value).toBe("CH");
    expect(parsed.debtor?.name.value).toBe("Pia-Maria Rutschmann-Schnyder");
    expect(parsed.account.source).toBe("qr");
    expect(parsed.amount.confidence).toBe(1);
  });

  it("parses CRLF and a combined (K) legacy address without rewriting it", () => {
    const raw = buildSwissQrPayload({
      addressType: "K",
      street: "Musterstrasse 12a",
      buildingNumber: "8001 Zürich",
      postalCode: "",
      city: "",
      eol: "\r\n",
    });
    const parsed = parseQrPayload(raw);
    expect(parsed.creditor.addressType.value).toBe("K");
    expect(parsed.creditor.street.value).toBe("Musterstrasse 12a");
    expect(parsed.creditor.buildingNumber.value).toBe("8001 Zürich");
    expect(parsed.creditor.postalCode.value).toBeNull();
  });

  it("keeps an empty amount as missing rather than inventing 0", () => {
    const parsed = parseQrPayload(buildSwissQrPayload({ amount: "" }));
    expect(parsed.amount.value).toBeNull();
    expect(parsed.amount.confidence).toBe(0);
  });

  it("does not coerce a comma amount into a number", () => {
    const parsed = parseQrPayload(buildSwissQrPayload({ amount: "12,50" }));
    expect(parsed.amount.value).toBeNull();
  });

  it("rejects payloads that are not Swiss Payments Code", () => {
    expect(() => parseQrPayload("NOTSPC\n0200\n1")).toThrow(QrPayloadParseError);
  });

  it("rejects a missing EPD trailer", () => {
    const raw = buildSwissQrPayload().replace("\nEPD\n", "\nXXX\n");
    expect(() => parseQrPayload(raw)).toThrow(/Trailer must be EPD/);
  });
});
