import type { InvoiceData, Party } from "./models.js";

const empty = (value: string | undefined) => value ?? "";

function addressFields(party: Party): string[] {
  return ["S", party.name, empty(party.street), empty(party.buildingNumber), empty(party.postalCode), empty(party.city), party.country];
}

export function buildQrPayload(invoice: InvoiceData): string {
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
