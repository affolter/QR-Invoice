import { TestSuite } from "../kolibri/util/test.js";
import { analyze, canWrite } from "./convert.js";
import { unwrap } from "./either.js";
import { reviewPayload } from "./synthetic.js";
import { applyAddressReview } from "./review.js";

const suite = TestSuite("applyAddressReview");

suite.add("blocks write until the ambiguous street is reviewed", assert => {
  const result = unwrap(analyze(reviewPayload()));
  assert.isTrue(result.review.some(item => item.path === "creditor.street"));
  assert.is(canWrite(result, {}).ok, false);
  assert.is(result.invoice?.account, "CH4431999123000889012");
});

suite.add("applies address edits and leaves money fields alone", assert => {
  const result = unwrap(analyze(reviewPayload()));
  assert.isTrue(result.invoice != null);
  if (!result.invoice) return;
  const applied = applyAddressReview(result.invoice, {
    "creditor.street":         "Bahnhofstrasse",
    "creditor.buildingNumber": "12",
    account:                   "CH9300762011623852957",
    amount:                    "1.00",
    currency:                  "EUR",
    reference:                 "000",
    referenceType:             "NON",
    "creditor.account":        "AT123",
  });
  assert.is(applied.invoice.creditor.street, "Bahnhofstrasse");
  assert.is(applied.invoice.creditor.buildingNumber, "12");
  assert.is(applied.invoice.account, result.invoice.account);
  assert.is(applied.invoice.creditor.account, result.invoice.account);
  assert.is(applied.invoice.amount, result.invoice.amount);
  assert.is(applied.invoice.currency, result.invoice.currency);
  assert.is(applied.invoice.reference, result.invoice.reference);
  assert.is(applied.invoice.referenceType, result.invoice.referenceType);
  assert.is(applied.review.length, 0);
  assert.is(applied.validation.valid, true);
  assert.is(canWrite(applied, {}).ok, true);
});

suite.add("does not share nested party objects with the source invoice", assert => {
  const result = unwrap(analyze(reviewPayload()));
  assert.isTrue(result.invoice != null);
  if (!result.invoice) return;
  const applied = applyAddressReview(result.invoice, { "creditor.city": "Bern" });
  assert.isTrue(applied.invoice.creditor !== result.invoice.creditor);
  assert.is(result.invoice.creditor.city, "Zürich");
  assert.is(applied.invoice.creditor.city, "Bern");
});

suite.run();
