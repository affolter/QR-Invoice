/** @import { AddressType, ParsedAddress, ParsedInvoice } from "./models.js" */
/** @import { EitherType } from "./either.js" */

import { andThen, left, right } from "./either.js";
import { certain, fromLine, missing, parsedAddress } from "./models.js";

/** SPC line indexes, IG master version 02. Same order as build.js. */
const LINE = {
  type:                  0,
  version:               1,
  coding:                2,
  account:               3,
  creditor:              4,
  amount:               18,
  currency:             19,
  debtor:               20,
  referenceType:        27,
  reference:            28,
  message:              29,
  trailer:              30,
  additionalInformation: 31,
  av1:                  32,
  av2:                  33,
};

const MIN = LINE.trailer + 1;

/**
 * @param   { string } raw
 * @returns { string[] }
 * @pure
 */
const splitSpcLines = raw =>
  raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n+$/, "").split("\n");

/**
 * @param   { string[] } lines
 * @returns { EitherType<string, string[]> }
 * @pure
 */
const takeSpcFields = lines => {
  if (lines.length < MIN) {
    return left(`This QR payload is incomplete (${lines.length} fields; a Swiss QR-bill needs at least ${MIN}).`);
  }
  if (lines[LINE.trailer] !== "EPD") return left(`Trailer must be EPD, got ${JSON.stringify(lines[LINE.trailer])}`);
  let end = MIN;
  while (end < lines.length && end < LINE.av2 + 1 && lines[end]) end += 1;
  return right(lines.slice(0, end));
};

/**
 * Pull SPC…EPD out of a UTF-8 text file. Does not decode QR images.
 * @param   { string } raw
 * @returns { EitherType<string, string> }
 * @pure
 */
export const extractSwissQrPayload = raw => {
  const text  = raw.replace(/^\uFEFF/, "");
  const start = text.search(/SPC\r?\n/);
  if (!text.trim()) return left("The file is empty.");
  if (start < 0) {
    return left("No Swiss QR payload found. Drop a .txt / .spc file, or a PDF with an embedded Swiss QR image.");
  }
  return andThen(takeSpcFields(splitSpcLines(text.slice(start))), lines => right(lines.join("\n")));
};

/**
 * @param   { string[] } lines
 * @param   { number }   index
 * @returns { import("./models.js").ParsedField<AddressType> }
 * @pure
 */
const parseAddressType = (lines, index) => {
  const value = lines[index] ?? "";
  return value === "S" || value === "K" ? certain(value) : missing();
};

/**
 * @param   { string[] } lines
 * @param   { number }   start
 * @returns { ParsedAddress }
 * @pure
 */
const parseAddress = (lines, start) =>
  parsedAddress({
    addressType:    parseAddressType(lines, start),
    name:           fromLine(lines, start + 1),
    street:         fromLine(lines, start + 2),
    buildingNumber: fromLine(lines, start + 3),
    postalCode:     fromLine(lines, start + 4),
    city:           fromLine(lines, start + 5),
    country:        fromLine(lines, start + 6),
  });

/**
 * @param   { ParsedAddress } address
 * @returns { boolean }
 * @pure
 */
const addressHasValue = address =>
  Boolean(
    address.addressType.value    ||
    address.name.value           ||
    address.street.value         ||
    address.buildingNumber.value ||
    address.postalCode.value     ||
    address.city.value           ||
    address.country.value,
  );

/**
 * Parse a Swiss QR-bill payload (SIX IG master version 02). Combined address type K is kept as-is.
 * @param   { string } raw
 * @returns { EitherType<string, ParsedInvoice> }
 * @pure
 */
export const parseQrPayload = raw => {
  if (!raw?.trim()) return left("QR payload is empty");
  return andThen(takeSpcFields(splitSpcLines(raw.replace(/^\uFEFF/, ""))), lines => {
    if (lines[LINE.type]   !== "SPC") return left(`QR type must be SPC, got ${JSON.stringify(lines[LINE.type])}`);
    if (lines[LINE.coding] !== "1")   return left(`Coding type must be 1, got ${JSON.stringify(lines[LINE.coding])}`);
    const creditor  = parseAddress(lines, LINE.creditor);
    const debtor    = parseAddress(lines, LINE.debtor);
    const amountRaw = lines[LINE.amount] ?? "";
    return right({
      qrType:        fromLine(lines, LINE.type),
      qrVersion:     fromLine(lines, LINE.version),
      coding:        fromLine(lines, LINE.coding),
      account:       fromLine(lines, LINE.account),
      amount:        amountRaw && /^\d{1,9}(\.\d{2})?$/.test(amountRaw) ? certain(Number(amountRaw)) : missing(),
      currency:      fromLine(lines, LINE.currency),
      referenceType: fromLine(lines, LINE.referenceType),
      reference:     fromLine(lines, LINE.reference),
      message:       fromLine(lines, LINE.message),
      addInfos:      fromLine(lines, LINE.additionalInformation),
      av1:           fromLine(lines, LINE.av1),
      av2:           fromLine(lines, LINE.av2),
      trailer:       fromLine(lines, LINE.trailer),
      creditor,
      debtor:        addressHasValue(debtor) ? debtor : null,
    });
  });
};
