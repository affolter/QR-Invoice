import { TestSuite, asyncTest } from "../kolibri/util/test.js";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unwrap } from "../src/either.js";
import { buildSwissQrPayload, debtorLessPayload, reviewPayload } from "../src/synthetic.js";
import { canWrite, normalizeInvoice, parseQrPayload, validateInvoice } from "../src/index.js";
import { convertInvoiceFile, convertQrPayload } from "./cli.js";

/** @param { string } raw */
const prepared = raw => {
  const normalized = normalizeInvoice(unwrap(parseQrPayload(raw)));
  return {
    invoice:    normalized.invoice,
    review:     normalized.review,
    validation: validateInvoice(normalized.invoice),
  };
};

asyncTest("convertQrPayload — writes a normalized SPC file", async assert => {
  const outputPath = join(await mkdtemp(join(tmpdir(), "qr-invoice-")), "new-payload.txt");
  const result = unwrap(await convertQrPayload(buildSwissQrPayload(), { outputPath }));
  assert.is(result.validation.valid, true);
  assert.is(canWrite(result, {}).ok, true);
  assert.is(result.outputPath, outputPath);
  const written = await readFile(outputPath, "utf8");
  assert.isTrue(/^SPC\n/.test(written));
  assert.isTrue(/\nEPD\n/.test(written));
});

asyncTest("convertQrPayload — returns Either instead of throwing on a non-SPC payload", async assert => {
  const converted = await convertQrPayload("not a swiss payments code", {
    outputPath: join(tmpdir(), "should-not-write.txt"),
  });
  assert.is(converted.ok, false);
});

asyncTest("convertQrPayload — writes with --accept-review when an address needs review", async assert => {
  const outputPath = join(await mkdtemp(join(tmpdir(), "qr-invoice-review-")), "new-payload.txt");
  const blocked = unwrap(await convertQrPayload(reviewPayload(), { outputPath }));
  assert.isTrue(blocked.review.length > 0);
  assert.is(blocked.outputPath, undefined);
  const written = unwrap(await convertQrPayload(reviewPayload(), { outputPath, acceptReview: true }));
  assert.is(written.outputPath, outputPath);
});

asyncTest("convertQrPayload — does not write when --strict sees an open-amount warning", async assert => {
  const outputPath = join(await mkdtemp(join(tmpdir(), "qr-invoice-strict-")), "new-payload.txt");
  const result = unwrap(await convertQrPayload(buildSwissQrPayload({ amount: "" }), { outputPath, strict: true }));
  assert.is(result.validation.valid, true);
  assert.isTrue(result.validation.issues.some(/** @param { { severity: string } } issue */ issue => issue.severity === "warning"));
  assert.is(result.outputPath, undefined);
  assert.is(canWrite(result, { strict: true }).ok, false);
});

asyncTest("convertInvoiceFile — reads SPC text wrapped in junk bytes", async assert => {
  const dir = await mkdtemp(join(tmpdir(), "qr-invoice-file-"));
  const input = join(dir, "old.txt");
  const output = join(dir, "new.txt");
  await writeFile(input, `header\n${buildSwissQrPayload()}\ntrailer\n`, "utf8");
  const result = unwrap(await convertInvoiceFile(input, { outputPath: output }));
  assert.is(result.validation.valid, true);
  assert.is(result.outputPath, output);
});

const writeSuite = TestSuite("canWrite");

writeSuite.add("allows a valid payload with no review", assert => {
  assert.is(canWrite(prepared(buildSwissQrPayload()), {}).ok, true);
});

writeSuite.add("blocks validation errors without changing stored values", assert => {
  const result = prepared(buildSwissQrPayload({ currency: "USD" }));
  assert.is(result.invoice?.currency, "USD");
  const gate = canWrite(result, {});
  assert.is(gate.ok, false);
  if (!gate.ok) assert.isTrue(/not modified/.test(gate.error));
});

writeSuite.add("blocks review unless acceptReview is set", assert => {
  const result = prepared(reviewPayload());
  assert.isTrue(result.review.length > 0);
  assert.is(canWrite(result, {}).ok, false);
  assert.is(canWrite(result, { acceptReview: true }).ok, true);
});

writeSuite.add("blocks warnings when strict is set", assert => {
  const result = prepared(buildSwissQrPayload({ amount: "" }));
  assert.is(result.validation.valid, true);
  assert.is(canWrite(result, {}).ok, true);
  assert.is(canWrite(result, { strict: true }).ok, false);
});

writeSuite.run();

asyncTest("debtor-less bill — parses and writes a bill with no debtor", async assert => {
  const parsed = unwrap(parseQrPayload(debtorLessPayload()));
  assert.is(parsed.debtor, null);
  const outputPath = join(await mkdtemp(join(tmpdir(), "qr-invoice-nodebtor-")), "new-payload.txt");
  const result = unwrap(await convertQrPayload(debtorLessPayload(), { outputPath }));
  assert.is(result.invoice?.debtor, null);
  assert.is(result.validation.valid, true);
  assert.is(result.outputPath, outputPath);
  assert.isTrue(/\nCHF\n\n\n\n\n\n\n\nQRR\n/.test(await readFile(outputPath, "utf8")));
});
