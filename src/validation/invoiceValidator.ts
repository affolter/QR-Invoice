import type { InvoiceData } from "../models/invoice.js";

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

const QR_IID_MIN = 30000;
const QR_IID_MAX = 31999;

function mod10Recursive(digits: string): number {
  const table = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];
  let carry = 0;
  for (const char of digits) {
    carry = table[(carry + Number(char)) % 10] ?? 0;
  }
  return (10 - carry) % 10;
}

function ibanChecksumOk(iban: string): boolean {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  let remainder = 0;
  for (const char of numeric) {
    remainder = (remainder * 10 + Number(char)) % 97;
  }
  return remainder === 1;
}

function iso11649Ok(reference: string): boolean {
  const compact = reference.replace(/\s+/g, "").toUpperCase();
  if (!/^RF\d{2}[A-Z0-9]{1,21}$/.test(compact)) {
    return false;
  }
  const rearranged = compact.slice(4) + compact.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  let remainder = 0;
  for (const char of numeric) {
    remainder = (remainder * 10 + Number(char)) % 97;
  }
  return remainder === 1;
}

function qrIid(iban: string): number | null {
  if (!/^(CH|LI)\d{19}$/.test(iban)) {
    return null;
  }
  return Number(iban.slice(4, 9));
}

function issue(
  severity: ValidationSeverity,
  code: string,
  field: string,
  message: string,
): ValidationIssue {
  return { severity, code, field, message };
}

function addressIssues(prefix: string, party: InvoiceData["creditor"] | NonNullable<InvoiceData["debtor"]>, required: boolean): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!party.name || party.name.length > 70) {
    issues.push(issue("error", "address.name", `${prefix}.name`, "Name is required and must be at most 70 characters."));
  }
  if (!party.country || !/^[A-Z]{2}$/.test(party.country)) {
    issues.push(issue("error", "address.country", `${prefix}.country`, "Country must be an ISO 3166-1 alpha-2 code."));
  }
  if (party.street && party.street.length > 70) {
    issues.push(issue("error", "address.street", `${prefix}.street`, "Street must be at most 70 characters."));
  }
  if (party.buildingNumber && party.buildingNumber.length > 16) {
    issues.push(issue("error", "address.buildingNumber", `${prefix}.buildingNumber`, "Building number must be at most 16 characters."));
  }
  if (party.postalCode && party.postalCode.length > 16) {
    issues.push(issue("error", "address.postalCode", `${prefix}.postalCode`, "Postal code must be at most 16 characters."));
  }
  if (party.city && party.city.length > 35) {
    issues.push(issue("error", "address.city", `${prefix}.city`, "City must be at most 35 characters."));
  }
  if (required && !party.postalCode) {
    issues.push(issue("error", "address.postalCode", `${prefix}.postalCode`, "Postal code is required for a structured address."));
  }
  if (required && !party.city) {
    issues.push(issue("error", "address.city", `${prefix}.city`, "City is required for a structured address."));
  }
  if (!party.street && party.buildingNumber) {
    issues.push(issue("warning", "address.street", `${prefix}.street`, "Building number is set without a street."));
  }
  return issues;
}

/**
 * Validates canonical invoice data against SIX QR-bill rules.
 * Does not rewrite IBAN, amount, currency, or reference.
 */
export function validateInvoice(invoice: InvoiceData | null): ValidationResult {
  if (!invoice) {
    return {
      valid: false,
      issues: [issue("error", "invoice.missing", "invoice", "Invoice could not be built from the QR payload.")],
    };
  }

  const issues: ValidationIssue[] = [];
  const iban = invoice.account.replace(/\s+/g, "").toUpperCase();

  if (iban !== invoice.account) {
    issues.push(issue("warning", "iban.spaces", "account", "IBAN contained spaces that were stripped for validation only; the stored value is the compact form from normalization."));
  }
  if (!/^(CH|LI)[A-Z0-9]{19}$/.test(iban)) {
    issues.push(issue("error", "iban.format", "account", "IBAN must be 21 characters starting with CH or LI."));
  } else if (!ibanChecksumOk(iban)) {
    issues.push(issue("error", "iban.checksum", "account", "IBAN checksum is invalid. The value was not changed."));
  }

  if (invoice.currency !== "CHF" && invoice.currency !== "EUR") {
    issues.push(issue("error", "currency", "currency", "Currency must be CHF or EUR. The value was not changed."));
  }

  if (invoice.amount !== undefined) {
    if (!(invoice.amount >= 0.01 && invoice.amount <= 999_999_999.99)) {
      issues.push(issue("error", "amount.range", "amount", "Amount must be between 0.01 and 999999999.99."));
    }
    const cents = Math.round(invoice.amount * 100);
    if (Math.abs(invoice.amount * 100 - cents) > 1e-6) {
      issues.push(issue("error", "amount.decimals", "amount", "Amount must have at most two decimal places. The value was not changed."));
    }
  } else {
    issues.push(issue("warning", "amount.empty", "amount", "Amount is empty (open-amount QR-bill)."));
  }

  const iid = qrIid(iban);
  const isQrIban = iid !== null && iid >= QR_IID_MIN && iid <= QR_IID_MAX;
  const refType = invoice.referenceType;
  const reference = invoice.reference ?? "";

  if (refType !== "QRR" && refType !== "SCOR" && refType !== "NON") {
    issues.push(issue("error", "reference.type", "referenceType", "Reference type must be QRR, SCOR, or NON."));
  }

  if (isQrIban && refType !== "QRR") {
    issues.push(issue("error", "reference.qr-iban", "referenceType", "A QR-IBAN requires reference type QRR. Values were not changed."));
  }
  if (!isQrIban && refType === "QRR") {
    issues.push(issue("error", "reference.qrr-iban", "referenceType", "QRR is only valid with a QR-IBAN. Values were not changed."));
  }

  if (refType === "QRR") {
    if (!/^\d{27}$/.test(reference)) {
      issues.push(issue("error", "reference.qrr.format", "reference", "QR reference must be exactly 27 digits. The value was not changed."));
    } else if (mod10Recursive(reference.slice(0, 26)) !== Number(reference[26])) {
      issues.push(issue("error", "reference.qrr.checksum", "reference", "QR reference check digit is invalid. The value was not changed."));
    }
  }

  if (refType === "SCOR") {
    if (!iso11649Ok(reference)) {
      issues.push(issue("error", "reference.scor", "reference", "Creditor reference must be a valid ISO 11649 RF reference. The value was not changed."));
    }
  }

  if (refType === "NON" && reference) {
    issues.push(issue("error", "reference.non", "reference", "NON reference type must not carry a structured reference."));
  }

  if (invoice.message && invoice.message.length > 140) {
    issues.push(issue("error", "message.length", "message", "Unstructured message must be at most 140 characters."));
  }
  if (invoice.additionalInformation && invoice.additionalInformation.length > 140) {
    issues.push(issue("error", "billingInfo.length", "additionalInformation", "Billing information must be at most 140 characters."));
  }

  issues.push(...addressIssues("creditor", invoice.creditor, true));
  if (invoice.debtor) {
    issues.push(...addressIssues("debtor", invoice.debtor, true));
  }

  if (invoice.creditor.account !== invoice.account) {
    issues.push(issue("error", "iban.mismatch", "account", "Creditor account and invoice account must be identical."));
  }

  return {
    valid: issues.every((item) => item.severity !== "error"),
    issues,
  };
}
