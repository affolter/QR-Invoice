import { applyAddressReview, canWrite, createOutputFilename, isPdf } from "../src/index.js";
import { convert, writeInvoice } from "../src/pdf/index.js";
import { reviewPayload } from "../src/synthetic.js";
import { getAddressPatches, project, setStatus } from "./render.js";

const fileInput  = /** @type { HTMLInputElement } */    (document.getElementById("file"));
const drop       = /** @type { HTMLElement } */         (document.getElementById("drop"));
const statusEl   = /** @type { HTMLElement } */         (document.getElementById("status"));
const panel      = /** @type { HTMLElement } */         (document.getElementById("panel"));
const queueEl    = /** @type { HTMLElement } */         (document.getElementById("queue"));
const summary    = /** @type { HTMLElement } */         (document.getElementById("summary"));
const issuesEl   = /** @type { HTMLElement } */         (document.getElementById("issues"));
const reviewEl   = /** @type { HTMLElement } */         (document.getElementById("review"));
const acceptBtn  = /** @type { HTMLButtonElement } */   (document.getElementById("accept"));
const spcBtn     = /** @type { HTMLButtonElement } */   (document.getElementById("spc"));
const pdfBtn     = /** @type { HTMLButtonElement } */   (document.getElementById("pdf"));
const exampleBtn = /** @type { HTMLButtonElement } */   (document.getElementById("example"));

const dom = {
  summary,
  issues:    issuesEl,
  review:    reviewEl,
  acceptBtn,
  spcBtn,
  pdfBtn,
  status:    statusEl,
};

/**
 * @typedef { {
 *   name:    string,
 *   bytes:   Uint8Array,
 *   fromPdf: boolean,
 * } } Dropped
 */

/** @type { Dropped[] } */
let queue = [];
let index = 0;
/** @type { import("../src/index.js").Converted | null } */
let currentResult = null;

const current = () => queue[index];

window.addEventListener("dragover", event => event.preventDefault());
window.addEventListener("drop",     event => event.preventDefault());

/**
 * @param { FileList | Array<File> } files
 */
const onFiles = async files => {
  queue = [];
  for (const file of Array.from(files)) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    queue.push({
      name:    file.name.replace(/\.(pdf|txt|spc)$/i, "") || "qr-invoice",
      bytes,
      fromPdf: isPdf(bytes) || file.name.toLowerCase().endsWith(".pdf"),
    });
  }
  index = 0;
  fileInput.value = "";
  drawQueue();
  await analyzeCurrent();
};

const loadReviewExample = () => {
  const bytes = new TextEncoder().encode(reviewPayload());
  queue = [{ name: "review-needed", bytes, fromPdf: false }];
  index = 0;
  drawQueue();
  void analyzeCurrent();
};

const drawQueue = () => {
  queueEl.replaceChildren();
  queue.forEach((item, i) => {
    const li  = document.createElement("li");
    const btn = document.createElement("button");
    btn.type      = "button";
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
};

const analyzeCurrent = async () => {
  const item = current();
  if (!item) {
    currentResult = null;
    panel.hidden  = true;
    setStatus(statusEl, "empty", "No file yet.");
    return;
  }
  setStatus(statusEl, "loading", `Converting ${item.name} in this tab…`);
  const converted = await convert(item.bytes, { acceptReview: false, output: item.fromPdf ? "pdf" : "spc" });
  if (!converted.ok) {
    panel.hidden    = true;
    currentResult   = null;
    setStatus(statusEl, "error", converted.error);
    return;
  }
  currentResult  = converted.value;
  panel.hidden   = false;
  project(dom, currentResult, { fromPdf: item.fromPdf });
};

/**
 * @param { Dropped } item
 * @param { Pick<import("../src/index.js").Converted, "invoice" | "validation" | "review"> } result
 * @param { "spc" | "pdf" } kind
 */
const emitBytes = async (item, result, kind) => {
  const gate = canWrite(result, { acceptReview: true });
  if (!gate.ok) {
    setStatus(statusEl, "error", gate.error);
    return;
  }
  const written = await writeInvoice(gate.value, {
    originalPdf: item.fromPdf ? item.bytes : undefined,
    output:      kind,
  });
  if (!written.ok) {
    setStatus(statusEl, "error", written.error);
    return;
  }
  return written.value;
};

const acceptReviewed = async () => {
  const item = current();
  if (!item || !currentResult?.invoice) return;
  const applied = applyAddressReview(currentResult.invoice, getAddressPatches());
  currentResult = {
    ...currentResult,
    invoice:    applied.invoice,
    validation: applied.validation,
    review:     applied.review,
  };
  const written = await emitBytes(item, currentResult, item.fromPdf ? "pdf" : "spc");
  if (written) {
    currentResult = {
      ...currentResult,
      bytes:     written.bytes,
      mediaType: written.mediaType,
    };
  }
  project(dom, currentResult, { fromPdf: item.fromPdf });
};

/**
 * @param { "spc" | "pdf" } kind
 */
const download = async kind => {
  const item = current();
  if (!item || !currentResult?.invoice) return;
  const applied = applyAddressReview(currentResult.invoice, getAddressPatches());
  const written = await emitBytes(item, applied, kind);
  if (!written) return;
  const type = kind === "pdf" ? "application/pdf" : "text/plain;charset=utf-8";
  const copy = new ArrayBuffer(written.bytes.byteLength);
  new Uint8Array(copy).set(written.bytes);
  const a = document.createElement("a");
  a.href     = URL.createObjectURL(new Blob([copy], { type }));
  a.download = createOutputFilename(item.name, kind);
  a.click();
  URL.revokeObjectURL(a.href);
};

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

acceptBtn.addEventListener("click",  () => void acceptReviewed());
spcBtn.addEventListener("click",     () => void download("spc"));
pdfBtn.addEventListener("click",     () => void download("pdf"));
exampleBtn.addEventListener("click", () => loadReviewExample());
