/** @import { InvoiceData, Party } from "./models.js" */

/**
 * Seven SPC address lines, in spec order.
 * @param   { Party } party
 * @returns { string[] }
 * @pure
 */
const addressFields = ({
  addressType,
  name,
  street,
  buildingNumber,
  postalCode,
  city,
  country,
}) => [
  addressType,
  name,
  street,
  buildingNumber,
  postalCode,
  city,
  country,
];

/** Spec slots that are not InvoiceData: unused ultimate creditor, and a missing debtor. */
const EMPTY_ADDRESS           = Array(7).fill("");
const EMPTY_ULTIMATE_CREDITOR = EMPTY_ADDRESS;

/**
 * Swiss QR-bill SPC payload (IG master version 02). Inverse of parse: named invoice → line list → join.
 * @param   { InvoiceData } invoice
 * @returns { string }
 * @pure
 */
export const buildQrPayload = invoice => {
  const fields = [
    "SPC",
    invoice.qrVersion,
    "1",
    invoice.account,
    ...addressFields(invoice.creditor),
    ...EMPTY_ULTIMATE_CREDITOR,
    invoice.amount == null ? "" : invoice.amount.toFixed(2),
    invoice.currency,
    ...(invoice.debtor ? addressFields(invoice.debtor) : EMPTY_ADDRESS),
    invoice.referenceType,
    invoice.reference,
    invoice.message,
    "EPD",
  ];

  const extras = [
    invoice.addInfos,
    invoice.av1,
    invoice.av2,
  ];

  // Keep extras through the last used line; drop unused trailing lines after EPD.
  return fields
    .concat(extras.slice(0, extras.findLastIndex(Boolean) + 1))
    .join("\n");
};
