import { TestSuite } from "../kolibri/util/test.js";
import { unwrap } from "./either.js";
import { buildSwissQrPayload } from "./synthetic.js";
import { extractSwissQrPayload, parseQrPayload } from "./parse.js";

const parseSuite = TestSuite("parseQrPayload");

parseSuite.add("parses a structured (S) QR-IBAN payload", assert => {
  const parsed = unwrap(parseQrPayload(buildSwissQrPayload()));
  assert.is(parsed.qrType.value, "SPC");
  assert.is(parsed.account.value, "CH4431999123000889012");
  assert.is(parsed.amount.value, 1949.75);
  assert.is(parsed.currency.value, "CHF");
  assert.is(parsed.referenceType.value, "QRR");
  assert.is(parsed.reference.value, "210000000003139471430009017");
  assert.is(parsed.creditor.addressType.value, "S");
  assert.is(parsed.creditor.name.value, "Robert Schneider AG");
  assert.is(parsed.creditor.street.value, "Rue du Lac");
  assert.is(parsed.creditor.buildingNumber.value, "1268");
  assert.is(parsed.creditor.postalCode.value, "2501");
  assert.is(parsed.creditor.city.value, "Biel");
  assert.is(parsed.creditor.country.value, "CH");
  assert.is(parsed.debtor?.name.value, "Pia-Maria Rutschmann-Schnyder");
  assert.is(parsed.account.source, "qr");
  assert.is(parsed.amount.confidence, 1);
});

parseSuite.add("parses a debtor-less payload as a missing debtor", assert => {
  const parsed = unwrap(
    parseQrPayload(
      buildSwissQrPayload({
        debtorType: "",
        debtorName: "",
        debtorStreet: "",
        debtorBuilding: "",
        debtorPostal: "",
        debtorCity: "",
        debtorCountry: "",
      }),
    ),
  );
  assert.is(parsed.debtor, null);
});

parseSuite.add("parses CRLF and a combined (K) legacy address without rewriting it", assert => {
  const parsed = unwrap(
    parseQrPayload(
      buildSwissQrPayload({
        addressType: "K",
        street: "Musterstrasse 12a",
        buildingNumber: "8001 Zürich",
        postalCode: "",
        city: "",
        eol: "\r\n",
      }),
    ),
  );
  assert.is(parsed.creditor.addressType.value, "K");
  assert.is(parsed.creditor.street.value, "Musterstrasse 12a");
  assert.is(parsed.creditor.buildingNumber.value, "8001 Zürich");
  assert.is(parsed.creditor.postalCode.value, null);
});

parseSuite.add("keeps an empty amount as missing rather than inventing 0", assert => {
  const parsed = unwrap(parseQrPayload(buildSwissQrPayload({ amount: "" })));
  assert.is(parsed.amount.value, null);
  assert.is(parsed.amount.confidence, 0);
});

parseSuite.add("does not coerce a comma amount into a number", assert => {
  assert.is(unwrap(parseQrPayload(buildSwissQrPayload({ amount: "12,50" }))).amount.value, null);
});

parseSuite.add("rejects payloads that are not Swiss Payments Code", assert => {
  assert.is(parseQrPayload("NOTSPC\n0200\n1").ok, false);
});

parseSuite.add("rejects a missing EPD trailer", assert => {
  const parsed = parseQrPayload(buildSwissQrPayload().replace("\nEPD\n", "\nXXX\n"));
  assert.is(parsed.ok, false);
  if (!parsed.ok) assert.isTrue(/Trailer must be EPD/.test(parsed.error));
});

parseSuite.run();

const extractSuite = TestSuite("extractSwissQrPayload");

extractSuite.add("returns the payload from a plain text file", assert => {
  const raw = buildSwissQrPayload();
  assert.is(unwrap(extractSwissQrPayload(raw)), raw);
});

extractSuite.add("rejects files with no SPC payload", assert => {
  const extracted = extractSwissQrPayload("%PDF-1.4 with no qr");
  assert.is(extracted.ok, false);
  if (!extracted.ok) assert.isTrue(/No Swiss QR payload found/.test(extracted.error));
});

extractSuite.add("rejects an empty file with a plain message", assert => {
  const extracted = extractSwissQrPayload("   ");
  assert.is(extracted.ok, false);
  if (!extracted.ok) assert.is(extracted.error, "The file is empty.");
});

extractSuite.add("finds SPC after a BOM and leading noise using the same stripped string", assert => {
  const payload = unwrap(extractSwissQrPayload(`\uFEFFnoise\n${buildSwissQrPayload()}`));
  assert.is(payload.split("\n")[0], "SPC");
  assert.is(payload.split("\n")[30], "EPD");
});

extractSuite.run();
