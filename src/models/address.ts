import type { ParsedField } from "./parsed-field.js";

export type AddressType = "S" | "K" | "";

export interface Address {
  name: string;
  street?: string;
  buildingNumber?: string;
  postalCode?: string;
  city?: string;
  country: string;
}

export interface ParsedAddress {
  name: ParsedField<string>;
  street: ParsedField<string>;
  buildingNumber: ParsedField<string>;
  postalCode: ParsedField<string>;
  city: ParsedField<string>;
  country: ParsedField<string>;
  addressType: ParsedField<AddressType>;
}
