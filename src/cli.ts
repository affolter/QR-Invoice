#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { left, right, type Either } from "./either.js";
import { canWrite, convertInvoiceFile, type ConvertOptions } from "./pipeline.js";

export type CliArgs = ConvertOptions & { input: string };

function helpText(): string {
  return `invoice-converter <old-payload.txt> --output <new-payload.txt>

  --accept-review   write even if address fields need review
  --strict          treat warnings as fatal
`;
}

export function parseArgs(argv: string[]): Either<string, CliArgs | "help"> {
  const args = argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) return right("help");
  if (args.length === 0) return left(helpText().trimEnd());
  let input: string | undefined;
  let output: string | undefined;
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

export async function runCli(argv: string[]): Promise<number> {
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
  for (const issue of result.validation.issues) console.error(`  [${issue.severity}] ${issue.field}: ${issue.message}`);
  for (const item of result.review) {
    console.error(`  ${item.path} = ${JSON.stringify(item.value)} (confidence ${item.confidence}, source ${item.source})`);
  }
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
