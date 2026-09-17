import { describe, expect, it } from "vitest";
import { parseQrPayload } from "../parser/qrParser.js";
import { buildSwissQrPayload } from "../parser/qr-payload-fixtures.js";
import { normalizeInvoice } from "../normalizer/invoiceNormalizer.js";
import { normalizeIban } from "../normalizer/ibanNormalizer.js";
import { validateInvoice } from "./invoiceValidator.js";

describe("normalizeIban", () => {
  it("strips spaces only", () => {
    const field = normalizeIban("CH44 3199 9123 0008 8901 2");
    expect(field.value).toBe("CH4431999123000889012");
    expect(field.confidence).toBe(1);
  });

  it("does not repair a truncated IBAN", () => {
    const field = normalizeIban("CH4431999");
    expect(field.value).toBe("CH4431999");
    expect(field.confidence).toBeLessThan(0.5);
  });
});

describe("validateInvoice", () => {
  function invoiceFrom(overrides: Parameters<typeof buildSwissQrPayload>[0] = {}) {
    const parsed = parseQrPayload(buildSwissQrPayload(overrides));
    return normalizeInvoice(parsed);
  }

  it("accepts the synthetic QR-IBAN / QRR example", () => {
    const { invoice } = invoiceFrom();
    const result = validateInvoice(invoice);
    expect(result.valid).toBe(true);
  });

  it("rejects a QR-IBAN paired with NON without changing the IBAN", () => {
    const { invoice } = invoiceFrom({ referenceType: "NON", reference: "" });
    const iban = invoice?.account;
    const result = validateInvoice(invoice);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === "reference.qr-iban")).toBe(true);
    expect(invoice?.account).toBe(iban);
  });

  it("rejects an invalid QRR check digit without rewriting the reference", () => {
    const { invoice } = invoiceFrom({ reference: "210000000003139471430009010" });
    const reference = invoice?.reference;
    const result = validateInvoice(invoice);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === "reference.qrr.checksum")).toBe(true);
    expect(invoice?.reference).toBe(reference);
  });

  it("rejects a non CHF/EUR currency without mapping it", () => {
    const { invoice } = invoiceFrom({ currency: "USD" });
    expect(invoice?.currency).toBe("USD");
    const result = validateInvoice(invoice);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.field === "currency")).toBe(true);
  });

  it("warns on an open amount instead of filling one in", () => {
    const { invoice } = invoiceFrom({ amount: "" });
    expect(invoice?.amount).toBeUndefined();
    const result = validateInvoice(invoice);
    expect(result.valid).toBe(true);
    expect(result.issues.some((issue) => issue.code === "amount.empty")).toBe(true);
  });
});
