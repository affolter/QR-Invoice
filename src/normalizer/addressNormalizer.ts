import type { AddressType, ParsedAddress } from "../models/address.js";
import { certain, missing, parsedField } from "../models/parsed-field.js";
import type { FieldSource } from "../models/parsed-field.js";

const BUILDING_AT_END =
  /^(.+?)\s+(\d+[a-zA-Z]{0,3}|\d+\s*-\s*\d+|\d+\s+[A-Za-z]|[A-Za-z]?\d+[a-zA-Z]{0,2})$/u;

const CITY_LINE = /^(?:CH[-\s]?)?(\d{4})\s+(.+)$/u;
const COUNTRY_NAMES: Record<string, string> = {
  CH: "CH",
  LI: "LI",
  SCHWEIZ: "CH",
  SUISSE: "CH",
  SVIZZERA: "CH",
  SWITZERLAND: "CH",
  LIECHTENSTEIN: "LI",
};

function collapseBuilding(token: string): string {
  return token.replace(/\s+/g, "").replace(/\s*-\s*/g, "-");
}

function countNumberTokens(line: string): number {
  const matches = line.match(/\d+/g);
  return matches ? matches.length : 0;
}

function mapCountry(raw: string | null, source: FieldSource) {
  if (!raw) {
    return missing<string>(source);
  }
  const trimmed = raw.trim();
  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    return certain(trimmed.toUpperCase(), source);
  }
  const mapped = COUNTRY_NAMES[trimmed.toUpperCase()];
  if (mapped) {
    return parsedField(mapped, 0.95, "inferred");
  }
  return parsedField(trimmed, 0.3, "inferred");
}

export type StreetParse = {  street: string | null;
  buildingNumber: string | null;
  confidence: number;
  ambiguous: boolean;
}

/**
 * Split a Swiss street line into street + building number.
 * Ambiguous lines are returned with low confidence and must not be auto-accepted.
 */
export function parseStreetLine(line: string): StreetParse {
  const trimmed = line.trim();
  if (!trimmed) {
    return { street: null, buildingNumber: null, confidence: 0, ambiguous: false };
  }

  const numbers = countNumberTokens(trimmed);
  const match = trimmed.match(BUILDING_AT_END);
  if (!match) {
    if (numbers === 0) {
      return { street: trimmed, buildingNumber: null, confidence: 0.99, ambiguous: false };
    }
    return { street: trimmed, buildingNumber: null, confidence: 0.35, ambiguous: true };
  }

  const street = match[1]?.trim() ?? null;
  const buildingNumber = collapseBuilding(match[2] ?? "");
  if (numbers > 2) {
    return { street, buildingNumber, confidence: 0.35, ambiguous: true };
  }
  if (numbers === 2 && !/^\d+\s*-\s*\d+$/.test(match[2] ?? "")) {
    return { street, buildingNumber, confidence: 0.4, ambiguous: true };
  }
  const confidence = /\s[A-Za-z]$/.test(match[2] ?? "") ? 0.9 : 0.97;
  return { street, buildingNumber, confidence, ambiguous: false };
}

function emptyAddress(source: FieldSource): ParsedAddress {
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

/**
 * Normalize a QR address (structured S or legacy combined K) into current structured fields.
 * Never invents missing city/postal code. Ambiguous street splits are flagged with low confidence.
 */
export function normalizeAddress(input: ParsedAddress | null | undefined): ParsedAddress {
  if (!input) {
    return emptyAddress("inferred");
  }

  const type = (input.addressType.value ?? "") as AddressType;
  const source = input.name.source;
  const result: ParsedAddress = {
    name: input.name.value ? parsedField(input.name.value.trim(), input.name.confidence, input.name.source) : missing(source),
    street: missing(source),
    buildingNumber: missing(source),
    postalCode: missing(source),
    city: missing(source),
    country: mapCountry(input.country.value, input.country.source),
    addressType: parsedField("S", type === "S" ? 1 : 0.7, type === "S" ? source : "inferred"),
  };

  if (type === "S" || (!type && input.postalCode.value && input.city.value)) {
    const streetRaw = input.street.value?.trim() ?? "";
    const buildingRaw = input.buildingNumber.value?.trim() ?? "";

    if (streetRaw && buildingRaw) {
      result.street = parsedField(streetRaw, input.street.confidence, input.street.source);
      result.buildingNumber = parsedField(buildingRaw, input.buildingNumber.confidence, input.buildingNumber.source);
    } else if (streetRaw && !buildingRaw) {
      const parsed = parseStreetLine(streetRaw);
      result.street = parsedField(parsed.street, parsed.confidence, parsed.ambiguous ? "inferred" : input.street.source);
      result.buildingNumber = parsed.buildingNumber
        ? parsedField(parsed.buildingNumber, parsed.confidence, "inferred")
        : missing(source);
    } else {
      result.street = input.street;
      result.buildingNumber = input.buildingNumber;
    }

    result.postalCode = input.postalCode.value
      ? parsedField(input.postalCode.value.trim(), input.postalCode.confidence, input.postalCode.source)
      : missing(source);
    result.city = input.city.value
      ? parsedField(input.city.value.trim(), input.city.confidence, input.city.source)
      : missing(source);
    return result;
  }

  // Combined address (K) or unstructured leftover: line1 street, line2 zip+city
  // In type K, street holds address line 1 and buildingNumber holds address line 2.
  const line1 = (input.street.value ?? "").trim();
  const line2 = (input.buildingNumber.value ?? input.city.value ?? "").trim();

  const parsedStreet = parseStreetLine(line1);
  result.street = parsedField(parsedStreet.street, parsedStreet.confidence, "inferred");
  result.buildingNumber = parsedStreet.buildingNumber
    ? parsedField(parsedStreet.buildingNumber, parsedStreet.confidence, "inferred")
    : missing("inferred");

  const cityMatch = line2.match(CITY_LINE);
  if (cityMatch) {
    result.postalCode = parsedField(cityMatch[1] ?? null, 0.96, "inferred");
    result.city = parsedField(cityMatch[2]?.trim() ?? null, 0.96, "inferred");
  } else if (line2) {
    result.city = parsedField(line2, 0.3, "inferred");
    result.postalCode = missing("inferred");
  }

  if (input.postalCode.value && !result.postalCode.value) {
    result.postalCode = parsedField(input.postalCode.value.trim(), input.postalCode.confidence, input.postalCode.source);
  }
  if (input.city.value && !result.city.value) {
    result.city = parsedField(input.city.value.trim(), input.city.confidence, input.city.source);
  }

  return result;
}
