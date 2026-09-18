import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { certain, missing, type ParsedAddress } from "./models.js";
import { normalizeAddress, normalizeIban, parseStreetLine } from "./normalize.js";

function rawAddress(partial: Partial<Record<keyof ParsedAddress, string>>): ParsedAddress {
  const value = (text: string | undefined) => (text ? certain(text, "qr") : missing<string>("qr"));
  return {
    name: value(partial.name ?? "Muster AG"),
    street: value(partial.street),
    buildingNumber: value(partial.buildingNumber),
    postalCode: value(partial.postalCode),
    city: value(partial.city),
    country: value(partial.country ?? "CH"),
    addressType: certain((partial.addressType ?? "K") as "S" | "K" | "", "qr"),
  };
}

describe("parseStreetLine (plan fixtures)", () => {
  const fixtures = [
    ["Musterstrasse 12", "Musterstrasse", "12", false],
    ["Musterstrasse 12a", "Musterstrasse", "12a", false],
    ["Musterstrasse 12 A", "Musterstrasse", "12A", false],
    ["Musterstrasse 12-14", "Musterstrasse", "12-14", false],
    ["Rue du Lac 12", "Rue du Lac", "12", false],
    ["Chemin de la Gare 4bis", "Chemin de la Gare", "4bis", false],
  ] as const;
  for (const [input, street, building, ambiguous] of fixtures) {
    it(input, () => {
      const parsed = parseStreetLine(input);
      assert.equal(parsed.street, street);
      assert.equal(parsed.buildingNumber, building);
      assert.equal(parsed.ambiguous, ambiguous);
      assert.ok(parsed.confidence >= 0.8);
    });
  }
  it("does not silently guess when two independent numbers are present", () => {
    const parsed = parseStreetLine("Route 12 Dorf 8");
    assert.equal(parsed.ambiguous, true);
    assert.ok(parsed.confidence < 0.8);
  });
});

describe("normalizeAddress", () => {
  it("splits a combined K address used by legacy QR payloads", () => {
    const normalized = normalizeAddress(
      rawAddress({ addressType: "K", street: "Musterstrasse 25a", buildingNumber: "8001 Zürich", country: "CH" }),
    );
    assert.equal(normalized.street.value, "Musterstrasse");
    assert.equal(normalized.buildingNumber.value, "25a");
    assert.equal(normalized.postalCode.value, "8001");
    assert.equal(normalized.city.value, "Zürich");
    assert.equal(normalized.country.value, "CH");
    assert.equal(normalized.addressType.value, "S");
    assert.equal(normalized.street.source, "inferred");
  });

  it("keeps an already structured S address from the QR payload", () => {
    const normalized = normalizeAddress(
      rawAddress({ addressType: "S", street: "Bahnhofstrasse", buildingNumber: "12", postalCode: "8001", city: "Zürich", country: "CH" }),
    );
    assert.equal(normalized.street.value, "Bahnhofstrasse");
    assert.equal(normalized.buildingNumber.value, "12");
    assert.equal(normalized.street.source, "qr");
    assert.equal(normalized.street.confidence, 1);
  });

  it("splits a structured street that still contains the building number", () => {
    const normalized = normalizeAddress(
      rawAddress({ addressType: "S", street: "Bahnhofstrasse 12a", buildingNumber: "", postalCode: "8001", city: "Zürich", country: "CH" }),
    );
    assert.equal(normalized.street.value, "Bahnhofstrasse");
    assert.equal(normalized.buildingNumber.value, "12a");
    assert.equal(normalized.buildingNumber.source, "inferred");
  });

  it("maps unambiguous country names and leaves unknown names for review", () => {
    const ch = normalizeAddress(rawAddress({ addressType: "S", street: "A", postalCode: "8001", city: "Zürich", country: "Schweiz" }));
    assert.equal(ch.country.value, "CH");
    assert.ok((ch.country.confidence ?? 0) >= 0.9);
    const mystery = normalizeAddress(rawAddress({ addressType: "S", street: "A", postalCode: "1", city: "X", country: "Helvetia" }));
    assert.equal(mystery.country.value, "Helvetia");
    assert.ok((mystery.country.confidence ?? 0) < 0.8);
  });

  it("does not invent a city when the combined line is not zip+city", () => {
    const normalized = normalizeAddress(
      rawAddress({ addressType: "K", street: "Musterstrasse 1", buildingNumber: "near the station", country: "CH" }),
    );
    assert.ok((normalized.city.confidence ?? 0) < 0.8);
    assert.equal(normalized.postalCode.value, null);
  });
});

describe("normalizeIban", () => {
  it("strips spaces only", () => {
    const parsed = normalizeIban("CH44 3199 9123 0008 8901 2");
    assert.equal(parsed.value, "CH4431999123000889012");
    assert.equal(parsed.confidence, 1);
  });

  it("does not repair a truncated IBAN", () => {
    const parsed = normalizeIban("CH4431999");
    assert.equal(parsed.value, "CH4431999");
    assert.ok((parsed.confidence ?? 0) < 0.5);
  });
});
