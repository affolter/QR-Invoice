import type { AddressType, FieldSource, InvoiceData, ParsedAddress, ParsedInvoice, ReviewField } from "./models.js";
import { certain, copyIfPresent, field, missing, needsReview } from "./models.js";

const BUILDING_AT_END =
  /^(.+?)\s+(\d+[a-zA-Z]{0,3}|\d+\s*-\s*\d+|\d+\s+[A-Za-z]|[A-Za-z]?\d+[a-zA-Z]{0,2})$/u;
const CITY_LINE = /^(?:CH[-\s]?)?(\d{4})\s+(.+)$/u;
const COUNTRIES: Record<string, string> = {
  CH: "CH",
  LI: "LI",
  SCHWEIZ: "CH",
  SUISSE: "CH",
  SVIZZERA: "CH",
  SWITZERLAND: "CH",
  LIECHTENSTEIN: "LI",
};

export function parseStreetLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return { street: null, buildingNumber: null, confidence: 0, ambiguous: false };
  const numbers = trimmed.match(/\d+/g)?.length ?? 0;
  const match = trimmed.match(BUILDING_AT_END);
  if (!match) {
    return numbers === 0
      ? { street: trimmed, buildingNumber: null, confidence: 0.99, ambiguous: false }
      : { street: trimmed, buildingNumber: null, confidence: 0.35, ambiguous: true };
  }
  const street = match[1]?.trim() ?? null;
  const buildingNumber = (match[2] ?? "").replace(/\s+/g, "").replace(/\s*-\s*/g, "-");
  if (numbers > 2) return { street, buildingNumber, confidence: 0.35, ambiguous: true };
  if (numbers === 2 && !/^\d+\s*-\s*\d+$/.test(match[2] ?? "")) {
    return { street, buildingNumber, confidence: 0.4, ambiguous: true };
  }
  return {
    street,
    buildingNumber,
    confidence: /\s[A-Za-z]$/.test(match[2] ?? "") ? 0.9 : 0.97,
    ambiguous: false,
  };
}

function mapCountry(raw: string | null, source: FieldSource) {
  if (!raw) return missing<string>(source);
  const trimmed = raw.trim();
  if (/^[A-Za-z]{2}$/.test(trimmed)) return certain(trimmed.toUpperCase(), source);
  const mapped = COUNTRIES[trimmed.toUpperCase()];
  return mapped ? field(mapped, 0.95, "inferred") : field(trimmed, 0.3, "inferred");
}

function blank(source: FieldSource): ParsedAddress {
  return {
    name: missing(source),
    street: missing(source),
    buildingNumber: missing(source),
    postalCode: missing(source),
    city: missing(source),
    country: missing(source),
    addressType: missing(source),
  };
}

export function normalizeAddress(input: ParsedAddress | null | undefined): ParsedAddress {
  if (!input) return blank("inferred");
  const type = (input.addressType.value ?? "") as AddressType;
  const source = input.name.source;
  const result: ParsedAddress = {
    name: input.name.value ? field(input.name.value.trim(), input.name.confidence, input.name.source) : missing(source),
    street: missing(source),
    buildingNumber: missing(source),
    postalCode: missing(source),
    city: missing(source),
    country: mapCountry(input.country.value, input.country.source),
    addressType: field("S", type === "S" ? 1 : 0.7, type === "S" ? source : "inferred"),
  };

  if (type === "S" || (!type && input.postalCode.value && input.city.value)) {
    const streetRaw = input.street.value?.trim() ?? "";
    const buildingRaw = input.buildingNumber.value?.trim() ?? "";
    if (streetRaw && buildingRaw) {
      result.street = field(streetRaw, input.street.confidence, input.street.source);
      result.buildingNumber = field(buildingRaw, input.buildingNumber.confidence, input.buildingNumber.source);
    } else if (streetRaw && !buildingRaw) {
      const parsed = parseStreetLine(streetRaw);
      result.street = field(parsed.street, parsed.confidence, parsed.ambiguous ? "inferred" : input.street.source);
      result.buildingNumber = parsed.buildingNumber ? field(parsed.buildingNumber, parsed.confidence, "inferred") : missing(source);
    } else {
      result.street = input.street;
      result.buildingNumber = input.buildingNumber;
    }
    result.postalCode = input.postalCode.value
      ? field(input.postalCode.value.trim(), input.postalCode.confidence, input.postalCode.source)
      : missing(source);
    result.city = input.city.value
      ? field(input.city.value.trim(), input.city.confidence, input.city.source)
      : missing(source);
    return result;
  }

  const parsedStreet = parseStreetLine((input.street.value ?? "").trim());
  result.street = field(parsedStreet.street, parsedStreet.confidence, "inferred");
  result.buildingNumber = parsedStreet.buildingNumber
    ? field(parsedStreet.buildingNumber, parsedStreet.confidence, "inferred")
    : missing("inferred");
  const cityMatch = (input.buildingNumber.value ?? input.city.value ?? "").trim().match(CITY_LINE);
  if (cityMatch) {
    result.postalCode = field(cityMatch[1] ?? null, 0.96, "inferred");
    result.city = field(cityMatch[2]?.trim() ?? null, 0.96, "inferred");
  } else if ((input.buildingNumber.value ?? input.city.value ?? "").trim()) {
    result.city = field((input.buildingNumber.value ?? input.city.value ?? "").trim(), 0.3, "inferred");
    result.postalCode = missing("inferred");
  }
  if (input.postalCode.value && !result.postalCode.value) {
    result.postalCode = field(input.postalCode.value.trim(), input.postalCode.confidence, input.postalCode.source);
  }
  if (input.city.value && !result.city.value) {
    result.city = field(input.city.value.trim(), input.city.confidence, input.city.source);
  }
  return result;
}

export function normalizeIban(raw: string | null | undefined, source: FieldSource = "qr") {
  if (raw == null) return missing<string>(source);
  const compact = raw.replace(/\s+/g, "").toUpperCase();
  if (!compact) return missing<string>(source);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(compact)) return field(raw, 0.2, source);
  return field(compact, 1, source);
}

function flagReview(prefix: string, address: ParsedAddress, review: ReviewField[]): void {
  for (const name of ["name", "street", "buildingNumber", "postalCode", "city", "country"] as const) {
    const parsed = address[name];
    if (needsReview(parsed)) {
      review.push({ path: `${prefix}.${name}`, value: parsed.value, confidence: parsed.confidence, source: parsed.source });
    }
  }
}

function toParty(address: ParsedAddress, account?: string) {
  const party: Record<string, unknown> = { name: address.name.value, country: address.country.value };
  copyIfPresent(party, "street", address.street);
  copyIfPresent(party, "buildingNumber", address.buildingNumber);
  copyIfPresent(party, "postalCode", address.postalCode);
  copyIfPresent(party, "city", address.city);
  if (account) party.account = account;
  return party;
}

export function normalizeInvoice(parsed: ParsedInvoice) {
  const review: ReviewField[] = [];
  const creditor = normalizeAddress(parsed.creditor);
  const debtor = parsed.debtor ? normalizeAddress(parsed.debtor) : null;
  const account = normalizeIban(parsed.account.value, parsed.account.source);
  flagReview("creditor", creditor, review);
  if (debtor) flagReview("debtor", debtor, review);
  if (needsReview(account)) {
    review.push({ path: "account", value: account.value, confidence: account.confidence, source: account.source });
  }
  const parsedOut = { ...parsed, creditor, debtor, account };
  const name = creditor.name.value;
  const country = creditor.country.value;
  const iban = account.value;
  const currency = parsed.currency.value;
  const referenceType = parsed.referenceType.value;
  if (!name || !country || !iban || !currency || !referenceType) {
    return { parsed: parsedOut, invoice: null as InvoiceData | null, review };
  }
  const invoice = {
    qrType: parsed.qrType.value ?? "SPC",
    qrVersion: parsed.qrVersion.value ?? "0200",
    account: iban,
    currency,
    referenceType,
    creditor: toParty(creditor, iban),
  } as InvoiceData;
  for (const key of ["amount", "reference", "message", "additionalInformation", "av1", "av2"] as const) {
    copyIfPresent(invoice, key, parsed[key]);
  }
  if (debtor?.name.value && debtor.country.value) invoice.debtor = toParty(debtor) as InvoiceData["debtor"];
  return { parsed: parsedOut, invoice, review };
}
