/** @import { InvoiceData, Party } from "./models.js" */
/** @import { ValidationResult } from "./validate.js" */

import { validateInvoice } from "./validate.js";

/** Paths the review UI may never change. */
export const FINANCIAL_PATHS = Object.freeze([
  "account",
  "amount",
  "currency",
  "reference",
  "referenceType",
  "creditor.account",
]);

const ADDRESS_PATH = /^(creditor|debtor)\.(name|street|buildingNumber|postalCode|city|country)$/;

/** @type { ReadonlySet<string> } */
const LOCKED = new Set(FINANCIAL_PATHS);

/**
 * @typedef { {
 *   invoice: InvoiceData,
 *   validation: ValidationResult,
 *   review: [],
 * } } ReviewedInvoice
 */

/**
 * @param   { InvoiceData } invoice
 * @returns { InvoiceData }
 * @pure
 */
function cloneInvoice(invoice) {
  return {
    ...invoice,
    creditor: { ...invoice.creditor },
    ...(invoice.debtor ? { debtor: { ...invoice.debtor } } : {}),
  };
}

/**
 * @param { Party } party
 * @param { keyof Party } key
 * @param { string } value
 */
function setPartyField(party, key, value) {
  if (key === "name" || key === "country" || key === "account") {
    party[key] = value;
    return;
  }
  if (!value) {
    delete party[key];
    return;
  }
  party[key] = value;
}

/**
 * Copy structured address edits. IBAN, amount, currency, and reference stay as they were.
 *
 * @param   { InvoiceData }            invoice
 * @param   { Record<string, string> } patches
 * @returns { ReviewedInvoice }
 * @pure
 */
export function applyAddressReview(invoice, patches) {
  const next = cloneInvoice(invoice);
  for (const [path, raw] of Object.entries(patches)) {
    if (LOCKED.has(path) || !ADDRESS_PATH.test(path)) continue;
    const value = raw.trim();
    const [partyKey, field] = path.split(".");
    if (partyKey === "creditor" && field) {
      setPartyField(next.creditor, /** @type { keyof Party } */ (field), value);
    } else if (partyKey === "debtor" && field && next.debtor) {
      setPartyField(next.debtor, /** @type { keyof Party } */ (field), value);
    }
  }
  next.creditor.account = invoice.account;
  next.account = invoice.account;
  next.currency = invoice.currency;
  next.referenceType = invoice.referenceType;
  if (invoice.amount !== undefined) next.amount = invoice.amount;
  else delete next.amount;
  if (invoice.reference !== undefined) next.reference = invoice.reference;
  else delete next.reference;
  return {
    invoice: next,
    validation: validateInvoice(next),
    review: [],
  };
}
