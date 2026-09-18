import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { InvoiceData } from "../models/invoice.js";

function line(value: string | undefined): string {
  return value ?? "";
}

function addressFields(party: {
  name: string;
  street?: string;
  buildingNumber?: string;
  postalCode?: string;
  city?: string;
  country: string;
}): string[] {
  return ["S", party.name, line(party.street), line(party.buildingNumber), line(party.postalCode), line(party.city), party.country];
}

/** Builds a Swiss QR-bill SPC payload (IG master version 02). */
export function buildQrPayload(invoice: InvoiceData): string {
  const debtor = invoice.debtor ? addressFields(invoice.debtor) : ["", "", "", "", "", "", ""];
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
    ...debtor,
    invoice.referenceType,
    line(invoice.reference),
    line(invoice.message),
    "EPD",
  ];
  const extras = [invoice.additionalInformation, invoice.av1, invoice.av2];
  const lastUsed = extras.reduce((last, value, index) => (value ? index : last), -1);
  for (let i = 0; i <= lastUsed; i += 1) {
    fields.push(line(extras[i]));
  }
  return fields.join("\n");
}

export async function writePayload(invoice: InvoiceData, outputPath: string): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buildQrPayload(invoice), "utf8");
}
