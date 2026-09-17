import { certain, missing, parsedField } from "../models/parsed-field.js";
import type { AddressType, ParsedAddress } from "../models/address.js";
import type { ParsedInvoice } from "../models/invoice.js";

const MIN_FIELDS = 31;

export class QrPayloadParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QrPayloadParseError";
  }
}

function splitPayload(raw: string): string[] {
  const normalized = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return normalized.replace(/\n+$/, "").split("\n");
}

function field(lines: string[], index: number): string {
  return lines[index] ?? "";
}

function parseAddress(lines: string[], start: number, source: "qr"): ParsedAddress {
  const addressType = field(lines, start) as AddressType;
  return {
    addressType: addressType ? certain(addressType, source) : missing(source),
    name: field(lines, start + 1) ? certain(field(lines, start + 1), source) : missing(source),
    street: field(lines, start + 2) ? certain(field(lines, start + 2), source) : missing(source),
    buildingNumber: field(lines, start + 3) ? certain(field(lines, start + 3), source) : missing(source),
    postalCode: field(lines, start + 4) ? certain(field(lines, start + 4), source) : missing(source),
    city: field(lines, start + 5) ? certain(field(lines, start + 5), source) : missing(source),
    country: field(lines, start + 6) ? certain(field(lines, start + 6), source) : missing(source),
  };
}

function addressHasContent(address: ParsedAddress): boolean {
  return Boolean(
    address.name.value ||
      address.street.value ||
      address.buildingNumber.value ||
      address.postalCode.value ||
      address.city.value ||
      address.country.value ||
      address.addressType.value,
  );
}

/**
 * Parses a Swiss QR-bill payload (SIX IG, master version 02, field order unchanged in IG 2.3).
 * Combined address type K is accepted as legacy input; it is not rewritten here.
 */
export function parseQrPayload(raw: string): ParsedInvoice {
  if (!raw || !raw.trim()) {
    throw new QrPayloadParseError("QR payload is empty");
  }

  const lines = splitPayload(raw);
  if (lines.length < MIN_FIELDS) {
    throw new QrPayloadParseError(
      `QR payload has ${lines.length} fields; Swiss QR-bill requires at least ${MIN_FIELDS}`,
    );
  }

  const qrType = field(lines, 0);
  if (qrType !== "SPC") {
    throw new QrPayloadParseError(`QR type must be SPC, got ${JSON.stringify(qrType)}`);
  }

  const coding = field(lines, 2);
  if (coding !== "1") {
    throw new QrPayloadParseError(`Coding type must be 1, got ${JSON.stringify(coding)}`);
  }

  const trailer = field(lines, 30);
  if (trailer !== "EPD") {
    throw new QrPayloadParseError(`Trailer must be EPD, got ${JSON.stringify(trailer)}`);
  }

  const amountRaw = field(lines, 18);
  let amount = missing<number>("qr");
  if (amountRaw) {
    if (!/^\d{1,9}\.\d{2}$/.test(amountRaw) && !/^\d{1,9}$/.test(amountRaw)) {
      amount = parsedField<number>(null, 0, "qr");
    } else {
      amount = certain(Number(amountRaw), "qr");
    }
  }

  const creditor = parseAddress(lines, 4, "qr");
  const debtorRaw = parseAddress(lines, 20, "qr");

  return {
    qrType: certain(qrType, "qr"),
    qrVersion: certain(field(lines, 1), "qr"),
    coding: certain(coding, "qr"),
    account: field(lines, 3) ? certain(field(lines, 3), "qr") : missing("qr"),
    amount,
    currency: field(lines, 19) ? certain(field(lines, 19), "qr") : missing("qr"),
    referenceType: field(lines, 27) ? certain(field(lines, 27), "qr") : missing("qr"),
    reference: field(lines, 28) ? certain(field(lines, 28), "qr") : missing("qr"),
    message: field(lines, 29) ? certain(field(lines, 29), "qr") : missing("qr"),
    additionalInformation: field(lines, 31) ? certain(field(lines, 31), "qr") : missing("qr"),
    av1: field(lines, 32) ? certain(field(lines, 32), "qr") : missing("qr"),
    av2: field(lines, 33) ? certain(field(lines, 33), "qr") : missing("qr"),
    trailer: certain(trailer, "qr"),
    creditor,
    debtor: addressHasContent(debtorRaw) ? debtorRaw : null,
  };
}
