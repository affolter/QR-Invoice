export type FieldSource = "qr" | "inferred";

export type ParsedField<T> = {
  value: T | null;
  confidence: number;
  source: FieldSource;
};

export const REVIEW_THRESHOLD = 0.8;

export const field = <T>(value: T | null, confidence: number, source: FieldSource): ParsedField<T> => ({
  value,
  confidence,
  source,
});

export const certain = <T>(value: T, source: FieldSource = "qr") => field(value, 1, source);
export const missing = <T>(source: FieldSource = "qr") => field<T>(null, 0, source);

export function fromLine<T extends string = string>(lines: string[], index: number): ParsedField<T> {
  const value = lines[index] ?? "";
  return value ? certain(value as T) : missing<T>();
}

export function needsReview(parsed: ParsedField<unknown>): boolean {
  return parsed.value != null && parsed.value !== "" && parsed.confidence < REVIEW_THRESHOLD;
}

export type AddressType = "S" | "K" | "";

export type Party = {
  name: string;
  street?: string;
  buildingNumber?: string;
  postalCode?: string;
  city?: string;
  country: string;
  account?: string;
};

export type ParsedAddress = {
  name: ParsedField<string>;
  street: ParsedField<string>;
  buildingNumber: ParsedField<string>;
  postalCode: ParsedField<string>;
  city: ParsedField<string>;
  country: ParsedField<string>;
  addressType: ParsedField<AddressType>;
};

export type InvoiceData = {
  creditor: Party & { account: string };
  debtor?: Party;
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
};

export type ParsedInvoice = {
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
};

export type ReviewField = {
  path: string;
  value: unknown;
  confidence: number;
  source: string;
};
