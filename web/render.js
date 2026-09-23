/** @import { Converted, Party } from "../src/index.js" */

import { canWrite } from "../src/index.js";

/**
 * @typedef { {
 *   summary:   HTMLElement,
 *   issues:    HTMLElement,
 *   review:    HTMLElement,
 *   acceptBtn: HTMLButtonElement,
 *   spcBtn:    HTMLButtonElement,
 *   pdfBtn:    HTMLButtonElement,
 *   status:    HTMLElement,
 * } } ReviewDom
 */

/** @type { HTMLElement | null } */
let summaryEl = null;

/** Address edits from the form. Money fields have no data-path. */
export const getAddressPatches = () => {
  /** @type { Record<string, string> } */
  const patches = {};
  if (!summaryEl) return patches;
  for (const node of Array.from(summaryEl.querySelectorAll("input[data-path]"))) {
    const input = /** @type { HTMLInputElement } */ (node);
    const path  = input.dataset.path;
    if (path) patches[path] = input.value;
  }
  return patches;
};

/**
 * @param { ReviewDom }                dom
 * @param { Converted }                result
 * @param { { fromPdf: boolean } }     view
 */
export const project = (dom, result, view) => {
  summaryEl = dom.summary;
  const invoice = result.invoice;
  dom.summary.replaceChildren();

  if (invoice) {
    bindParty(dom.summary, "creditor", invoice.creditor);
    bindRow(dom.summary, "IBAN",      invoice.account, true);
    bindRow(dom.summary, "Amount",    invoice.amount == null ? "open" : String(invoice.amount), true);
    bindRow(dom.summary, "Currency",  invoice.currency, true);
    bindRow(dom.summary, "Reference", `${invoice.referenceType} ${invoice.reference}`.trim() || "—", true);
    if (invoice.debtor) bindParty(dom.summary, "debtor", invoice.debtor);
  } else {
    bindRow(dom.summary, "Invoice", "Could not be built", true);
  }

  list(dom.issues, result.validation.issues.map(issue => `${issue.severity}: ${issue.field} — ${issue.message}`));
  list(dom.review, result.review.map(item => `${item.path} = ${JSON.stringify(item.value)} (confidence ${item.confidence})`));

  const gate        = canWrite(result, { acceptReview: result.review.length === 0 });
  const ready       = gate.ok && Boolean(result.bytes);
  const needsReview = result.review.length > 0;
  dom.acceptBtn.hidden = !needsReview;
  dom.spcBtn.hidden    = !ready;
  dom.pdfBtn.hidden    = !ready;

  if (needsReview) {
    setStatus(dom.status, "review", "Review the address fields, then accept. IBAN, amount, currency, and reference stay locked.");
  } else if (!gate.ok)     setStatus(dom.status, "error", gate.error);
  else if (!result.bytes)  setStatus(dom.status, "error", "Nothing to download yet.");
  else {
    setStatus(
      dom.status,
      "ok",
      view.fromPdf
        ? "Ready. Banks read the restamped QR; printed address lines on the page are not rewritten."
        : "Ready to download.",
    );
  }
};

/**
 * @param { HTMLElement }             parent
 * @param { "creditor" | "debtor" }   prefix
 * @param { Party }                   party
 */
const bindParty = (parent, prefix, party) => {
  const label = prefix === "creditor" ? "Creditor" : "Debtor";
  bindRow(parent, `${label} name`,  party.name,           false, `${prefix}.name`);
  bindRow(parent, "Street",         party.street,         false, `${prefix}.street`);
  bindRow(parent, "Building",       party.buildingNumber, false, `${prefix}.buildingNumber`);
  bindRow(parent, "Postal code",    party.postalCode,     false, `${prefix}.postalCode`);
  bindRow(parent, "City",           party.city,           false, `${prefix}.city`);
  bindRow(parent, "Country",        party.country,        false, `${prefix}.country`);
};

/**
 * @param { HTMLElement } parent
 * @param { string }      key
 * @param { string }      value
 * @param { boolean }     locked
 * @param { string }      [path]
 */
const bindRow = (parent, key, value, locked, path) => {
  const dt    = document.createElement("dt");
  const dd    = document.createElement("dd");
  const input = document.createElement("input");
  dt.textContent = locked ? `${key} (locked)` : key;
  input.value    = value;
  if (path) input.dataset.path = path;
  if (locked) {
    input.readOnly  = true;
    input.tabIndex  = -1;
    input.className = "locked";
  }
  dd.append(input);
  parent.append(dt, dd);
};

/**
 * @param { HTMLElement }                                            el
 * @param { "empty" | "loading" | "error" | "ok" | "review" }        kind
 * @param { string }                                                 text
 */
export const setStatus = (el, kind, text) => {
  el.dataset.kind = kind;
  el.textContent  = text;
};

/**
 * @param { HTMLElement } el
 * @param { string[] }    items
 */
const list = (el, items) => {
  el.replaceChildren();
  for (const text of items) {
    const li = document.createElement("li");
    li.textContent = text;
    el.append(li);
  }
};
