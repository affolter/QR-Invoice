import type { ParsedAddress } from "./address.js";
import type { ParsedField } from "./parsed-field.js";

export type CurrencyCode = "CHF" | "EUR";
export type ReferenceType = "QRR" | "SCOR" | "NON";

/** Canonical invoice model consumed by the generator. Financial fields are never inferred. */
export interface InvoiceData {
  creditor: {
    name: string;
    street?: string;
    buildingNumber?: string;
    postalCode?: string;
    city?: string;
    country: string;
    account: string;
  };
  debtor?: {
    name: string;
    street?: string;
    buildingNumber?: string;
    postalCode?: string;
    city?: string;
    country: string;
  };
  account: string;
  amount?: number;
  currency: string;
  referenceType: string;
  reference?: string;
  additionalInformation?: string;
  message?: string;
  av1?: string;
  av2?: string;
  qrType: string;
  qrVersion: string;
}

export interface ParsedInvoice {
  qrType: ParsedField<string>;
  qrVersion: ParsedField<string>;
  coding: ParsedField<string>;
  account: ParsedField<string>;
  amount: ParsedField<number>;
  currency: ParsedField<string>;
  referenceType: ParsedField<string>;
  reference: ParsedField<string>;
  message: ParsedField<string>;
  additionalInformation: ParsedField<string>;
  av1: ParsedField<string>;
  av2: ParsedField<string>;
  creditor: ParsedAddress;
  debtor: ParsedAddress | null;
  trailer: ParsedField<string>;
}

export interface ReviewField {
  path: string;
  value: unknown;
  confidence: number;
  source: string;
}
