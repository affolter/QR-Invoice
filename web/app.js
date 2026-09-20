import { isPdf } from "@qr-invoice/core";
import { convert } from "@qr-invoice/pdf";
import { project, setStatus } from "./render.js";

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

/** @returns { Dropped | undefined } */
const current = () => queue[index];

/**
 * @param { FileList | Array<File> } files
 */
async function onFiles(files) {
  panel.hidden = true;
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
  await run(false);
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
      void run(false);
    });
    li.append(btn);
    queueEl.append(li);
  });
}

/**
 * @param { boolean } acceptReview
 */
async function run(acceptReview) {
  const item = current();
  if (!item) {
    setStatus(statusEl, "empty", "No file yet.");
    return;
  }
  setStatus(statusEl, "loading", `Converting ${item.name} in this tab…`);
  const converted = await convert(item.bytes, { acceptReview, output: item.fromPdf ? "pdf" : "spc" });
  if (!converted.ok) {
    panel.hidden = true;
    setStatus(statusEl, "error", converted.error);
    return;
  }
  panel.hidden = false;
  project(dom, converted.value, { acceptReview, fromPdf: item.fromPdf });
}

/**
 * @param { "spc" | "pdf" } kind
 */
async function download(kind) {
  const item = current();
  if (!item) return;
  const converted = await convert(item.bytes, { acceptReview: true, output: kind });
  if (!converted.ok || !converted.value.bytes) {
    setStatus(statusEl, "error", converted.ok ? "No output bytes." : converted.error);
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
  a.download = `${item.name}-structured.${kind === "pdf" ? "pdf" : "txt"}`;
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

acceptBtn.addEventListener("click", () => void run(true));
spcBtn.addEventListener("click", () => void download("spc"));
pdfBtn.addEventListener("click", () => void download("pdf"));
