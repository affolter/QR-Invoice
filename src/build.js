/** @import { InvoiceData, Party } from "./models.js" */

/** @param { string | undefined } value @returns { string } @pure */
const empty = value => value ?? "";

/**
 * @param   { Party } party
 * @returns { string[] }
 * @pure
 */
function addressFields(party) {
  return ["S", party.name, empty(party.street), empty(party.buildingNumber), empty(party.postalCode), empty(party.city), party.country];
}

/**
 * Swiss QR-bill SPC payload (IG master version 02). No third-party library.
 * @param   { InvoiceData } invoice
 * @returns { string }
 * @pure
 */
export function buildQrPayload(invoice) {
  const fields = [
    "SPC",
    invoice.qrVersion || "0200",
    "1",
    invoice.account,
    ...addressFields(invoice.creditor),
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    invoice.amount === undefined ? "" : invoice.amount.toFixed(2),
    invoice.currency,
    ...(invoice.debtor ? addressFields(invoice.debtor) : ["", "", "", "", "", "", ""]),
    invoice.referenceType,
    empty(invoice.reference),
    empty(invoice.message),
    "EPD",
  ];
  const extras = [invoice.additionalInformation, invoice.av1, invoice.av2];
  const lastUsed = extras.reduce((last, value, index) => (value ? index : last), -1);
  for (let i = 0; i <= lastUsed; i += 1) fields.push(empty(extras[i]));
  return fields.join("\n");
}
