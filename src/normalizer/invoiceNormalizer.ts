import type { InvoiceData, ParsedInvoice } from "../models/invoice.js";
import { needsReview, CONFIDENCE_REVIEW_THRESHOLD } from "../models/parsed-field.js";
import type { ParsedAddress } from "../models/address.js";
import type { ReviewField } from "../models/invoice.js";
import { normalizeAddress } from "./addressNormalizer.js";
import { normalizeIban } from "./ibanNormalizer.js";

export interface NormalizedInvoice {
  parsed: ParsedInvoice;
  invoice: InvoiceData | null;
  review: ReviewField[];
}

function collectAddressReview(prefix: string, address: ParsedAddress, review: ReviewField[]): void {
  const fields: Array<[string, ParsedAddress[keyof ParsedAddress]]> = [
    ["name", address.name],
    ["street", address.street],
    ["buildingNumber", address.buildingNumber],
    ["postalCode", address.postalCode],
    ["city", address.city],
    ["country", address.country],
  ];
  for (const [name, field] of fields) {
    if (needsReview(field)) {
      review.push({
        path: `${prefix}.${name}`,
        value: field.value,
        confidence: field.confidence,
        source: field.source,
      });
    }
  }
}

function requiredString(value: string | null | undefined): string {
  return value ?? "";
}

/**
 * Builds the canonical InvoiceData. Address fields may be inferred; IBAN, amount,
 * currency and reference are copied from the QR payload without heuristic repair.
 */
export function normalizeInvoice(parsed: ParsedInvoice): NormalizedInvoice {
  const review: ReviewField[] = [];
  const creditor = normalizeAddress(parsed.creditor);
  const debtor = parsed.debtor ? normalizeAddress(parsed.debtor) : null;
  const account = normalizeIban(parsed.account.value, parsed.account.source);

  collectAddressReview("creditor", creditor, review);
  if (debtor) {
    collectAddressReview("debtor", debtor, review);
  }
  if (needsReview(account)) {
    review.push({
      path: "account",
      value: account.value,
      confidence: account.confidence,
      source: account.source,
    });
  }

  const currency = parsed.currency.value;
  const referenceType = parsed.referenceType.value;
  const name = creditor.name.value;
  const country = creditor.country.value;
  const iban = account.value;

  if (!name || !country || !iban || !currency || !referenceType) {
    return { parsed: { ...parsed, creditor, debtor, account }, invoice: null, review };
  }

  const invoice: InvoiceData = {
    qrType: parsed.qrType.value ?? "SPC",
    qrVersion: parsed.qrVersion.value ?? "0200",
    account: iban,
    currency,
    referenceType,
    creditor: {
      name,
      street: creditor.street.value ?? undefined,
      buildingNumber: creditor.buildingNumber.value ?? undefined,
      postalCode: creditor.postalCode.value ?? undefined,
      city: creditor.city.value ?? undefined,
      country,
      account: iban,
    },
  };

  if (parsed.amount.value !== null) {
    invoice.amount = parsed.amount.value;
  }
  if (parsed.reference.value) {
    invoice.reference = parsed.reference.value;
  }
  if (parsed.message.value) {
    invoice.message = parsed.message.value;
  }
  if (parsed.additionalInformation.value) {
    invoice.additionalInformation = parsed.additionalInformation.value;
  }
  if (parsed.av1.value) {
    invoice.av1 = parsed.av1.value;
  }
  if (parsed.av2.value) {
    invoice.av2 = parsed.av2.value;
  }
  if (debtor?.name.value && debtor.country.value) {
    invoice.debtor = {
      name: requiredString(debtor.name.value),
      street: debtor.street.value ?? undefined,
      buildingNumber: debtor.buildingNumber.value ?? undefined,
      postalCode: debtor.postalCode.value ?? undefined,
      city: debtor.city.value ?? undefined,
      country: debtor.country.value,
    };
  }

  return {
    parsed: { ...parsed, creditor, debtor, account },
    invoice,
    review: review.filter((item) => item.confidence < CONFIDENCE_REVIEW_THRESHOLD),
  };
}
