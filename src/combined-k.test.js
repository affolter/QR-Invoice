import { asyncTest } from "../kolibri/util/test.js";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildQrPayload } from "./build.js";
import { unwrap } from "./either.js";
import { normalizeInvoice } from "./normalize.js";
import { parseQrPayload } from "./parse.js";

const sampleDir = join(dirname(fileURLToPath(import.meta.url)), "../samples");

/**
 * @param { import("./models.js").InvoiceData } invoice
 */
const financials = invoice => ({
  account:       invoice.account,
  amount:        invoice.amount,
  currency:      invoice.currency,
  referenceType: invoice.referenceType,
  reference:     invoice.reference,
});

asyncTest("combined-k sample — parses legacy K, migrates both parties to S, and keeps 8 B", async assert => {
  const raw = await readFile(join(sampleDir, "combined-k.txt"), "utf8");
  const expected = JSON.parse(await readFile(join(sampleDir, "combined-k.expected.json"), "utf8"));
  const parsed = unwrap(parseQrPayload(raw));
  assert.is(parsed.creditor.addressType.value, "K");
  assert.is(parsed.debtor?.addressType.value, "K");
  assert.is(parsed.creditor.street.value, "Seestrasse 8 B");

  const { invoice, review } = normalizeInvoice(parsed);
  assert.isTrue(invoice != null);
  if (!invoice) return;
  assert.is(invoice.account, expected.account);
  assert.is(invoice.amount, expected.amount);
  assert.is(invoice.currency, expected.currency);
  assert.is(invoice.referenceType, expected.referenceType);
  assert.is(invoice.reference, expected.reference);
  assert.is(invoice.message, expected.message);
  assert.is(invoice.qrType, expected.qrType);
  assert.is(invoice.qrVersion, expected.qrVersion);
  assert.is(invoice.creditor.name, expected.creditor.name);
  assert.is(invoice.creditor.street, expected.creditor.street);
  assert.is(invoice.creditor.buildingNumber, expected.creditor.buildingNumber);
  assert.is(invoice.creditor.postalCode, expected.creditor.postalCode);
  assert.is(invoice.creditor.city, expected.creditor.city);
  assert.is(invoice.creditor.country, expected.creditor.country);
  assert.is(invoice.debtor?.name, expected.debtor.name);
  assert.is(invoice.debtor?.street, expected.debtor.street);
  assert.is(invoice.debtor?.buildingNumber, expected.debtor.buildingNumber);
  assert.is(invoice.creditor.buildingNumber, "8 B");
  assert.isTrue(!review.some(item => item.path === "creditor.buildingNumber"));

  const generated = buildQrPayload(invoice);
  const lines = generated.split("\n");
  assert.is(lines[4], "S");
  assert.is(lines[20], "S");
  assert.is(lines[7], "8 B");
  const again = unwrap(parseQrPayload(generated));
  assert.is(again.creditor.addressType.value, "S");
  assert.is(again.debtor?.addressType.value, "S");
  assert.is(again.creditor.buildingNumber.value, "8 B");
  const money = financials(invoice);
  assert.is(money.account, expected.account);
  assert.is(money.amount, expected.amount);
  assert.is(money.currency, expected.currency);
  assert.is(money.referenceType, expected.referenceType);
  assert.is(money.reference, expected.reference);
  assert.is(again.account.value, expected.account);
  assert.is(again.amount.value, expected.amount);
  assert.is(again.currency.value, expected.currency);
  assert.is(again.reference.value, expected.reference);
  assert.is(again.referenceType.value, expected.referenceType);
});
