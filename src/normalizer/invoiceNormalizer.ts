import type { InvoiceData, ParsedInvoice, ReviewField } from "../models/invoice.js";
import type { ParsedAddress } from "../models/address.js";
import { copyIfPresent, needsReview, CONFIDENCE_REVIEW_THRESHOLD } from "../models/parsed-field.js";
import { normalizeAddress } from "./addressNormalizer.js";
import { normalizeIban } from "./ibanNormalizer.js";

export type NormalizedInvoice = {
  parsed: ParsedInvoice;
  invoice: InvoiceData | null;
  review: ReviewField[];
};

function collectAddressReview(prefix: string, address: ParsedAddress, review: ReviewField[]): void {
  const fields = [
    ["name", address.name],
    ["street", address.street],
    ["buildingNumber", address.buildingNumber],
    ["postalCode", address.postalCode],
    ["city", address.city],
    ["country", address.country],
  ] as const;
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

function toParty(address: ParsedAddress, account?: string) {
  const party: Record<string, unknown> = {
    name: address.name.value,
    country: address.country.value,
  };
  copyIfPresent(party, "street", address.street);
  copyIfPresent(party, "buildingNumber", address.buildingNumber);
  copyIfPresent(party, "postalCode", address.postalCode);
  copyIfPresent(party, "city", address.city);
  if (account) {
    party.account = account;
  }
  return party;
}

/**
 * Canonical InvoiceData. Address may be inferred; IBAN, amount, currency, reference are copied as-is.
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
  const parsedWithNorm = { ...parsed, creditor, debtor, account };

  if (!name || !country || !iban || !currency || !referenceType) {
    return { parsed: parsedWithNorm, invoice: null, review };
  }

  const invoice = {
    qrType: parsed.qrType.value ?? "SPC",
    qrVersion: parsed.qrVersion.value ?? "0200",
    account: iban,
    currency,
    referenceType,
    creditor: toParty(creditor, iban),
  } as InvoiceData;

  copyIfPresent(invoice, "amount", parsed.amount);
  copyIfPresent(invoice, "reference", parsed.reference);
  copyIfPresent(invoice, "message", parsed.message);
  copyIfPresent(invoice, "additionalInformation", parsed.additionalInformation);
  copyIfPresent(invoice, "av1", parsed.av1);
  copyIfPresent(invoice, "av2", parsed.av2);

  if (debtor?.name.value && debtor.country.value) {
    invoice.debtor = toParty(debtor) as InvoiceData["debtor"];
  }

  return {
    parsed: parsedWithNorm,
    invoice,
    review: review.filter((item) => item.confidence < CONFIDENCE_REVIEW_THRESHOLD),
  };
}
