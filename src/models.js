/** @typedef { "qr" | "inferred" } FieldSource */
/** @typedef { "S" | "K" | "" } AddressType */

/**
 * A parsed payload field. Missing is `value: null` with confidence 0.
 * @template _T_
 * @typedef { {
 *   value:      _T_ | null,
 *   confidence: number,
 *   source:     FieldSource,
 * } } ParsedField
 */

export const REVIEW_THRESHOLD = 0.8;

/**
 * Wrap a present value. Do not pass `null` — use {@link missing}.
 * @template _T_
 * @param   { _T_ }         value
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
 * Empty field of type `_T_`. Own constructor so we do not ask `field(null)` to guess `_T_`.
 * @template _T_
 * @param   { FieldSource } [source="qr"]
 * @returns { ParsedField<_T_> }
 * @pure
 */
export const missing = (source = "qr") => ({ value: null, confidence: 0, source });

/**
 * @param   { string[] } lines
 * @param   { number }   index
 * @returns { ParsedField<string> }
 * @pure
 */
export const fromLine = (lines, index) => {
  const value = lines[index] ?? "";
  return value ? certain(value) : missing();
};

/**
 * @param   { ParsedField<unknown> } parsed
 * @returns { boolean }
 * @pure
 */
export const needsReview = parsed =>
  parsed.value != null && parsed.value !== "" && parsed.confidence < REVIEW_THRESHOLD;

/**
 * Plain address on {@link InvoiceData}. Address lines are always strings; missing is `""`.
 * @typedef { {
 *   addressType:    AddressType,
 *   name:           string,
 *   street:         string,
 *   buildingNumber: string,
 *   postalCode:     string,
 *   city:           string,
 *   country:        string,
 * } } Party
 */

/**
 * @param   { {
 *   name:            string,
 *   country:         string,
 *   addressType?:    AddressType,
 *   street?:         string,
 *   buildingNumber?: string,
 *   postalCode?:     string,
 *   city?:           string,
 * } } fields
 * @returns { Party }
 * @pure
 */
export const party = fields => ({
  addressType:    fields.addressType === "K" ? "K" : "S",
  name:           fields.name           ?? "",
  street:         fields.street         ?? "",
  buildingNumber: fields.buildingNumber ?? "",
  postalCode:     fields.postalCode     ?? "",
  city:           fields.city           ?? "",
  country:        fields.country        ?? "",
});

/**
 * Working address while we parse and normalize. Every line is a {@link ParsedField}.
 * @typedef { {
 *   addressType:    ParsedField<AddressType>,
 *   name:           ParsedField<string>,
 *   street:         ParsedField<string>,
 *   buildingNumber: ParsedField<string>,
 *   postalCode:     ParsedField<string>,
 *   city:           ParsedField<string>,
 *   country:        ParsedField<string>,
 * } } ParsedAddress
 */

/**
 * @param   { Partial<ParsedAddress> } [fields]
 * @param   { FieldSource }            [source="qr"]
 * @returns { ParsedAddress }
 * @pure
 */
export const parsedAddress = (fields = {}, source = "qr") => ({
  addressType:    fields.addressType    ?? missing(source),
  name:           fields.name           ?? missing(source),
  street:         fields.street         ?? missing(source),
  buildingNumber: fields.buildingNumber ?? missing(source),
  postalCode:     fields.postalCode     ?? missing(source),
  city:           fields.city           ?? missing(source),
  country:        fields.country        ?? missing(source),
});

/**
 * Canonical QR-bill. Blank optional lines are `""`. Amount `null` is an open-amount bill.
 * Debtor `null` is no debtor. Ultimate creditor is not a field — build emits empty lines for it.
 * @typedef { {
 *   creditor:      Party & { account: string },
 *   debtor:        Party  | null,
 *   account:       string,
 *   amount:        number | null,
 *   currency:      string,
 *   referenceType: string,
 *   reference:     string,
 *   addInfos:      string,
 *   message:       string,
 *   av1:           string,
 *   av2:           string,
 *   qrType:        string,
 *   qrVersion:     string,
 * } } InvoiceData
 */

/**
 * @param   { {
 *   account:       string,
 *   currency:      string,
 *   referenceType: string,
 *   creditor:      Party,
 *   debtor?:       Party  | null,
 *   amount?:       number | null,
 *   reference?:    string,
 *   message?:      string,
 *   addInfos?:     string,
 *   av1?:          string,
 *   av2?:          string,
 *   qrType?:       string,
 *   qrVersion?:    string,
 * } } fields
 * @returns { InvoiceData }
 * @pure
 */
export const invoice = fields => ({
  qrType:           fields.qrType    ?? "SPC",
  qrVersion:        fields.qrVersion ?? "0200",
  account:          fields.account,
  currency:         fields.currency,
  referenceType:    fields.referenceType,
  creditor:         { ...fields.creditor, account: fields.account },
  debtor:           fields.debtor    ?? null,
  amount:           fields.amount    ?? null,
  reference:        fields.reference ?? "",
  message:          fields.message   ?? "",
  addInfos:         fields.addInfos  ?? "",
  av1:              fields.av1       ?? "",
  av2:              fields.av2       ?? "",
});

/**
 * @typedef { {
 *   qrType:        ParsedField<string>,
 *   qrVersion:     ParsedField<string>,
 *   coding:        ParsedField<string>,
 *   account:       ParsedField<string>,
 *   amount:        ParsedField<number>,
 *   currency:      ParsedField<string>,
 *   referenceType: ParsedField<string>,
 *   reference:     ParsedField<string>,
 *   message:       ParsedField<string>,
 *   addInfos:      ParsedField<string>,
 *   av1:           ParsedField<string>,
 *   av2:           ParsedField<string>,
 *   creditor:      ParsedAddress,
 *   debtor:        ParsedAddress | null,
 *   trailer:       ParsedField<string>,
 * } } ParsedInvoice
 *
 * @typedef { {
 *   path:       string,
 *   value:      unknown,
 *   confidence: number,
 *   source:     string,
 * } } ReviewField
 */
