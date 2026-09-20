#!/usr/bin/env node
/** @import { Converted, ConvertInputOptions, EitherType } from "./index.js" */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { canWrite, left, right } from "./index.js";
import { convert } from "./pdf.js";

/**
 * @typedef { Converted & { outputPath?: string } } ConversionResult
 * @typedef { ConvertInputOptions & { outputPath: string } } ConvertOptions
 * @typedef { ConvertOptions & { input: string } } CliArgs
 */

/** @returns { string } @pure */
function helpText() {
  return `invoice-converter <old.txt|old.pdf> --output <new.txt|new.pdf>

  Optional local tool. The product is the in-browser page (npm run web).

  PDF in  → reads the Swiss QR image and restamps it on the same invoice page
  PDF out → writes a PDF (restamped invoice, or a new page if the input was text)
  TXT out → writes the normalized SPC payload

  --accept-review   write even if address fields need review
  --strict          treat warnings as fatal
`;
}

/**
 * @param   { string[] } argv
 * @returns { EitherType<string, CliArgs | "help"> }
 * @pure
 */
export function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) return right("help");
  if (args.length === 0) return left(helpText().trimEnd());
  let input;
  let output;
  let acceptReview = false;
  let strict = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--output" || arg === "-o") {
      output = args[++i];
      if (!output) return left("Missing value for --output");
    } else if (arg === "--accept-review") acceptReview = true;
    else if (arg === "--strict") strict = true;
    else if (arg && !arg.startsWith("-")) input = arg;
    else return left(`Unknown option: ${arg}`);
  }
  if (!input || !output) return left(helpText().trimEnd());
  return right({ input: resolve(input), outputPath: resolve(output), acceptReview, strict });
}

/**
 * @param   { string }         rawQr
 * @param   { ConvertOptions } options
 * @returns { Promise<EitherType<string, ConversionResult>> }
 */
export async function convertQrPayload(rawQr, options) {
  const wantPdf = options.outputPath.toLowerCase().endsWith(".pdf");
  return finish(await convert(rawQr, { ...options, output: wantPdf ? "pdf" : "spc" }), options.outputPath);
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
  return finish(await convert(bytes, { ...options, output: wantPdf ? "pdf" : "spc" }), options.outputPath);
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

/**
 * @param   { string[] } argv
 * @returns { Promise<number> }
 */
export async function runCli(argv) {
  const parsed = parseArgs(argv);
  if (!parsed.ok) {
    console.error(parsed.error);
    return parsed.error.startsWith("invoice-converter") ? 2 : 1;
  }
  if (parsed.value === "help") {
    console.log(helpText());
    return 0;
  }
  const converted = await convertInvoiceFile(parsed.value.input, parsed.value);
  if (!converted.ok) {
    console.error(converted.error);
    return 1;
  }
  const result = converted.value;
  for (const issue of result.validation.issues) console.error(`  [${issue.severity}] ${issue.code}`);
  for (const item of result.review) console.error(`  review: ${item.path}`);
  const gate = canWrite(result, parsed.value);
  if (!gate.ok) {
    console.error(gate.error);
    return 1;
  }
  console.log(`Wrote ${result.outputPath}`);
  return 0;
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(resolve(entry)).href) {
  process.exit(await runCli(process.argv));
}
