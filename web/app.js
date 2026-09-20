import { applyAddressReview, canWrite, createOutputFilename, isPdf } from "@qr-invoice/core";
import { convert, writeInvoice } from "@qr-invoice/pdf";
import { reviewPayload } from "../packages/core/src/fixtures.js";
import { getAddressPatches, project, setStatus } from "./render.js";

const fileInput = /** @type { HTMLInputElement } */ (document.getElementById("file"));
const drop = /** @type { HTMLElement } */ (document.getElementById("drop"));
const statusEl = /** @type { HTMLElement } */ (document.getElementById("status"));
const panel = /** @type { HTMLElement } */ (document.getElementById("panel"));
const queueEl = /** @type { HTMLElement } */ (document.getElementById("queue"));
const summary = /** @type { HTMLElement } */ (document.getElementById("summary"));
const issuesEl = /** @type { HTMLElement } */ (document.getElementById("issues"));
const reviewEl = /** @type { HTMLElement } */ (document.getElementById("review"));
const acceptBtn = /** @type { HTMLButtonElement } */ (document.getElementById("accept"));
const spcBtn = /** @type { HTMLButtonElement } */ (document.getElementById("spc"));
const pdfBtn = /** @type { HTMLButtonElement } */ (document.getElementById("pdf"));
const exampleBtn = /** @type { HTMLButtonElement } */ (document.getElementById("example"));

const dom = {
  summary,
  issues: issuesEl,
  review: reviewEl,
  acceptBtn,
  spcBtn,
  pdfBtn,
  status: statusEl,
};

/**
 * @typedef { { name: string, bytes: Uint8Array, fromPdf: boolean } } Dropped
 */

/** @type { Dropped[] } */
let queue = [];
/** @type { number } */
let index = 0;
/** @type { import("@qr-invoice/core").Converted | null } */
let currentResult = null;

/** @returns { Dropped | undefined } */
const current = () => queue[index];

/**
 * @param { FileList | Array<File> } files
 */
async function onFiles(files) {
  panel.hidden = true;
  currentResult = null;
  setStatus(statusEl, "loading", "Reading files…");
  queue = [];
  for (const file of Array.from(files)) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    queue.push({
      name: file.name.replace(/\.(pdf|txt|spc)$/i, "") || "qr-invoice",
      bytes,
      fromPdf: isPdf(bytes) || file.name.toLowerCase().endsWith(".pdf"),
    });
  }
  index = 0;
  drawQueue();
  await analyzeCurrent();
}

function loadReviewExample() {
  const bytes = new TextEncoder().encode(reviewPayload());
  queue = [{ name: "review-needed", bytes, fromPdf: false }];
  index = 0;
  drawQueue();
  void analyzeCurrent();
}

function drawQueue() {
  queueEl.replaceChildren();
  queue.forEach((item, i) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = i === index ? "queue-current" : "queue-item";
    btn.textContent = item.name;
    btn.addEventListener("click", () => {
      index = i;
      drawQueue();
      void analyzeCurrent();
    });
    li.append(btn);
    queueEl.append(li);
  });
}

async function analyzeCurrent() {
  const item = current();
  if (!item) {
    currentResult = null;
    setStatus(statusEl, "empty", "No file yet.");
    return;
  }
  setStatus(statusEl, "loading", `Converting ${item.name} in this tab…`);
  const converted = await convert(item.bytes, { acceptReview: false, output: item.fromPdf ? "pdf" : "spc" });
  if (!converted.ok) {
    panel.hidden = true;
    currentResult = null;
    setStatus(statusEl, "error", converted.error);
    return;
  }
  currentResult = converted.value;
  panel.hidden = false;
  project(dom, currentResult, { fromPdf: item.fromPdf });
}

async function acceptReviewed() {
  const item = current();
  if (!item || !currentResult?.invoice) return;
  const applied = applyAddressReview(currentResult.invoice, getAddressPatches());
  currentResult = {
    ...currentResult,
    invoice: applied.invoice,
    validation: applied.validation,
    review: applied.review,
  };
  const gate = canWrite(currentResult, { acceptReview: true });
  if (gate.ok) {
    const written = await writeInvoice(gate.value, {
      originalPdf: item.fromPdf ? item.bytes : undefined,
      output: item.fromPdf ? "pdf" : "spc",
    });
    if (!written.ok) {
      setStatus(statusEl, "error", written.error);
      return;
    }
    currentResult.bytes = written.value.bytes;
    currentResult.mediaType = written.value.mediaType;
  }
  project(dom, currentResult, { fromPdf: item.fromPdf });
}

/**
 * @param { "spc" | "pdf" } kind
 */
async function download(kind) {
  const item = current();
  if (!item || !currentResult?.invoice) return;
  const applied = applyAddressReview(currentResult.invoice, getAddressPatches());
  const gated = canWrite(
    { invoice: applied.invoice, validation: applied.validation, review: applied.review },
    { acceptReview: true },
  );
  if (!gated.ok) {
    setStatus(statusEl, "error", gated.error);
    return;
  }
  const written = await writeInvoice(gated.value, {
    originalPdf: item.fromPdf ? item.bytes : undefined,
    output: kind,
  });
  if (!written.ok) {
    setStatus(statusEl, "error", written.error);
    return;
  }
  const type = kind === "pdf" ? "application/pdf" : "text/plain;charset=utf-8";
  const bytes = written.value.bytes;
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  const blob = new Blob([copy], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = createOutputFilename(item.name, kind);
  a.click();
  URL.revokeObjectURL(url);
}

fileInput.addEventListener("change", () => {
  if (fileInput.files?.length) void onFiles(fileInput.files);
});

drop.addEventListener("dragover", event => {
  event.preventDefault();
  drop.classList.add("over");
});
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", event => {
  event.preventDefault();
  drop.classList.remove("over");
  const files = event.dataTransfer?.files;
  if (files?.length) void onFiles(files);
});

acceptBtn.addEventListener("click", () => void acceptReviewed());
spcBtn.addEventListener("click", () => void download("spc"));
pdfBtn.addEventListener("click", () => void download("pdf"));
exampleBtn.addEventListener("click", () => loadReviewExample());

const apiEl = document.getElementById("api-status");
if (apiEl) {
  fetch("/api/health")
    .then(res => {
      apiEl.textContent = res.ok ? "JSON API: up (optional)" : "JSON API: down — conversion stays in this tab";
    })
    .catch(() => {
      apiEl.textContent = "JSON API: down — conversion stays in this tab";
    });
}
