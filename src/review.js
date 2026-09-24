/** @import { InvoiceData, Party } from "./models.js" */
/** @import { ValidationResult } from "./validate.js" */

import { invoice } from "./models.js";
import { validateInvoice } from "./validate.js";

/** Paths the review UI may never change. */
const LOCKED = new Set([
  "account",
  "amount",
  "currency",
  "reference",
  "referenceType",
  "creditor.account",
]);

const ADDRESS_PATH = /^(creditor|debtor)\.(name|street|buildingNumber|postalCode|city|country)$/;

/**
 * @typedef { {
 *   invoice:     InvoiceData,
 *   validation:  ValidationResult,
 *   review:      [],
 * } } ReviewedInvoice
 */

/**
 * @param   { Party }                               party
 * @param   { Exclude<keyof Party, "addressType"> } key
 * @param   { string }                              value
 * @returns { Party }
 * @pure
 */
const withPartyField = (party, key, value) => ({ ...party, [key]: value });

/**
 * @param   { Party }                  party
 * @param   { "creditor" | "debtor" }  role
 * @param   { Record<string, string> } patches
 * @returns { Party }
 * @pure
 */
const applyPartyPatches = (party, role, patches) =>
  Object.entries(patches).reduce((next, [path, raw]) => {
    if (LOCKED.has(path) || !ADDRESS_PATH.test(path)) return next;
    const [partyKey, field] = path.split(".");
    if (partyKey !== role || !field) return next;
    return withPartyField(next, /** @type { Exclude<keyof Party, "addressType"> } */ (field), raw.trim());
  }, party);

/**
 * Copy structured address edits. IBAN, amount, currency, and reference stay as they were.
 *
 * @param   { InvoiceData }            current
 * @param   { Record<string, string> } patches
 * @returns { ReviewedInvoice }
 * @pure
 */
export const applyAddressReview = (current, patches) => {
  const next = invoice({
    ...current,
    creditor: applyPartyPatches(current.creditor, "creditor", patches),
    debtor:   current.debtor ? applyPartyPatches(current.debtor, "debtor", patches) : null,
  });
  return {
    invoice:    next,
    validation: validateInvoice(next),
    review:     [],
  };
};
