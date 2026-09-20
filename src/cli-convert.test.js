import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { unwrap } from "./either.js";
import { buildSwissQrPayload, debtorLessPayload, reviewPayload } from "./fixtures.js";
import { canWrite, normalizeInvoice, parseQrPayload, validateInvoice } from "./index.js";
import { convertInvoiceFile, convertQrPayload } from "./cli.js";

/** @param { string } raw */
function prepared(raw) {
  const normalized = normalizeInvoice(unwrap(parseQrPayload(raw)));
  return {
    invoice: normalized.invoice,
    review: normalized.review,
    validation: validateInvoice(normalized.invoice),
  };
}

describe("convertQrPayload", () => {
  it("writes a normalized SPC file", async () => {
    const outputPath = join(await mkdtemp(join(tmpdir(), "qr-invoice-")), "new-payload.txt");
    const result = unwrap(await convertQrPayload(buildSwissQrPayload(), { outputPath }));
    assert.equal(result.validation.valid, true);
    assert.equal(canWrite(result, {}).ok, true);
    assert.equal(result.outputPath, outputPath);
    const written = await readFile(outputPath, "utf8");
    assert.match(written, /^SPC\n/);
    assert.match(written, /\nEPD\n/);
  });

  it("returns Either instead of throwing on a non-SPC payload", async () => {
    const converted = await convertQrPayload("not a swiss payments code", {
      outputPath: join(tmpdir(), "should-not-write.txt"),
    });
    assert.equal(converted.ok, false);
  });

  it("writes with --accept-review when an address needs review", async () => {
    const outputPath = join(await mkdtemp(join(tmpdir(), "qr-invoice-review-")), "new-payload.txt");
    const blocked = unwrap(await convertQrPayload(reviewPayload(), { outputPath }));
    assert.ok(blocked.review.length > 0);
    assert.equal(blocked.outputPath, undefined);
    const written = unwrap(await convertQrPayload(reviewPayload(), { outputPath, acceptReview: true }));
    assert.equal(written.outputPath, outputPath);
  });

  it("does not write when --strict sees an open-amount warning", async () => {
    const outputPath = join(await mkdtemp(join(tmpdir(), "qr-invoice-strict-")), "new-payload.txt");
    const result = unwrap(await convertQrPayload(buildSwissQrPayload({ amount: "" }), { outputPath, strict: true }));
    assert.equal(result.validation.valid, true);
    assert.ok(result.validation.issues.some(/** @param { { severity: string } } issue */ issue => issue.severity === "warning"));
    assert.equal(result.outputPath, undefined);
    assert.equal(canWrite(result, { strict: true }).ok, false);
  });
});

describe("convertInvoiceFile", () => {
  it("reads SPC text wrapped in junk bytes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "qr-invoice-file-"));
    const input = join(dir, "old.txt");
    const output = join(dir, "new.txt");
    await writeFile(input, `header\n${buildSwissQrPayload()}\ntrailer\n`, "utf8");
    const result = unwrap(await convertInvoiceFile(input, { outputPath: output }));
    assert.equal(result.validation.valid, true);
    assert.equal(result.outputPath, output);
  });
});

describe("canWrite", () => {
  it("allows a valid payload with no review", () => {
    assert.equal(canWrite(prepared(buildSwissQrPayload()), {}).ok, true);
  });

  it("blocks validation errors without changing stored values", () => {
    const result = prepared(buildSwissQrPayload({ currency: "USD" }));
    assert.equal(result.invoice?.currency, "USD");
    const gate = canWrite(result, {});
    assert.equal(gate.ok, false);
    if (!gate.ok) assert.match(gate.error, /not modified/);
  });

  it("blocks review unless acceptReview is set", () => {
    const result = prepared(reviewPayload());
    assert.ok(result.review.length > 0);
    assert.equal(canWrite(result, {}).ok, false);
    assert.equal(canWrite(result, { acceptReview: true }).ok, true);
  });

  it("blocks warnings when strict is set", () => {
    const result = prepared(buildSwissQrPayload({ amount: "" }));
    assert.equal(result.validation.valid, true);
    assert.equal(canWrite(result, {}).ok, true);
    assert.equal(canWrite(result, { strict: true }).ok, false);
  });
});

describe("debtor-less bill", () => {
  it("parses and writes a bill with no debtor", async () => {
    const parsed = unwrap(parseQrPayload(debtorLessPayload()));
    assert.equal(parsed.debtor, null);
    const outputPath = join(await mkdtemp(join(tmpdir(), "qr-invoice-nodebtor-")), "new-payload.txt");
    const result = unwrap(await convertQrPayload(debtorLessPayload(), { outputPath }));
    assert.equal(result.invoice?.debtor, undefined);
    assert.equal(result.validation.valid, true);
    assert.equal(result.outputPath, outputPath);
    assert.match(await readFile(outputPath, "utf8"), /\nCHF\n\n\n\n\n\n\n\nQRR\n/);
  });
});
