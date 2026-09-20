import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyze, canWrite } from "./backend.js";
import { unwrap } from "./either.js";
import { reviewPayload } from "./fixtures.js";
import { applyAddressReview } from "./review.js";

describe("applyAddressReview", () => {
  it("blocks write until the ambiguous street is reviewed", () => {
    const result = unwrap(analyze(reviewPayload()));
    assert.ok(result.review.some(item => item.path === "creditor.street"));
    assert.equal(canWrite(result, {}).ok, false);
    assert.equal(result.invoice?.account, "CH4431999123000889012");
  });

  it("applies address edits and leaves money fields alone", () => {
    const result = unwrap(analyze(reviewPayload()));
    assert.ok(result.invoice);
    const applied = applyAddressReview(result.invoice, {
      "creditor.street": "Bahnhofstrasse",
      "creditor.buildingNumber": "12",
      account: "CH9300762011623852957",
      amount: "1.00",
      currency: "EUR",
      reference: "000",
      referenceType: "NON",
      "creditor.account": "AT123",
    });
    assert.equal(applied.invoice.creditor.street, "Bahnhofstrasse");
    assert.equal(applied.invoice.creditor.buildingNumber, "12");
    assert.equal(applied.invoice.account, result.invoice.account);
    assert.equal(applied.invoice.creditor.account, result.invoice.account);
    assert.equal(applied.invoice.amount, result.invoice.amount);
    assert.equal(applied.invoice.currency, result.invoice.currency);
    assert.equal(applied.invoice.reference, result.invoice.reference);
    assert.equal(applied.invoice.referenceType, result.invoice.referenceType);
    assert.equal(applied.review.length, 0);
    assert.equal(applied.validation.valid, true);
    assert.equal(canWrite(applied, {}).ok, true);
  });

  it("does not share nested party objects with the source invoice", () => {
    const result = unwrap(analyze(reviewPayload()));
    assert.ok(result.invoice);
    const applied = applyAddressReview(result.invoice, { "creditor.city": "Bern" });
    assert.notEqual(applied.invoice.creditor, result.invoice.creditor);
    assert.equal(result.invoice.creditor.city, "Zürich");
    assert.equal(applied.invoice.creditor.city, "Bern");
  });
});
