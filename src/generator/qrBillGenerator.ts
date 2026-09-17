import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { Writable } from "node:stream";
import PDFDocument from "pdfkit";
import { SwissQRBill } from "swissqrbill/pdf";
import type { Data } from "swissqrbill/types";
import type { InvoiceData } from "../models/invoice.js";

export interface QrBillGenerator {
  generate(data: InvoiceData): Promise<Uint8Array>;
}

function toSwissQrData(invoice: InvoiceData): Data {
  const data: Data = {
    currency: invoice.currency === "EUR" ? "EUR" : "CHF",
    creditor: {
      name: invoice.creditor.name,
      address: invoice.creditor.street ?? "",
      buildingNumber: invoice.creditor.buildingNumber,
      zip: invoice.creditor.postalCode ?? "",
      city: invoice.creditor.city ?? "",
      country: invoice.creditor.country,
      account: invoice.account,
    },
  };
  if (invoice.amount !== undefined) {
    data.amount = invoice.amount;
  }
  if (invoice.reference) {
    data.reference = invoice.reference;
  }
  if (invoice.message) {
    data.message = invoice.message;
  }
  if (invoice.additionalInformation) {
    data.additionalInformation = invoice.additionalInformation;
  }
  if (invoice.av1) {
    data.av1 = invoice.av1;
  }
  if (invoice.av2) {
    data.av2 = invoice.av2;
  }
  if (invoice.debtor) {
    data.debtor = {
      name: invoice.debtor.name,
      address: invoice.debtor.street ?? "",
      buildingNumber: invoice.debtor.buildingNumber,
      zip: invoice.debtor.postalCode ?? "",
      city: invoice.debtor.city ?? "",
      country: invoice.debtor.country,
    };
  }
  return data;
}

function collectPdf(doc: PDFKit.PDFDocument): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    const sink = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      },
    });
    sink.on("finish", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    sink.on("error", reject);
    doc.on("error", reject);
    doc.pipe(sink);
    doc.end();
  });
}

/**
 * Adapter around swissqrbill 4.x (`SwissQRBill` from `swissqrbill/pdf`).
 * The rest of the pipeline never imports that library directly.
 */
export class SwissQrBillGenerator implements QrBillGenerator {
  async generate(invoice: InvoiceData): Promise<Uint8Array> {
    const data = toSwissQrData(invoice);
    const pdf = new PDFDocument({ size: "A4", margin: 36 });
    pdf.fontSize(14).text("Converted Swiss QR-bill", { underline: false });
    pdf.moveDown(0.5);
    pdf.fontSize(10).text("Generated locally from a parsed QR payload. Original page layout is not preserved in this milestone.");
    pdf.moveDown(0.75);
    pdf.text(`Creditor: ${invoice.creditor.name}`);
    pdf.text(`IBAN: ${invoice.account}`);
    if (invoice.amount !== undefined) {
      pdf.text(`Amount: ${invoice.currency} ${invoice.amount.toFixed(2)}`);
    } else {
      pdf.text(`Amount: ${invoice.currency} (open)`);
    }
    if (invoice.reference) {
      pdf.text(`Reference: ${invoice.reference}`);
    }
    if (invoice.debtor) {
      pdf.text(`Debtor: ${invoice.debtor.name}`);
    }

    const qrBill = new SwissQRBill(data, { language: "EN" });
    qrBill.attachTo(pdf);
    return collectPdf(pdf);
  }
}

export async function writePdf(path: string, bytes: Uint8Array): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await new Promise<void>((resolve, reject) => {
    const stream = createWriteStream(path);
    stream.on("finish", () => resolve());
    stream.on("error", reject);
    stream.end(Buffer.from(bytes));
  });
}
