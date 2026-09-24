import { TestSuite } from "../kolibri/util/test.js";
import { unwrap } from "./either.js";
import { CH_IBAN, SCOR_REF, buildSwissQrPayload, debtorLessPayload, scorPayload } from "./synthetic.js";
import { normalizeInvoice } from "./normalize.js";
import { parseQrPayload } from "./parse.js";
import { validateInvoice } from "./validate.js";

const suite = TestSuite("validateInvoice");

/** @param { import("./synthetic.js").PayloadOverrides } [overrides] */
const invoiceFrom = (overrides = {}) =>
  normalizeInvoice(unwrap(parseQrPayload(buildSwissQrPayload(overrides))));

suite.add("accepts the synthetic QR-IBAN / QRR example", assert => {
  assert.is(validateInvoice(invoiceFrom().invoice).valid, true);
});

suite.add("rejects a QR-IBAN paired with NON without changing the IBAN", assert => {
  const { invoice } = invoiceFrom({ referenceType: "NON", reference: "" });
  const iban = invoice?.account;
  const result = validateInvoice(invoice);
  assert.is(result.valid, false);
  assert.isTrue(result.issues.some(issue => issue.code === "reference.qr-iban"));
  assert.is(invoice?.account, iban);
});

suite.add("rejects an invalid QRR check digit without rewriting the reference", assert => {
  const { invoice } = invoiceFrom({ reference: "210000000003139471430009010" });
  const reference = invoice?.reference;
  const result = validateInvoice(invoice);
  assert.is(result.valid, false);
  assert.isTrue(result.issues.some(issue => issue.code === "reference.qrr.checksum"));
  assert.is(invoice?.reference, reference);
});

suite.add("rejects a non CHF/EUR currency without mapping it", assert => {
  const { invoice } = invoiceFrom({ currency: "USD" });
  assert.is(invoice?.currency, "USD");
  const result = validateInvoice(invoice);
  assert.is(result.valid, false);
  assert.isTrue(result.issues.some(issue => issue.field === "currency"));
});

suite.add("warns on an open amount instead of filling one in", assert => {
  const { invoice } = invoiceFrom({ amount: "" });
  assert.is(invoice?.amount, null);
  const result = validateInvoice(invoice);
  assert.is(result.valid, true);
  assert.isTrue(result.issues.some(issue => issue.code === "amount.empty"));
});

suite.add("accepts a non-QR CH-IBAN with a SCOR reference and does not rewrite either", assert => {
  const { invoice } = normalizeInvoice(unwrap(parseQrPayload(scorPayload())));
  assert.is(invoice?.account, CH_IBAN);
  assert.is(invoice?.reference, SCOR_REF);
  assert.is(invoice?.referenceType, "SCOR");
  assert.is(validateInvoice(invoice).valid, true);
});

suite.add("accepts a non-QR CH-IBAN with NON and does not rewrite the IBAN", assert => {
  const { invoice } = invoiceFrom({ iban: CH_IBAN, referenceType: "NON", reference: "" });
  assert.is(invoice?.account, CH_IBAN);
  assert.is(invoice?.reference, "");
  assert.is(validateInvoice(invoice).valid, true);
});

suite.add("accepts a debtor-less bill", assert => {
  const { invoice } = normalizeInvoice(unwrap(parseQrPayload(debtorLessPayload())));
  assert.is(invoice?.debtor, null);
  assert.is(validateInvoice(invoice).valid, true);
});

suite.run();
