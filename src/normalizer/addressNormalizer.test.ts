import { describe, expect, it } from "vitest";
import { certain, missing } from "../models/parsed-field.js";
import type { ParsedAddress } from "../models/address.js";
import { normalizeAddress, parseStreetLine } from "./addressNormalizer.js";

function rawAddress(partial: Partial<Record<keyof ParsedAddress, string>>): ParsedAddress {
  const source = "qr" as const;
  const field = (value: string | undefined) => (value ? certain(value, source) : missing<string>(source));
  return {
    name: field(partial.name ?? "Muster AG"),
    street: field(partial.street),
    buildingNumber: field(partial.buildingNumber),
    postalCode: field(partial.postalCode),
    city: field(partial.city),
    country: field(partial.country ?? "CH"),
    addressType: field(partial.addressType ?? "K"),
  };
}

describe("parseStreetLine (plan fixtures)", () => {
  it.each([
    ["Musterstrasse 12", "Musterstrasse", "12", false],
    ["Musterstrasse 12a", "Musterstrasse", "12a", false],
    ["Musterstrasse 12 A", "Musterstrasse", "12A", false],
    ["Musterstrasse 12-14", "Musterstrasse", "12-14", false],
    ["Rue du Lac 12", "Rue du Lac", "12", false],
    ["Chemin de la Gare 4bis", "Chemin de la Gare", "4bis", false],
  ] as const)("%s", (input, street, building, ambiguous) => {
    const parsed = parseStreetLine(input);
    expect(parsed.street).toBe(street);
    expect(parsed.buildingNumber).toBe(building);
    expect(parsed.ambiguous).toBe(ambiguous);
    expect(parsed.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("does not silently guess when two independent numbers are present", () => {
    const parsed = parseStreetLine("Route 12 Dorf 8");
    expect(parsed.ambiguous).toBe(true);
    expect(parsed.confidence).toBeLessThan(0.8);
  });
});

describe("normalizeAddress", () => {
  it("splits a combined K address used by legacy QR payloads", () => {
    const normalized = normalizeAddress(
      rawAddress({
        addressType: "K",
        street: "Musterstrasse 25a",
        buildingNumber: "8001 Zürich",
        country: "CH",
      }),
    );
    expect(normalized.street.value).toBe("Musterstrasse");
    expect(normalized.buildingNumber.value).toBe("25a");
    expect(normalized.postalCode.value).toBe("8001");
    expect(normalized.city.value).toBe("Zürich");
    expect(normalized.country.value).toBe("CH");
    expect(normalized.addressType.value).toBe("S");
    expect(normalized.street.source).toBe("inferred");
  });

  it("keeps an already structured S address from the QR payload", () => {
    const normalized = normalizeAddress(
      rawAddress({
        addressType: "S",
        street: "Bahnhofstrasse",
        buildingNumber: "12",
        postalCode: "8001",
        city: "Zürich",
        country: "CH",
      }),
    );
    expect(normalized.street.value).toBe("Bahnhofstrasse");
    expect(normalized.buildingNumber.value).toBe("12");
    expect(normalized.street.source).toBe("qr");
    expect(normalized.street.confidence).toBe(1);
  });

  it("splits a structured street that still contains the building number", () => {
    const normalized = normalizeAddress(
      rawAddress({
        addressType: "S",
        street: "Bahnhofstrasse 12a",
        buildingNumber: "",
        postalCode: "8001",
        city: "Zürich",
        country: "CH",
      }),
    );
    expect(normalized.street.value).toBe("Bahnhofstrasse");
    expect(normalized.buildingNumber.value).toBe("12a");
    expect(normalized.buildingNumber.source).toBe("inferred");
  });

  it("maps unambiguous country names and leaves unknown names for review", () => {
    const ch = normalizeAddress(rawAddress({ addressType: "S", street: "A", postalCode: "8001", city: "Zürich", country: "Schweiz" }));
    expect(ch.country.value).toBe("CH");
    expect(ch.country.confidence).toBeGreaterThanOrEqual(0.9);

    const mystery = normalizeAddress(rawAddress({ addressType: "S", street: "A", postalCode: "1", city: "X", country: "Helvetia" }));
    expect(mystery.country.value).toBe("Helvetia");
    expect(mystery.country.confidence).toBeLessThan(0.8);
  });

  it("does not invent a city when the combined line is not zip+city", () => {
    const normalized = normalizeAddress(
      rawAddress({
        addressType: "K",
        street: "Musterstrasse 1",
        buildingNumber: "near the station",
        country: "CH",
      }),
    );
    expect(normalized.city.confidence).toBeLessThan(0.8);
    expect(normalized.postalCode.value).toBeNull();
  });
});
