/** @typedef { "qr" | "inferred" } FieldSource */
/** @typedef { "S" | "K" | "" } AddressType */

/**
 * A parsed payload field. Missing is `value: null` with confidence 0.
 * @template _T_
 * @typedef { { value: _T_ | null, confidence: number, source: FieldSource } } ParsedField
 */

export const REVIEW_THRESHOLD = 0.8;

/**
 * @template _T_
 * @param   { _T_ | null }  value
 * @param   { number }      confidence
 * @param   { FieldSource } source
 * @returns { ParsedField<_T_> }
 * @pure
 */
export const field = (value, confidence, source) => ({ value, confidence, source });

/**
 * @template _T_
 * @param   { _T_ }         value
 * @param   { FieldSource } [source="qr"]
 * @returns { ParsedField<_T_> }
 * @pure
 */
export const certain = (value, source = "qr") => field(value, 1, source);

/**
 * @template _T_
 * @param   { FieldSource } [source="qr"]
 * @returns { ParsedField<_T_> }
 * @pure
 */
export function missing(source = "qr") {
  return field(/** @type { _T_ | null } */ (null), 0, source);
}

/**
 * @param   { string[] } lines
 * @param   { number }   index
 * @returns { ParsedField<string> }
 * @pure
 */
export function fromLine(lines, index) {
  const value = lines[index] ?? "";
  return value ? certain(value) : missing();
}

/**
 * @param   { ParsedField<unknown> } parsed
 * @returns { boolean }
 * @pure
 */
export function needsReview(parsed) {
  return parsed.value != null && parsed.value !== "" && parsed.confidence < REVIEW_THRESHOLD;
}

/**
 * @typedef { {
 *   name: string,
 *   country: string,
 *   street?: string,
 *   buildingNumber?: string,
 *   postalCode?: string,
 *   city?: string,
 *   account?: string,
 * } } Party
 *
 * @typedef { {
 *   name: ParsedField<string>,
 *   street: ParsedField<string>,
 *   buildingNumber: ParsedField<string>,
 *   postalCode: ParsedField<string>,
 *   city: ParsedField<string>,
 *   country: ParsedField<string>,
 *   addressType: ParsedField<AddressType>,
 * } } ParsedAddress
 *
 * @typedef { {
 *   creditor: Party & { account: string },
 *   debtor?: Party,
 *   account: string,
 *   amount?: number,
 *   currency: string,
 *   referenceType: string,
 *   reference?: string,
 *   additionalInformation?: string,
 *   message?: string,
 *   av1?: string,
 *   av2?: string,
 *   qrType: string,
 *   qrVersion: string,
 * } } InvoiceData
 *
 * @typedef { {
 *   qrType: ParsedField<string>,
 *   qrVersion: ParsedField<string>,
 *   coding: ParsedField<string>,
 *   account: ParsedField<string>,
 *   amount: ParsedField<number>,
 *   currency: ParsedField<string>,
 *   referenceType: ParsedField<string>,
 *   reference: ParsedField<string>,
 *   message: ParsedField<string>,
 *   additionalInformation: ParsedField<string>,
 *   av1: ParsedField<string>,
 *   av2: ParsedField<string>,
 *   creditor: ParsedAddress,
 *   debtor: ParsedAddress | null,
 *   trailer: ParsedField<string>,
 * } } ParsedInvoice
 *
 * @typedef { {
 *   path: string,
 *   value: unknown,
 *   confidence: number,
 *   source: string,
 * } } ReviewField
 */
