/** @import { AddressType, ParsedAddress, ParsedField, ParsedInvoice } from "./models.js" */
/** @import { EitherType } from "./either.js" */

import { andThen, left, right } from "./either.js";
import { certain, field, fromLine, missing } from "./models.js";

const MIN = 31;

/**
 * @param   { string } raw
 * @returns { string[] }
 * @pure
 */
function splitSpcLines(raw) {
  return raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n+$/, "").split("\n");
}

/**
 * @param   { string[] } lines
 * @returns { EitherType<string, string[]> }
 * @pure
 */
function takeSpcFields(lines) {
  if (lines.length < MIN) return left(`QR payload has ${lines.length} fields; Swiss QR-bill requires at least ${MIN}`);
  if (lines[30] !== "EPD") return left(`Trailer must be EPD, got ${JSON.stringify(lines[30])}`);
  let end = MIN;
  while (end < lines.length && end < 34 && lines[end]) end += 1;
  return right(lines.slice(0, end));
}

/**
 * Pull SPC…EPD out of a UTF-8 text file. Does not decode QR images.
 * @param   { string } raw
 * @returns { EitherType<string, string> }
 * @pure
 */
export function extractSwissQrPayload(raw) {
  const text = raw.replace(/^\uFEFF/, "");
  const start = text.search(/SPC\r?\n/);
  if (start < 0) return left("No Swiss QR payload (SPC … EPD) found. Pass a .txt/.spc payload file.");
  return andThen(takeSpcFields(splitSpcLines(text.slice(start))), lines => right(lines.join("\n")));
}

/**
 * @param   { string[] } lines
 * @param   { number }   index
 * @returns { ParsedField<AddressType> }
 * @pure
 */
function parseAddressType(lines, index) {
  const value = lines[index] ?? "";
  if (value === "S" || value === "K") return certain(value);
  return missing();
}

/**
 * @param   { string[] } lines
 * @param   { number }   start
 * @returns { ParsedAddress }
 * @pure
 */
function parseAddress(lines, start) {
  return {
    addressType: parseAddressType(lines, start),
    name: fromLine(lines, start + 1),
    street: fromLine(lines, start + 2),
    buildingNumber: fromLine(lines, start + 3),
    postalCode: fromLine(lines, start + 4),
    city: fromLine(lines, start + 5),
    country: fromLine(lines, start + 6),
  };
}

/**
 * Parse a Swiss QR-bill payload (SIX IG master version 02). Combined address type K is kept as-is.
 * @param   { string } raw
 * @returns { EitherType<string, ParsedInvoice> }
 * @pure
 */
export function parseQrPayload(raw) {
  if (!raw?.trim()) return left("QR payload is empty");
  return andThen(takeSpcFields(splitSpcLines(raw.replace(/^\uFEFF/, ""))), lines => {
    if (lines[0] !== "SPC") return left(`QR type must be SPC, got ${JSON.stringify(lines[0])}`);
    if (lines[2] !== "1") return left(`Coding type must be 1, got ${JSON.stringify(lines[2])}`);
    const creditor = parseAddress(lines, 4);
    const debtor = parseAddress(lines, 20);
    const amountRaw = lines[18] ?? "";
    return right({
      qrType: fromLine(lines, 0),
      qrVersion: fromLine(lines, 1),
      coding: fromLine(lines, 2),
      account: fromLine(lines, 3),
      amount: !amountRaw
        ? /** @type { import("./models.js").ParsedField<number> } */ (missing())
        : /^\d{1,9}(\.\d{2})?$/.test(amountRaw)
          ? certain(Number(amountRaw))
          : field(/** @type { number | null } */ (null), 0, "qr"),
      currency: fromLine(lines, 19),
      referenceType: fromLine(lines, 27),
      reference: fromLine(lines, 28),
      message: fromLine(lines, 29),
      additionalInformation: fromLine(lines, 31),
      av1: fromLine(lines, 32),
      av2: fromLine(lines, 33),
      trailer: fromLine(lines, 30),
      creditor,
      debtor: Object.values(debtor).some(item => item.value) ? debtor : null,
    });
  });
}
