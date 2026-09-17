#!/usr/bin/env node
import { resolve } from "node:path";
import { convertInvoicePdf } from "../pipeline.js";

function printHelp(): void {
  console.log(`invoice-converter — convert a Swiss QR invoice PDF locally

Usage:
  invoice-converter <old-invoice.pdf> --output <new-invoice.pdf>
  invoice-converter <old-invoice.pdf> -o <new-invoice.pdf>

Options:
  --output, -o      Destination PDF path
  --accept-review   Generate even when address fields need review
  --strict          Treat validation warnings as fatal
  --help, -h        Show this help

Processing stays on this machine. No invoice data is uploaded.
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

function printIssues(result: Awaited<ReturnType<typeof convertInvoicePdf>>): void {
  if (result.validation.issues.length > 0) {
    console.error("Validation:");
    for (const issue of result.validation.issues) {
      console.error(`  [${issue.severity}] ${issue.field}: ${issue.message}`);
    }
  }
  if (result.review.length > 0) {
    console.error("Needs review (low-confidence address fields; not guessed silently):");
    for (const field of result.review) {
      console.error(`  ${field.path} = ${JSON.stringify(field.value)} (confidence ${field.confidence}, source ${field.source})`);
    }
  }
}

const options = parseArgs(process.argv);

try {
  const result = await convertInvoicePdf(options.input, {
    outputPath: options.output,
    acceptReview: options.acceptReview,
    strict: options.strict,
  });
  printIssues(result);

  if (!result.validation.valid) {
    console.error("Generation blocked by validation errors. IBAN, amount, currency and reference were not modified.");
    process.exit(1);
  }
  if (result.review.length > 0 && !options.acceptReview) {
    console.error("Generation blocked until ambiguous address fields are reviewed. Re-run with --accept-review only if you accept the inferred values.");
    process.exit(1);
  }
  if (options.strict && result.validation.issues.some((issue) => issue.severity === "warning")) {
    console.error("Generation blocked by --strict (warnings present).");
    process.exit(1);
  }
  if (!result.outputPath) {
    console.error("No PDF was written.");
    process.exit(1);
  }
  console.log(`Wrote ${result.outputPath}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
