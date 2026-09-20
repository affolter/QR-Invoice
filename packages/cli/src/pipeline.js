/** @import { Converted, ConvertInputOptions, EitherType } from "@qr-invoice/core" */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { canWrite, convert as convertText, left, right } from "@qr-invoice/core";
import { convert as convertPdf, isPdf } from "@qr-invoice/pdf";

export { canWrite, convertText as convert };

/**
 * @typedef { Converted & { outputPath?: string } } ConversionResult
 * @typedef { ConvertInputOptions & { outputPath: string } } ConvertOptions
 */

/**
 * @param   { string }         rawQr
 * @param   { ConvertOptions } options
 * @returns { Promise<EitherType<string, ConversionResult>> }
 */
export async function convertQrPayload(rawQr, options) {
  const wantPdf = options.outputPath.toLowerCase().endsWith(".pdf");
  const converted = wantPdf
    ? await convertPdf(rawQr, { ...options, output: "pdf" })
    : await convertText(rawQr, { ...options, output: "spc" });
  return finish(converted, options.outputPath);
}

/**
 * @param   { string }         inputPath
 * @param   { ConvertOptions } options
 * @returns { Promise<EitherType<string, ConversionResult>> }
 */
export async function convertInvoiceFile(inputPath, options) {
  let bytes;
  try {
    bytes = Uint8Array.from(await readFile(inputPath));
  } catch (error) {
    return left(error instanceof Error ? error.message : String(error));
  }
  const wantPdf = options.outputPath.toLowerCase().endsWith(".pdf");
  const converted =
    isPdf(bytes) || wantPdf
      ? await convertPdf(bytes, { ...options, output: wantPdf ? "pdf" : "spc" })
      : await convertText(bytes, { ...options, output: "spc" });
  return finish(converted, options.outputPath);
}

/**
 * @param { EitherType<string, Converted> } converted
 * @param { string } outputPath
 * @returns { Promise<EitherType<string, ConversionResult>> }
 */
async function finish(converted, outputPath) {
  if (!converted.ok) return converted;
  const result = /** @type { ConversionResult } */ ({ ...converted.value });
  if (!result.bytes) return right(result);
  try {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, result.bytes);
  } catch (error) {
    return left(error instanceof Error ? error.message : String(error));
  }
  result.outputPath = outputPath;
  return right(result);
}
