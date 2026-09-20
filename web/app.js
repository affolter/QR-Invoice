/** @import { Converted } from "@qr-invoice/core" */

import { canWrite, isPdf } from "@qr-invoice/core";
import { convert } from "@qr-invoice/pdf";

const fileInput = /** @type { HTMLInputElement } */ (document.getElementById("file"));
const drop = /** @type { HTMLElement } */ (document.getElementById("drop"));
const statusEl = /** @type { HTMLElement } */ (document.getElementById("status"));
const panel = /** @type { HTMLElement } */ (document.getElementById("panel"));
const summary = /** @type { HTMLElement } */ (document.getElementById("summary"));
const issuesEl = /** @type { HTMLElement } */ (document.getElementById("issues"));
const reviewEl = /** @type { HTMLElement } */ (document.getElementById("review"));
const acceptBtn = /** @type { HTMLButtonElement } */ (document.getElementById("accept"));
const spcBtn = /** @type { HTMLButtonElement } */ (document.getElementById("spc"));
const pdfBtn = /** @type { HTMLButtonElement } */ (document.getElementById("pdf"));

/** @type { Uint8Array | undefined } */
let dropped;
/** @type { string } */
let baseName = "qr-invoice";
/** @type { boolean } */
let fromPdf = false;

/**
 * @param { "empty" | "loading" | "error" | "ok" } kind
 * @param { string } text
 */
function setStatus(kind, text) {
  statusEl.dataset.kind = kind;
  statusEl.textContent = text;
}

/**
 * @param { File } file
 */
async function onFile(file) {
  panel.hidden = true;
  setStatus("loading", `Reading ${file.name}…`);
  baseName = file.name.replace(/\.(pdf|txt|spc)$/i, "") || "qr-invoice";
  dropped = new Uint8Array(await file.arrayBuffer());
  fromPdf = isPdf(dropped) || file.name.toLowerCase().endsWith(".pdf");
  await run(false);
}

/**
 * @param { boolean } acceptReview
 */
async function run(acceptReview) {
  if (!dropped) return;
  setStatus("loading", "Converting in the browser…");
  const output = fromPdf ? "pdf" : "spc";
  const converted = await convert(dropped, { acceptReview, output });
  if (!converted.ok) {
    panel.hidden = true;
    setStatus("error", converted.error);
    return;
  }
  render(converted.value, acceptReview);
}

/**
 * @param { Converted } result
 * @param { boolean } acceptReview
 */
function render(result, acceptReview) {
  panel.hidden = false;
  const invoice = result.invoice;
  summary.replaceChildren();
  addRow("Creditor", invoice?.creditor.name ?? "—");
  addRow("Street", [invoice?.creditor.street, invoice?.creditor.buildingNumber].filter(Boolean).join(" ") || "—");
  addRow("IBAN", invoice?.account ?? "—");
  addRow("Amount", invoice?.amount === undefined ? "open" : `${invoice.amount} ${invoice.currency}`);
  addRow("Reference", `${invoice?.referenceType ?? ""} ${invoice?.reference ?? ""}`.trim() || "—");
  addRow("Address type", result.parsed.creditor.addressType.value || "—");

  issuesEl.replaceChildren();
  for (const issue of result.validation.issues) {
    const li = document.createElement("li");
    li.textContent = `${issue.severity}: ${issue.field} — ${issue.message}`;
    issuesEl.append(li);
  }

  reviewEl.replaceChildren();
  for (const item of result.review) {
    const li = document.createElement("li");
    li.textContent = `${item.path} = ${JSON.stringify(item.value)} (confidence ${item.confidence})`;
    reviewEl.append(li);
  }

  const gate = canWrite(result, { acceptReview });
  const ready = gate.ok && Boolean(result.bytes);
  acceptBtn.hidden = result.review.length === 0 || ready;
  spcBtn.hidden = !ready;
  pdfBtn.hidden = !ready;
  if (!gate.ok) setStatus("error", gate.error);
  else if (!result.bytes) setStatus("error", "No output bytes.");
  else setStatus("ok", fromPdf ? "Ready. Banks read the restamped QR; printed type K on the page may remain." : "Ready to download.");
}

/**
 * @param { string } key
 * @param { string } value
 */
function addRow(key, value) {
  const dt = document.createElement("dt");
  dt.textContent = key;
  const dd = document.createElement("dd");
  dd.textContent = value;
  summary.append(dt, dd);
}

/**
 * @param { "spc" | "pdf" } kind
 */
async function download(kind) {
  if (!dropped) return;
  const converted = await convert(dropped, { acceptReview: true, output: kind });
  if (!converted.ok || !converted.value.bytes) {
    setStatus("error", converted.ok ? "No output bytes." : converted.error);
    return;
  }
  const type = kind === "pdf" ? "application/pdf" : "text/plain;charset=utf-8";
  const bytes = converted.value.bytes;
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  const blob = new Blob([copy], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${baseName}-structured.${kind === "pdf" ? "pdf" : "txt"}`;
  a.click();
  URL.revokeObjectURL(url);
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) void onFile(file);
});

drop.addEventListener("dragover", event => {
  event.preventDefault();
  drop.classList.add("over");
});
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", event => {
  event.preventDefault();
  drop.classList.remove("over");
  const file = event.dataTransfer?.files?.[0];
  if (file) void onFile(file);
});

acceptBtn.addEventListener("click", () => void run(true));
spcBtn.addEventListener("click", () => void download("spc"));
pdfBtn.addEventListener("click", () => void download("pdf"));
