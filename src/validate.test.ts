import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { unwrap } from "./either.js";
import { buildSwissQrPayload } from "./fixtures.js";
import { normalizeInvoice } from "./normalize.js";
import { parseQrPayload } from "./parse.js";
import { validateInvoice } from "./validate.js";

describe("validateInvoice", () => {
  function invoiceFrom(overrides: Parameters<typeof buildSwissQrPayload>[0] = {}) {
    return normalizeInvoice(unwrap(parseQrPayload(buildSwissQrPayload(overrides))));
  }

  it("accepts the synthetic QR-IBAN / QRR example", () => {
    assert.equal(validateInvoice(invoiceFrom().invoice).valid, true);
  });

  it("rejects a QR-IBAN paired with NON without changing the IBAN", () => {
    const { invoice } = invoiceFrom({ referenceType: "NON", reference: "" });
    const iban = invoice?.account;
    const result = validateInvoice(invoice);
    assert.equal(result.valid, false);
    assert.ok(result.issues.some((issue) => issue.code === "reference.qr-iban"));
    assert.equal(invoice?.account, iban);
  });

  it("rejects an invalid QRR check digit without rewriting the reference", () => {
    const { invoice } = invoiceFrom({ reference: "210000000003139471430009010" });
    const reference = invoice?.reference;
    const result = validateInvoice(invoice);
    assert.equal(result.valid, false);
    assert.ok(result.issues.some((issue) => issue.code === "reference.qrr.checksum"));
    assert.equal(invoice?.reference, reference);
  });

  it("rejects a non CHF/EUR currency without mapping it", () => {
    const { invoice } = invoiceFrom({ currency: "USD" });
    assert.equal(invoice?.currency, "USD");
    const result = validateInvoice(invoice);
    assert.equal(result.valid, false);
    assert.ok(result.issues.some((issue) => issue.field === "currency"));
  });

  it("warns on an open amount instead of filling one in", () => {
    const { invoice } = invoiceFrom({ amount: "" });
    assert.equal(invoice?.amount, undefined);
    const result = validateInvoice(invoice);
    assert.equal(result.valid, true);
    assert.ok(result.issues.some((issue) => issue.code === "amount.empty"));
  });
});
