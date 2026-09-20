import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { buildQrPayload } from "./build.js";
import { unwrap } from "./either.js";
import { normalizeInvoice } from "./normalize.js";
import { parseQrPayload } from "./parse.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const fixtureDir = join(root, "fixtures", "spc");
const sampleDirs = [join(root, "samples"), join(root, "sample")];

/**
 * @param { import("./models.js").InvoiceData } invoice
 */
function financials(invoice) {
  return {
    account: invoice.account,
    amount: invoice.amount,
    currency: invoice.currency,
    referenceType: invoice.referenceType,
    reference: invoice.reference,
  };
}

describe("affolter-27338 K→S fixture", () => {
  it("parses legacy K, migrates both parties to S, and keeps 8 B", async () => {
    const raw = await readFile(join(fixtureDir, "affolter-27338.txt"), "utf8");
    const expected = JSON.parse(await readFile(join(fixtureDir, "affolter-27338.expected.json"), "utf8"));
    const parsed = unwrap(parseQrPayload(raw));
    assert.equal(parsed.creditor.addressType.value, "K");
    assert.equal(parsed.debtor?.addressType.value, "K");
    assert.equal(parsed.creditor.street.value, "Seestrasse 8 B");

    const { invoice, review } = normalizeInvoice(parsed);
    assert.ok(invoice);
    assert.deepEqual(invoice, expected);
    assert.equal(invoice.creditor.buildingNumber, "8 B");
    assert.ok(!review.some(item => item.path === "creditor.buildingNumber"));

    const generated = buildQrPayload(invoice);
    const lines = generated.split("\n");
    assert.equal(lines[4], "S");
    assert.equal(lines[20], "S");
    assert.equal(lines[7], "8 B");
    const again = unwrap(parseQrPayload(generated));
    assert.equal(again.creditor.addressType.value, "S");
    assert.equal(again.debtor?.addressType.value, "S");
    assert.equal(again.creditor.buildingNumber.value, "8 B");
    assert.deepEqual(financials(invoice), {
      account: expected.account,
      amount: expected.amount,
      currency: expected.currency,
      referenceType: expected.referenceType,
      reference: expected.reference,
    });
    assert.equal(again.account.value, expected.account);
    assert.equal(again.amount.value, expected.amount);
    assert.equal(again.currency.value, expected.currency);
    assert.equal(again.reference.value, expected.reference);
    assert.equal(again.referenceType.value, expected.referenceType);
  });
});

describe("checkout sample SPC files", () => {
  it("round-trips any extra .txt/.spc invoices under sample(s)/", async () => {
    /** @type { string[] } */
    const found = [];
    for (const dir of sampleDirs) {
      let names = [];
      try {
        names = await readdir(dir);
      } catch {
        continue;
      }
      for (const name of names) {
        if (name.endsWith(".txt") || name.endsWith(".spc")) found.push(join(dir, name));
      }
    }
    for (const path of found) {
      const parsed = parseQrPayload(await readFile(path, "utf8"));
      assert.equal(parsed.ok, true, path);
      if (!parsed.ok) continue;
      const { invoice } = normalizeInvoice(parsed.value);
      assert.ok(invoice, path);
      const again = unwrap(parseQrPayload(buildQrPayload(invoice)));
      assert.equal(again.creditor.addressType.value, "S");
      if (invoice.debtor) assert.equal(again.debtor?.addressType.value, "S");
      assert.equal(again.account.value, invoice.account);
      assert.equal(again.amount.value, invoice.amount);
      assert.equal(again.currency.value, invoice.currency);
      assert.equal(again.reference.value, invoice.reference);
    }
  });
});
