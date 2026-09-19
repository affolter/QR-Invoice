/** @import { Converted, ConvertInputOptions } from "./backend.js" */
/** @import { EitherType } from "./either.js" */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { left, right } from "./either.js";
import { canWrite, convert } from "./backend.js";

export { canWrite, convert };

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
  const converted = await convert(rawQr, {
    acceptReview: options.acceptReview,
    strict: options.strict,
    output: options.outputPath.toLowerCase().endsWith(".pdf") ? "pdf" : "spc",
  });
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
  const converted = await convert(bytes, {
    acceptReview: options.acceptReview,
    strict: options.strict,
    output: options.outputPath.toLowerCase().endsWith(".pdf") ? "pdf" : "spc",
  });
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
