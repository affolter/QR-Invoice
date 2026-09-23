/** @import { ParsedAddress } from "./models.js" */

import { TestSuite } from "../kolibri/util/test.js";
import { certain, missing, parsedAddress } from "./models.js";
import { normalizeAddress, normalizeIban, parseStreetLine } from "./normalize.js";

/**
 * @param   { Partial<Record<keyof ParsedAddress, string>> } partial
 * @returns { ParsedAddress }
 */
const rawAddress = partial => {
  /** @param { string | undefined } text */
  const value = text => (text ? certain(text, "qr") : missing("qr"));
  const type = partial.addressType ?? "K";
  return parsedAddress({
    name:           value(partial.name    ?? "Muster AG"),
    street:         value(partial.street),
    buildingNumber: value(partial.buildingNumber),
    postalCode:     value(partial.postalCode),
    city:           value(partial.city),
    country:        value(partial.country ?? "CH"),
    addressType:    type === "S" || type === "K" ? certain(type) : missing(),
  });
};

const streetSuite = TestSuite("parseStreetLine");

/** @type { Array<[string, string, string, boolean]> } */
const cases = [
  ["Musterstrasse 12", "Musterstrasse", "12", false],
  ["Musterstrasse 12a", "Musterstrasse", "12a", false],
  ["Musterstrasse 12 A", "Musterstrasse", "12 A", false],
  ["Seestrasse 8 B", "Seestrasse", "8 B", false],
  ["Musterstrasse 12-14", "Musterstrasse", "12-14", false],
  ["Musterstrasse 12/14", "Musterstrasse", "12/14", false],
  ["Rue du Lac 12", "Rue du Lac", "12", false],
  ["Chemin de la Gare 4bis", "Chemin de la Gare", "4bis", false],
  ["Chemin de la Gare 4 bis", "Chemin de la Gare", "4 bis", false],
];
for (const [input, street, building, ambiguous] of cases) {
  streetSuite.add(input, assert => {
    const parsed = parseStreetLine(input);
    assert.is(parsed.street, street);
    assert.is(parsed.buildingNumber, building);
    assert.is(parsed.ambiguous, ambiguous);
    assert.isTrue(parsed.confidence >= 0.8);
  });
}
streetSuite.add("does not silently guess when two independent numbers are present", assert => {
  const parsed = parseStreetLine("Route 12 Dorf 8");
  assert.is(parsed.ambiguous, true);
  assert.isTrue(parsed.confidence < 0.8);
});
streetSuite.run();

const addressSuite = TestSuite("normalizeAddress");

addressSuite.add("splits a combined K address used by legacy QR payloads", assert => {
  const normalized = normalizeAddress(
    rawAddress({ addressType: "K", street: "Musterstrasse 25a", buildingNumber: "8001 Zürich", country: "CH" }),
  );
  assert.is(normalized.street.value, "Musterstrasse");
  assert.is(normalized.buildingNumber.value, "25a");
  assert.is(normalized.postalCode.value, "8001");
  assert.is(normalized.city.value, "Zürich");
  assert.is(normalized.country.value, "CH");
  assert.is(normalized.addressType.value, "S");
  assert.is(normalized.street.source, "inferred");
});

addressSuite.add("keeps an already structured S address from the QR payload", assert => {
  const normalized = normalizeAddress(
    rawAddress({ addressType: "S", street: "Bahnhofstrasse", buildingNumber: "12", postalCode: "8001", city: "Zürich", country: "CH" }),
  );
  assert.is(normalized.street.value, "Bahnhofstrasse");
  assert.is(normalized.buildingNumber.value, "12");
  assert.is(normalized.street.source, "qr");
  assert.is(normalized.street.confidence, 1);
});

addressSuite.add("splits a structured street that still contains the building number", assert => {
  const normalized = normalizeAddress(
    rawAddress({ addressType: "S", street: "Bahnhofstrasse 12a", buildingNumber: "", postalCode: "8001", city: "Zürich", country: "CH" }),
  );
  assert.is(normalized.street.value, "Bahnhofstrasse");
  assert.is(normalized.buildingNumber.value, "12a");
  assert.is(normalized.buildingNumber.source, "inferred");
});

addressSuite.add("maps unambiguous country names and leaves unknown names for review", assert => {
  const ch = normalizeAddress(rawAddress({ addressType: "S", street: "A", postalCode: "8001", city: "Zürich", country: "Schweiz" }));
  assert.is(ch.country.value, "CH");
  assert.isTrue((ch.country.confidence ?? 0) >= 0.9);
  const mystery = normalizeAddress(rawAddress({ addressType: "S", street: "A", postalCode: "1", city: "X", country: "Helvetia" }));
  assert.is(mystery.country.value, "Helvetia");
  assert.isTrue((mystery.country.confidence ?? 0) < 0.8);
});

addressSuite.add("does not invent a city when the combined line is not zip+city", assert => {
  const normalized = normalizeAddress(
    rawAddress({ addressType: "K", street: "Musterstrasse 1", buildingNumber: "near the station", country: "CH" }),
  );
  assert.isTrue((normalized.city.confidence ?? 0) < 0.8);
  assert.is(normalized.postalCode.value, null);
});

addressSuite.run();

const ibanSuite = TestSuite("normalizeIban");

ibanSuite.add("strips spaces only", assert => {
  const parsed = normalizeIban("CH44 3199 9123 0008 8901 2");
  assert.is(parsed.value, "CH4431999123000889012");
  assert.is(parsed.confidence, 1);
});

ibanSuite.add("does not repair a truncated IBAN", assert => {
  const parsed = normalizeIban("CH4431999");
  assert.is(parsed.value, "CH4431999");
  assert.isTrue((parsed.confidence ?? 0) < 0.5);
});

ibanSuite.run();
