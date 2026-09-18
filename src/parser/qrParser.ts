import { andThen, left, right, type Either } from "../either.js";
import type { AddressType, ParsedAddress } from "../models/address.js";
import type { ParsedInvoice } from "../models/invoice.js";
import { certain, fromLine, missing, parsedField } from "../models/parsed-field.js";
import { splitSpcLines, takeSpcFields } from "./spc.js";

function parseAddress(lines: string[], start: number): ParsedAddress {
  return {
    addressType: fromLine<AddressType>(lines, start),
    name: fromLine(lines, start + 1),
    street: fromLine(lines, start + 2),
    buildingNumber: fromLine(lines, start + 3),
    postalCode: fromLine(lines, start + 4),
    city: fromLine(lines, start + 5),
    country: fromLine(lines, start + 6),
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

function parseAmount(raw: string) {
  if (!raw) {
    return missing<number>("qr");
  }
  if (!/^\d{1,9}\.\d{2}$/.test(raw) && !/^\d{1,9}$/.test(raw)) {
    return parsedField<number>(null, 0, "qr");
  }
  return certain(Number(raw), "qr");
}

/** Parse a Swiss QR-bill payload (IG master version 02). Type K is left as-is. */
export function parseQrPayload(raw: string): Either<string, ParsedInvoice> {
  if (!raw?.trim()) {
    return left("QR payload is empty");
  }
  return andThen(takeSpcFields(splitSpcLines(raw)), (lines) => {
    if (lines[0] !== "SPC") {
      return left(`QR type must be SPC, got ${JSON.stringify(lines[0])}`);
    }
    if (lines[2] !== "1") {
      return left(`Coding type must be 1, got ${JSON.stringify(lines[2])}`);
    }
    const creditor = parseAddress(lines, 4);
    const debtor = parseAddress(lines, 20);
    return right({
      qrType: fromLine(lines, 0),
      qrVersion: fromLine(lines, 1),
      coding: fromLine(lines, 2),
      account: fromLine(lines, 3),
      amount: parseAmount(lines[18] ?? ""),
      currency: fromLine(lines, 19),
      referenceType: fromLine(lines, 27),
      reference: fromLine(lines, 28),
      message: fromLine(lines, 29),
      additionalInformation: fromLine(lines, 31),
      av1: fromLine(lines, 32),
      av2: fromLine(lines, 33),
      trailer: fromLine(lines, 30),
      creditor,
      debtor: addressHasContent(debtor) ? debtor : null,
    });
  });
}
