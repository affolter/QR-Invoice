import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseQrPayload } from "../parser/qrParser.js";
import { buildSwissQrPayload } from "../parser/qr-payload-fixtures.js";
import { normalizeInvoice } from "../normalizer/invoiceNormalizer.js";
import { normalizeIban } from "../normalizer/ibanNormalizer.js";
import { validateInvoice } from "./invoiceValidator.js";

describe("normalizeIban", () => {
  it("strips spaces only", () => {
    const field = normalizeIban("CH44 3199 9123 0008 8901 2");
    assert.equal(field.value, "CH4431999123000889012");
    assert.equal(field.confidence, 1);
  });

  it("does not repair a truncated IBAN", () => {
    const field = normalizeIban("CH4431999");
    assert.equal(field.value, "CH4431999");
    assert.ok((field.confidence ?? 0) < 0.5);
  });
});

describe("validateInvoice", () => {
  function invoiceFrom(overrides: Parameters<typeof buildSwissQrPayload>[0] = {}) {
    return normalizeInvoice(parseQrPayload(buildSwissQrPayload(overrides)));
  }

  it("accepts the synthetic QR-IBAN / QRR example", () => {
    const { invoice } = invoiceFrom();
    assert.equal(validateInvoice(invoice).valid, true);
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
