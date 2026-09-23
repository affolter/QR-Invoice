/** @import { InvoiceData, Party } from "./models.js" */

/**
 * @typedef { "error" | "warning" } Severity
 * @typedef { {
 *   severity: Severity,
 *   code:     string,
 *   field:    string,
 *   message:  string,
 * } } Issue
 * @typedef { {
 *   valid:  boolean,
 *   issues: Issue[],
 * } } ValidationResult
 */

/**
 * @param   { string } digits
 * @returns { number }
 * @pure
 */
const mod10 = digits => {
  const table = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];
  let carry = 0;
  for (const char of digits) carry = table[(carry + Number(char)) % 10] ?? 0;
  return (10 - carry) % 10;
};

/**
 * @param   { string } compact
 * @returns { boolean }
 * @pure
 */
const mod97Ok = compact => {
  const rearranged = compact.slice(4) + compact.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, ch => String(ch.charCodeAt(0) - 55));
  let remainder = 0;
  for (const char of numeric) remainder = (remainder * 10 + Number(char)) % 97;
  return remainder === 1;
};

/**
 * @param   { Severity } severity
 * @param   { string }   code
 * @param   { string }   field
 * @param   { string }   message
 * @returns { Issue }
 * @pure
 */
const issue = (severity, code, field, message) => ({
  severity,
  code,
  field,
  message,
});

/**
 * @param   { string } prefix
 * @param   { Party }  party
 * @returns { Issue[] }
 * @pure
 */
const addressIssues = (prefix, party) => {
  /** @type { Issue[] } */
  const issues = [];
  /**
   * @param { Severity } severity
   * @param { string }   code
   * @param { string }   key
   * @param { string }   message
   */
  const add = (severity, code, key, message) =>
    issues.push(issue(severity, code, `${prefix}.${key}`, message));
  if (!party.name || party.name.length > 70) add("error", "address.name", "name", "Name is required and must be at most 70 characters.");
  if (!party.country || !/^[A-Z]{2}$/.test(party.country)) add("error", "address.country", "country", "Country must be an ISO 3166-1 alpha-2 code.");
  /** @type { Array<[keyof Party, number]> } */
  const max = [
    ["street", 70],
    ["buildingNumber", 16],
    ["postalCode", 16],
    ["city", 35],
  ];
  for (const [key, limit] of max) {
    const value = party[key];
    if (value.length > limit) {
      add("error", `address.${key}`, key, `${String(key)} must be at most ${limit} characters.`);
    }
  }
  if (!party.postalCode) add("error", "address.postalCode", "postalCode", "Postal code is required for a structured address.");
  if (!party.city) add("error", "address.city", "city", "City is required for a structured address.");
  if (!party.street && party.buildingNumber) add("warning", "address.street", "street", "Building number is set without a street.");
  return issues;
};

/**
 * SIX QR-bill rules. Does not rewrite IBAN, amount, currency, or reference.
 * @param   { InvoiceData | null } invoice
 * @returns { ValidationResult }
 * @pure
 */
export const validateInvoice = invoice => {
  if (!invoice) {
    return { valid: false, issues: [issue("error", "invoice.missing", "invoice", "Invoice could not be built from the QR payload.")] };
  }
  /** @type { Issue[] } */
  const issues = [];
  const iban = invoice.account.replace(/\s+/g, "").toUpperCase();
  const unchanged = "The value was not changed.";
  if (!/^(CH|LI)[A-Z0-9]{19}$/.test(iban)) {
    issues.push(issue("error", "iban.format", "account", "IBAN must be 21 characters starting with CH or LI."));
  } else if (!mod97Ok(iban)) {
    issues.push(issue("error", "iban.checksum", "account", `IBAN checksum is invalid. ${unchanged}`));
  }
  if (invoice.currency !== "CHF" && invoice.currency !== "EUR") {
    issues.push(issue("error", "currency", "currency", `Currency must be CHF or EUR. ${unchanged}`));
  }
  if (invoice.amount != null) {
    if (!(invoice.amount >= 0.01 && invoice.amount <= 999_999_999.99)) {
      issues.push(issue("error", "amount.range", "amount", "Amount must be between 0.01 and 999999999.99."));
    }
    const cents = Math.round(invoice.amount * 100);
    if (Math.abs(invoice.amount * 100 - cents) > 1e-6) {
      issues.push(issue("error", "amount.decimals", "amount", `Amount must have at most two decimal places. ${unchanged}`));
    }
  } else {
    issues.push(issue("warning", "amount.empty", "amount", "Amount is empty (open-amount QR-bill)."));
  }
  const iid = /^(CH|LI)\d{19}$/.test(iban) ? Number(iban.slice(4, 9)) : null;
  const qrIban = iid !== null && iid >= 30000 && iid <= 31999;
  const refType = invoice.referenceType;
  const reference = invoice.reference;
  if (refType !== "QRR" && refType !== "SCOR" && refType !== "NON") {
    issues.push(issue("error", "reference.type", "referenceType", "Reference type must be QRR, SCOR, or NON."));
  }
  if (qrIban && refType !== "QRR") issues.push(issue("error", "reference.qr-iban", "referenceType", "A QR-IBAN requires reference type QRR. Values were not changed."));
  if (!qrIban && refType === "QRR") issues.push(issue("error", "reference.qrr-iban", "referenceType", "QRR is only valid with a QR-IBAN. Values were not changed."));
  if (refType === "QRR") {
    if (!/^\d{27}$/.test(reference)) issues.push(issue("error", "reference.qrr.format", "reference", `QR reference must be exactly 27 digits. ${unchanged}`));
    else if (mod10(reference.slice(0, 26)) !== Number(reference[26])) {
      issues.push(issue("error", "reference.qrr.checksum", "reference", `QR reference check digit is invalid. ${unchanged}`));
    }
  }
  if (refType === "SCOR") {
    const compact = reference.replace(/\s+/g, "").toUpperCase();
    if (!/^RF\d{2}[A-Z0-9]{1,21}$/.test(compact) || !mod97Ok(compact)) {
      issues.push(issue("error", "reference.scor", "reference", `Creditor reference must be a valid ISO 11649 RF reference. ${unchanged}`));
    }
  }
  if (refType === "NON" && reference) issues.push(issue("error", "reference.non", "reference", "NON reference type must not carry a structured reference."));
  if (invoice.message.length > 140) issues.push(issue("error", "message.length", "message", "Unstructured message must be at most 140 characters."));
  if (invoice.addInfos.length > 140) {
    issues.push(issue("error", "billingInfo.length", "addInfos", "Billing information must be at most 140 characters."));
  }
  issues.push(...addressIssues("creditor", invoice.creditor));
  if (invoice.debtor) issues.push(...addressIssues("debtor", invoice.debtor));
  if (invoice.creditor.account !== invoice.account) {
    issues.push(issue("error", "iban.mismatch", "account", "Creditor account and invoice account must be identical."));
  }
  return { valid: issues.every(item => item.severity !== "error"), issues };
};
