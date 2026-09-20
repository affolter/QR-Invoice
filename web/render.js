/** @import { Converted, Party } from "@qr-invoice/core" */
/** @import { ObservableType } from "./observable.js" */

import { canWrite } from "@qr-invoice/core";
import { Observable } from "./observable.js";

/**
 * @typedef { {
 *   summary: HTMLElement,
 *   issues: HTMLElement,
 *   review: HTMLElement,
 *   acceptBtn: HTMLButtonElement,
 *   spcBtn: HTMLButtonElement,
 *   pdfBtn: HTMLButtonElement,
 *   status: HTMLElement,
 * } } ReviewDom
 */

/** @type { Map<string, ObservableType<string>> } */
const addressFields = new Map();

/**
 * Address patches from the projector. Financial fields are not in this map.
 * @returns { Record<string, string> }
 */
export function getAddressPatches() {
  /** @type { Record<string, string> } */
  const patches = {};
  for (const [path, obs] of addressFields) patches[path] = obs.getValue();
  return patches;
}

/**
 * Projector: Converted → DOM. Address Observables are editable; money fields stay locked.
 *
 * @param { ReviewDom } dom
 * @param { Converted } result
 * @param { { fromPdf: boolean } } view
 */
export function project(dom, result, view) {
  addressFields.clear();
  const invoice = result.invoice;
  dom.summary.replaceChildren();

  if (invoice) {
    bindParty(dom.summary, "creditor", invoice.creditor);
    bindLocked(dom.summary, "IBAN", invoice.account);
    bindLocked(dom.summary, "Amount", invoice.amount === undefined ? "open" : String(invoice.amount));
    bindLocked(dom.summary, "Currency", invoice.currency);
    bindLocked(
      dom.summary,
      "Reference",
      `${invoice.referenceType} ${invoice.reference ?? ""}`.trim() || "—",
    );
    if (invoice.debtor) bindParty(dom.summary, "debtor", invoice.debtor);
  } else {
    bindLocked(dom.summary, "Invoice", "Could not be built");
  }

  list(dom.issues, result.validation.issues.map(issue => `${issue.severity}: ${issue.field} — ${issue.message}`));
  list(dom.review, result.review.map(item => `${item.path} = ${JSON.stringify(item.value)} (confidence ${item.confidence})`));

  const gate = canWrite(result, { acceptReview: result.review.length === 0 });
  const ready = gate.ok && Boolean(result.bytes);
  const needsReview = result.review.length > 0;
  dom.acceptBtn.hidden = !needsReview;
  dom.spcBtn.hidden = !ready;
  dom.pdfBtn.hidden = !ready;

  if (needsReview) {
    setStatus(dom.status, "review", "Review the address fields, then accept. IBAN, amount, currency, and reference stay locked.");
  } else if (!gate.ok) setStatus(dom.status, "error", gate.error);
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
 * @param { HTMLElement } parent
 * @param { "creditor" | "debtor" } prefix
 * @param { Party } party
 */
function bindParty(parent, prefix, party) {
  const label = prefix === "creditor" ? "Creditor" : "Debtor";
  bindAddress(parent, `${label} name`, `${prefix}.name`, party.name);
  bindAddress(parent, "Street", `${prefix}.street`, party.street ?? "");
  bindAddress(parent, "Building", `${prefix}.buildingNumber`, party.buildingNumber ?? "");
  bindAddress(parent, "Postal code", `${prefix}.postalCode`, party.postalCode ?? "");
  bindAddress(parent, "City", `${prefix}.city`, party.city ?? "");
  bindAddress(parent, "Country", `${prefix}.country`, party.country);
}

/**
 * @param { HTMLElement } parent
 * @param { string } label
 * @param { string } path
 * @param { string } value
 */
function bindAddress(parent, label, path, value) {
  const obs = Observable(value);
  addressFields.set(path, obs);
  bindRow(parent, label, obs, { locked: false, path });
}

/**
 * @param { HTMLElement } parent
 * @param { string } label
 * @param { string } value
 */
function bindLocked(parent, label, value) {
  bindRow(parent, label, Observable(value), { locked: true });
}

/**
 * @param { HTMLElement } el
 * @param { "empty" | "loading" | "error" | "ok" | "review" } kind
 * @param { string } text
 */
export function setStatus(el, kind, text) {
  el.dataset.kind = kind;
  el.textContent = text;
}

/**
 * @param { HTMLElement } parent
 * @param { string } key
 * @param { ObservableType<string> } obs
 * @param { { locked: boolean, path?: string } } options
 */
function bindRow(parent, key, obs, options) {
  const dt = document.createElement("dt");
  dt.textContent = options.locked ? `${key} (locked)` : key;
  const dd = document.createElement("dd");
  const input = document.createElement("input");
  if (options.path) input.dataset.path = options.path;
  if (options.locked) {
    input.readOnly = true;
    input.tabIndex = -1;
    input.className = "locked";
    input.setAttribute("aria-readonly", "true");
  } else {
    input.addEventListener("input", () => obs.setValue(input.value));
  }
  obs.onChange(value => {
    if (input.value !== value) input.value = value;
  });
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
