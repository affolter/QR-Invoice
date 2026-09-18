#!/usr/bin/env node
import { resolve } from "node:path";
import { canWrite, convertInvoiceFile } from "../pipeline.js";

function printHelp(): void {
  console.log(`invoice-converter — convert a Swiss QR payload locally (no network)

Usage:
  invoice-converter <old-payload.txt> --output <new-payload.txt>
  invoice-converter <old-payload.txt> -o <new-payload.txt>

Input is a Swiss QR-bill SPC text file (or any file that contains that text).
Output is a normalized SPC payload, not a PDF.

Options:
  --output, -o      Destination path
  --accept-review   Write even when address fields need review
  --strict          Treat validation warnings as fatal
  --help, -h        Show this help
`);
}

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(args.length === 0 ? 1 : 0);
  }

  let input: string | undefined;
  let output: string | undefined;
  let acceptReview = false;
  let strict = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--output" || arg === "-o") {
      output = args[i + 1];
      i += 1;
    } else if (arg === "--accept-review") {
      acceptReview = true;
    } else if (arg === "--strict") {
      strict = true;
    } else if (arg && !arg.startsWith("-")) {
      input = arg;
    } else {
      console.error(`Unknown option: ${arg}`);
      process.exit(2);
    }
  }

  if (!input || !output) {
    printHelp();
    process.exit(2);
  }

  return { input: resolve(input), output: resolve(output), acceptReview, strict };
}

const options = parseArgs(process.argv);

try {
  const result = await convertInvoiceFile(options.input, {
    outputPath: options.output,
    acceptReview: options.acceptReview,
    strict: options.strict,
  });

  for (const issue of result.validation.issues) {
    console.error(`  [${issue.severity}] ${issue.field}: ${issue.message}`);
  }
  for (const field of result.review) {
    console.error(`  ${field.path} = ${JSON.stringify(field.value)} (confidence ${field.confidence}, source ${field.source})`);
  }

  const gate = canWrite(result, options);
  if (!gate.ok) {
    console.error(gate.error);
    process.exit(1);
  }
  console.log(`Wrote ${result.outputPath}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
