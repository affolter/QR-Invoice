import { applyAddressReview, canWrite, createOutputFilename, isPdf } from "../src/index.js";
import { convert, writeInvoice } from "../src/pdf.js";
import { reviewPayload } from "../src/fixtures.js";
import { appendQueue, fileStem, formatSize } from "./files.js";
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
 * @typedef { { name: string, bytes: Uint8Array, fromPdf: boolean, size: number } } Dropped
 */

/** @type { Dropped[] } */
let queue = [];
/** @type { number } */
let index = 0;
/** @type { import("../src/index.js").Converted | null } */
let currentResult = null;
let dragDepth = 0;

/** @returns { Dropped | undefined } */
const current = () => queue[index];

/** @param { Event } event */
const swallowPageDrop = event => event.preventDefault();
window.addEventListener("dragover", swallowPageDrop);
window.addEventListener("drop", swallowPageDrop);

/**
 * @param { FileList | Array<File> } files
 */
async function onFiles(files) {
  const added = [];
  for (const file of Array.from(files)) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    added.push({
      name: fileStem(file.name),
      bytes,
      fromPdf: isPdf(bytes) || file.name.toLowerCase().endsWith(".pdf"),
      size: file.size,
    });
  }
  if (!added.length) return;
  const wasEmpty = queue.length === 0;
  queue = appendQueue(queue, added);
  if (wasEmpty) index = 0;
  fileInput.value = "";
  drawQueue();
  await analyzeCurrent();
}

function loadReviewExample() {
  const text = reviewPayload();
  const bytes = new TextEncoder().encode(text);
  const wasEmpty = queue.length === 0;
  queue = appendQueue(queue, [{ name: "review-needed", bytes, fromPdf: false, size: bytes.byteLength }]);
  if (wasEmpty) index = 0;
  drawQueue();
  void analyzeCurrent();
}

function drawQueue() {
  queueEl.replaceChildren();
  queue.forEach((item, i) => {
    const li = document.createElement("li");
    li.className = i === index ? "queue-row queue-current" : "queue-row";
    const select = document.createElement("button");
    select.type = "button";
    select.className = "queue-select";
    const name = document.createElement("span");
    name.className = "queue-name";
    name.textContent = item.name;
    const meta = document.createElement("span");
    meta.className = "queue-meta";
    meta.textContent = formatSize(item.size);
    select.append(name, meta);
    select.addEventListener("click", () => {
      index = i;
      drawQueue();
      void analyzeCurrent();
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "queue-remove";
    remove.setAttribute("aria-label", `Remove ${item.name}`);
    remove.textContent = "Remove";
    remove.addEventListener("click", event => {
      event.stopPropagation();
      queue = queue.filter((_, j) => j !== i);
      if (queue.length === 0) {
        index = 0;
        currentResult = null;
        panel.hidden = true;
        setStatus(statusEl, "empty", "No file yet.");
      } else if (index > i) index -= 1;
      else if (index >= queue.length) index = queue.length - 1;
      drawQueue();
      if (queue.length) void analyzeCurrent();
    });
    li.append(select, remove);
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

/**
 * @param { Dropped } item
 * @param { Pick<import("../src/index.js").Converted, "invoice" | "validation" | "review"> } result
 * @param { "spc" | "pdf" } kind
 */
async function emitBytes(item, result, kind) {
  const gate = canWrite(result, { acceptReview: true });
  if (!gate.ok) {
    setStatus(statusEl, "error", gate.error);
    return;
  }
  const written = await writeInvoice(gate.value, {
    originalPdf: item.fromPdf ? item.bytes : undefined,
    output: kind,
  });
  if (!written.ok) {
    setStatus(statusEl, "error", written.error);
    return;
  }
  return written.value;
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
  const written = await emitBytes(item, currentResult, item.fromPdf ? "pdf" : "spc");
  if (written) {
    currentResult.bytes = written.bytes;
    currentResult.mediaType = written.mediaType;
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
  const written = await emitBytes(item, applied, kind);
  if (!written) return;
  const type = kind === "pdf" ? "application/pdf" : "text/plain;charset=utf-8";
  const copy = new ArrayBuffer(written.bytes.byteLength);
  new Uint8Array(copy).set(written.bytes);
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

drop.addEventListener("dragenter", event => {
  event.preventDefault();
  dragDepth += 1;
  drop.classList.add("over");
});
drop.addEventListener("dragleave", event => {
  event.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) drop.classList.remove("over");
});
drop.addEventListener("dragover", event => {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
});
drop.addEventListener("drop", event => {
  event.preventDefault();
  dragDepth = 0;
  drop.classList.remove("over");
  const files = event.dataTransfer?.files;
  if (files?.length) void onFiles(files);
});

acceptBtn.addEventListener("click", () => void acceptReviewed());
spcBtn.addEventListener("click", () => void download("spc"));
pdfBtn.addEventListener("click", () => void download("pdf"));
exampleBtn.addEventListener("click", () => loadReviewExample());
