import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { unwrap } from "./either.js";
import { buildQrPayload } from "./build.js";
import { buildSwissQrPayload } from "./fixtures.js";
import { normalizeInvoice } from "./normalize.js";
import { parseQrPayload } from "./parse.js";

describe("buildQrPayload", () => {
  it("emits SPC text and round-trips structured fields without changing the IBAN", () => {
    const { invoice } = normalizeInvoice(unwrap(parseQrPayload(buildSwissQrPayload())));
    assert.ok(invoice);
    const built = buildQrPayload(invoice);
    assert.match(built, /^SPC\n0200\n1\n/);
    const again = unwrap(parseQrPayload(built));
    assert.equal(again.account.value, invoice.account);
    assert.equal(again.amount.value, invoice.amount);
    assert.equal(again.currency.value, invoice.currency);
    assert.equal(again.reference.value, invoice.reference);
    assert.equal(again.creditor.addressType.value, "S");
    assert.equal(again.creditor.street.value, "Rue du Lac");
    assert.equal(again.creditor.buildingNumber.value, "1268");
  });
});
