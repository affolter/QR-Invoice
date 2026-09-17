import type { InvoiceData } from "../models/invoice.js";

export interface QrBillGenerator {
  generate(data: InvoiceData): string;
}

function line(value: string | undefined): string {
  return value ?? "";
}

function amountField(amount: number | undefined): string {
  if (amount === undefined) {
    return "";
  }
  return amount.toFixed(2);
}

function addressFields(party: {
  name: string;
  street?: string;
  buildingNumber?: string;
  postalCode?: string;
  city?: string;
  country: string;
}): string[] {
  return [
    "S",
    party.name,
    line(party.street),
    line(party.buildingNumber),
    line(party.postalCode),
    line(party.city),
    party.country,
  ];
}

/** Builds a Swiss QR-bill SPC payload (IG master version 02). No third-party library. */
export function buildQrPayload(invoice: InvoiceData): string {
  const debtor = invoice.debtor
    ? addressFields(invoice.debtor)
    : ["", "", "", "", "", "", ""];

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
    amountField(invoice.amount),
    invoice.currency,
    ...debtor,
    invoice.referenceType,
    line(invoice.reference),
    line(invoice.message),
    "EPD",
  ];

  if (invoice.additionalInformation || invoice.av1 || invoice.av2) {
    fields.push(line(invoice.additionalInformation));
  }
  if (invoice.av1 || invoice.av2) {
    fields.push(line(invoice.av1));
  }
  if (invoice.av2) {
    fields.push(invoice.av2);
  }

  return fields.join("\n");
}

export class PayloadQrBillGenerator implements QrBillGenerator {
  generate(invoice: InvoiceData): string {
    return buildQrPayload(invoice);
  }
}
