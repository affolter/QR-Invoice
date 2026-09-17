import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { InvoiceData } from "../models/invoice.js";
import { PayloadQrBillGenerator } from "./qrBillGenerator.js";

export async function generateInvoicePayload(invoice: InvoiceData, outputPath: string): Promise<void> {
  const generator = new PayloadQrBillGenerator();
  const payload = generator.generate(invoice);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, payload, "utf8");
}
