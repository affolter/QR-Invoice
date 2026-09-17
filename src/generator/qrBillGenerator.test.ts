import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseQrPayload } from "../parser/qrParser.js";
import { buildSwissQrPayload } from "../parser/qr-payload-fixtures.js";
import { normalizeInvoice } from "../normalizer/invoiceNormalizer.js";
import { buildQrPayload } from "./qrBillGenerator.js";

describe("buildQrPayload", () => {
  it("emits SPC text and round-trips structured fields without changing the IBAN", () => {
    const raw = buildSwissQrPayload();
    const { invoice } = normalizeInvoice(parseQrPayload(raw));
    assert.ok(invoice);
    const built = buildQrPayload(invoice);
    assert.match(built, /^SPC\n0200\n1\n/);
    const again = parseQrPayload(built);
    assert.equal(again.account.value, invoice.account);
    assert.equal(again.amount.value, invoice.amount);
    assert.equal(again.currency.value, invoice.currency);
    assert.equal(again.reference.value, invoice.reference);
    assert.equal(again.creditor.addressType.value, "S");
    assert.equal(again.creditor.street.value, "Rue du Lac");
    assert.equal(again.creditor.buildingNumber.value, "1268");
  });
});
