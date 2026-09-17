import type { InvoiceData } from "../models/invoice.js";
import { SwissQrBillGenerator, writePdf } from "./qrBillGenerator.js";

export async function generateInvoicePdf(invoice: InvoiceData, outputPath: string): Promise<void> {
  const generator = new SwissQrBillGenerator();
  const bytes = await generator.generate(invoice);
  await writePdf(outputPath, bytes);
}
