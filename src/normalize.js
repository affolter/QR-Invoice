/** @import { AddressType, FieldSource, InvoiceData, ParsedAddress, ParsedInvoice, Party, ReviewField } from "./models.js" */

import { certain, field, invoice, missing, needsReview, parsedAddress, party } from "./models.js";

const BUILDING_AT_END =
  /^(.+?)\s+(\d+\s*-\s*\d+|\d+\s*\/\s*\d+|\d+\s+[A-Za-z]{1,3}|\d+[a-zA-Z]{1,3}|[A-Za-z]\d+[a-zA-Z]{0,2}|\d+)$/u;
const CITY_LINE = /^(?:CH[-\s]?)?(\d{4})\s+(.+)$/u;

/** @type { Record<string, string> } */
const COUNTRIES = {
  CH:            "CH",
  LI:            "LI",
  SCHWEIZ:       "CH",
  SUISSE:        "CH",
  SVIZZERA:      "CH",
  SWITZERLAND:   "CH",
  LIECHTENSTEIN: "LI",
};

/**
 * @typedef { {
 *   street:         string | null,
 *   buildingNumber: string | null,
 *   confidence:     number,
 *   ambiguous:      boolean,
 * } } StreetParse
 */

/**
 * Split a Swiss street line. Ambiguous lines stay low-confidence and must not be auto-accepted.
 * @param   { string } line
 * @returns { StreetParse }
 * @pure
 */
export const parseStreetLine = line => {
  const trimmed = line.trim();
  if (!trimmed) {
    return { street: null, buildingNumber: null, confidence: 0, ambiguous: false };
  }
  const numbers = trimmed.match(/\d+/g)?.length ?? 0;
  const match = trimmed.match(BUILDING_AT_END);
  if (!match) {
    return numbers === 0
      ? { street: trimmed, buildingNumber: null, confidence: 0.99, ambiguous: false }
      : { street: trimmed, buildingNumber: null, confidence: 0.35, ambiguous: true };
  }
  const street = match[1]?.trim() ?? null;
  const rawBuilding = (match[2] ?? "").trim();
  const spacedLetter = /^\d+\s+[A-Za-z]{1,3}$/.test(rawBuilding);
  const range = /^\d+\s*[-/]\s*\d+$/.test(rawBuilding);
  const buildingNumber = spacedLetter
    ? rawBuilding.replace(/\s+/g, " ")
    : rawBuilding.replace(/\s*-\s*/g, "-").replace(/\s*\/\s*/g, "/").replace(/\s+/g, "");
  if (numbers > 2) {
    return { street, buildingNumber, confidence: 0.35, ambiguous: true };
  }
  if (numbers === 2 && !range) {
    return { street, buildingNumber, confidence: 0.4,  ambiguous: true };
  }
  return {
    street,
    buildingNumber,
    confidence: spacedLetter ? 0.9 : 0.97,
    ambiguous:  false,
  };
};

/**
 * @param   { string | null } raw
 * @param   { FieldSource }   source
 * @returns { import("./models.js").ParsedField<string> }
 * @pure
 */
const mapCountry = (raw, source) => {
  if (!raw) return missing(source);
  const trimmed = raw.trim();
  if (/^[A-Za-z]{2}$/.test(trimmed)) return certain(trimmed.toUpperCase(), source);
  const mapped = COUNTRIES[trimmed.toUpperCase()];
  return mapped ? field(mapped, 0.95, "inferred") : field(trimmed, 0.3, "inferred");
};

/**
 * @param   { FieldSource } source
 * @returns { ParsedAddress }
 * @pure
 */
const blank = source => parsedAddress({}, source);

/**
 * @param   { string | null } raw
 * @returns { AddressType }
 * @pure
 */
const addressTypeOf = raw => (raw === "S" || raw === "K" ? raw : "");

/**
 * @param   { import("./models.js").ParsedField<string> } parsed
 * @param   { FieldSource }                              source
 * @returns { import("./models.js").ParsedField<string> }
 * @pure
 */
const trimPresent = (parsed, source) =>
  parsed.value ? field(parsed.value.trim(), parsed.confidence, parsed.source) : missing(source);

/**
 * After normalize the address is structured (S). Own literal so `field("S")` is not `ParsedField<string>`.
 * @param   { number }      confidence
 * @param   { FieldSource } source
 * @returns { import("./models.js").ParsedField<AddressType> }
 * @pure
 */
const structuredType = (confidence, source) => ({ value: "S", confidence, source });

/**
 * @param   { ParsedAddress } address
 * @param   { FieldSource }   source
 * @returns { { street: import("./models.js").ParsedField<string>, buildingNumber: import("./models.js").ParsedField<string> } }
 * @pure
 */
const structuredStreet = (address, source) => {
  const streetRaw = address.street.value?.trim() ?? "";
  const buildingRaw = address.buildingNumber.value?.trim() ?? "";
  if (streetRaw && buildingRaw) {
    return {
      street:         field(streetRaw,   address.street.confidence,         address.street.source),
      buildingNumber: field(buildingRaw, address.buildingNumber.confidence, address.buildingNumber.source),
    };
  }
  if (streetRaw && !buildingRaw) {
    const parsed = parseStreetLine(streetRaw);
    return {
      street: parsed.street
        ? field(parsed.street, parsed.confidence, parsed.ambiguous ? "inferred" : address.street.source)
        : missing(source),
      buildingNumber: parsed.buildingNumber ? field(parsed.buildingNumber, parsed.confidence, "inferred") : missing(source),
    };
  }
  return { street: address.street, buildingNumber: address.buildingNumber };
};

/**
 * Normalize QR address type S or legacy combined K into structured fields.
 * Never invents a missing city/postal code.
 * @param   { ParsedAddress | null | undefined } input
 * @returns { ParsedAddress }
 * @pure
 */
export const normalizeAddress = input => {
  if (!input) return blank("inferred");
  const type = addressTypeOf(input.addressType.value);
  const source = input.name.source;
  const name = trimPresent(input.name, source);
  const country = mapCountry(input.country.value, input.country.source);
  const addressType = structuredType(type === "S" ? 1 : 0.7, type === "S" ? source : "inferred");

  if (type === "S" || (!type && input.postalCode.value && input.city.value)) {
    const { street, buildingNumber } = structuredStreet(input, source);
    return parsedAddress({
      addressType,
      name,
      street,
      buildingNumber,
      postalCode: trimPresent(input.postalCode, source),
      city:       trimPresent(input.city,       source),
      country,
    });
  }

  const parsedStreet = parseStreetLine((input.street.value ?? "").trim());
  const line2 = (input.buildingNumber.value ?? input.city.value ?? "").trim();
  const cityMatch = line2.match(CITY_LINE);
  const fromLine2 = cityMatch
    ? {
        postalCode: cityMatch[1]        ? field(cityMatch[1], 0.96, "inferred")          : missing("inferred"),
        city:       cityMatch[2]?.trim() ? field(cityMatch[2].trim(), 0.96, "inferred") : missing("inferred"),
      }
    : line2
      ? { city: field(line2, 0.3, "inferred"), postalCode: missing("inferred") }
      : { city: missing(source),               postalCode: missing(source) };

  return parsedAddress({
    addressType,
    name,
    street:         parsedStreet.street
      ? field(parsedStreet.street, parsedStreet.confidence, "inferred")
      : missing("inferred"),
    buildingNumber: parsedStreet.buildingNumber
      ? field(parsedStreet.buildingNumber, parsedStreet.confidence, "inferred")
      : missing("inferred"),
    postalCode:     fromLine2.postalCode.value
      ? fromLine2.postalCode
      : input.postalCode.value
        ? field(input.postalCode.value.trim(), input.postalCode.confidence, input.postalCode.source)
        : missing(source),
    city:           fromLine2.city.value
      ? fromLine2.city
      : input.city.value
        ? field(input.city.value.trim(), input.city.confidence, input.city.source)
        : missing(source),
    country,
  });
};

/**
 * Spaces and case only. Never repairs check digits.
 * @param   { string | null | undefined } raw
 * @param   { FieldSource }               [source="qr"]
 * @returns { import("./models.js").ParsedField<string> }
 * @pure
 */
export const normalizeIban = (raw, source = "qr") => {
  if (raw == null) return missing(source);
  const compact = raw.replace(/\s+/g, "").toUpperCase();
  if (!compact) return missing(source);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(compact)) return field(raw, 0.2, source);
  return field(compact, 1, source);
};

/**
 * @param   { string }        prefix
 * @param   { ParsedAddress } address
 * @returns { ReviewField[] }
 * @pure
 */
const reviewFields = (prefix, address) => {
  /** @type { Array<"name" | "street" | "buildingNumber" | "postalCode" | "city" | "country"> } */
  const keys = ["name", "street", "buildingNumber", "postalCode", "city", "country"];
  return keys.flatMap(name => {
    const parsed = address[name];
    return needsReview(parsed)
      ? [{ path: `${prefix}.${name}`, value: parsed.value, confidence: parsed.confidence, source: parsed.source }]
      : [];
  });
};

/**
 * @param   { ParsedAddress } address
 * @returns { Party | null }
 * @pure
 */
const toParty = address => {
  const name = address.name.value;
  const country = address.country.value;
  if (!name || !country) return null;
  return party({
    addressType:    address.addressType.value === "K" ? "K" : "S",
    name,
    country,
    street:         address.street.value         ?? "",
    buildingNumber: address.buildingNumber.value ?? "",
    postalCode:     address.postalCode.value     ?? "",
    city:           address.city.value           ?? "",
  });
};

/**
 * Canonical invoice. Address fields may be inferred; IBAN, amount, currency, reference are copied.
 * @param   { ParsedInvoice } parsed
 * @returns { { parsed: ParsedInvoice, invoice: InvoiceData | null, review: ReviewField[] } }
 * @pure
 */
export const normalizeInvoice = parsed => {
  const creditor = normalizeAddress(parsed.creditor);
  const debtor = parsed.debtor ? normalizeAddress(parsed.debtor) : null;
  const account = normalizeIban(parsed.account.value, parsed.account.source);
  const review = [
    ...reviewFields("creditor", creditor),
    ...(debtor ? reviewFields("debtor", debtor) : []),
    ...(needsReview(account)
      ? [{ path: "account", value: account.value, confidence: account.confidence, source: account.source }]
      : []),
  ];
  const parsedOut = { ...parsed, creditor, debtor, account };
  const creditorParty = toParty(creditor);
  const iban = account.value;
  const currency = parsed.currency.value;
  const referenceType = parsed.referenceType.value;
  if (!creditorParty || !iban || !currency || !referenceType) {
    return { parsed: parsedOut, invoice: null, review };
  }
  return {
    parsed: parsedOut,
    invoice: invoice({
      qrType:        parsed.qrType.value    ?? "SPC",
      qrVersion:     parsed.qrVersion.value ?? "0200",
      account:       iban,
      currency,
      referenceType,
      creditor:      creditorParty,
      debtor:        debtor ? toParty(debtor) : null,
      amount:        parsed.amount.value,
      reference:     parsed.reference.value ?? "",
      message:       parsed.message.value   ?? "",
      addInfos:      parsed.addInfos.value  ?? "",
      av1:           parsed.av1.value       ?? "",
      av2:           parsed.av2.value       ?? "",
    }),
    review,
  };
};
