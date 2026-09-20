/** @import { Converted } from "@qr-invoice/core" */

import { canWrite } from "@qr-invoice/core";

/**
 * Projector: Converted → DOM. Financial fields are locked (not editable).
 *
 * @param { {
 *   summary: HTMLElement,
 *   issues: HTMLElement,
 *   review: HTMLElement,
 *   acceptBtn: HTMLButtonElement,
 *   spcBtn: HTMLButtonElement,
 *   pdfBtn: HTMLButtonElement,
 *   status: HTMLElement,
 * } } dom
 * @param { Converted } result
 * @param { { acceptReview: boolean, fromPdf: boolean } } view
 */
export function project(dom, result, view) {
  const invoice = result.invoice;
  const amount = invoice?.amount === undefined ? "open" : String(invoice.amount);
  const reference = `${invoice?.referenceType ?? ""} ${invoice?.reference ?? ""}`.trim() || "—";
  dom.summary.replaceChildren();
  row(dom.summary, "Creditor", invoice?.creditor.name ?? "—", false);
  row(dom.summary, "Street", [invoice?.creditor.street, invoice?.creditor.buildingNumber].filter(Boolean).join(" ") || "—", false);
  row(dom.summary, "IBAN", invoice?.account ?? "—", true);
  row(dom.summary, "Amount", amount, true);
  row(dom.summary, "Currency", invoice?.currency ?? "—", true);
  row(dom.summary, "Reference", reference, true);
  row(dom.summary, "Address type", result.parsed.creditor.addressType.value || "—", false);

  list(dom.issues, result.validation.issues.map(issue => `${issue.severity}: ${issue.field} — ${issue.message}`));
  list(dom.review, result.review.map(item => `${item.path} = ${JSON.stringify(item.value)} (confidence ${item.confidence})`));

  const gate = canWrite(result, { acceptReview: view.acceptReview });
  const ready = gate.ok && Boolean(result.bytes);
  dom.acceptBtn.hidden = result.review.length === 0 || ready;
  dom.spcBtn.hidden = !ready;
  dom.pdfBtn.hidden = !ready;
  if (!gate.ok) setStatus(dom.status, "error", gate.error);
  else if (!result.bytes) setStatus(dom.status, "error", "No output bytes.");
  else {
    setStatus(
      dom.status,
      "ok",
      view.fromPdf
        ? "Ready. Banks read the restamped QR; printed type K on the page may remain."
        : "Ready to download.",
    );
  }
}

/**
 * @param { HTMLElement } el
 * @param { "empty" | "loading" | "error" | "ok" } kind
 * @param { string } text
 */
export function setStatus(el, kind, text) {
  el.dataset.kind = kind;
  el.textContent = text;
}

/**
 * @param { HTMLElement } parent
 * @param { string } key
 * @param { string } value
 * @param { boolean } locked
 */
function row(parent, key, value, locked) {
  const dt = document.createElement("dt");
  dt.textContent = locked ? `${key} (locked)` : key;
  const dd = document.createElement("dd");
  const input = document.createElement("input");
  input.value = value;
  input.readOnly = true;
  input.tabIndex = -1;
  if (locked) {
    input.className = "locked";
    input.setAttribute("aria-readonly", "true");
  }
  dd.append(input);
  parent.append(dt, dd);
}

/**
 * @param { HTMLElement } el
 * @param { string[] } items
 */
function list(el, items) {
  el.replaceChildren();
  for (const text of items) {
    const li = document.createElement("li");
    li.textContent = text;
    el.append(li);
  }
}
