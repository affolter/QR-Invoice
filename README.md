# QR-Invoice

Local TypeScript CLI/library that reads a Swiss QR-bill PDF, parses the QR payload, normalizes legacy addresses, validates against SIX Implementation Guidelines (IG QR-bill 2.3, payload master version 02 / `0200`), and writes a new payment-part PDF.

No UI, OCR, or network upload.

## Install

```bash
npm install
```

Requires Node.js 18.18 or newer.

## Convert a PDF

```bash
npx tsx src/cli/invoice-converter.ts old-invoice.pdf --output new-invoice.pdf
```

After `npm run build`:

```bash
node dist/cli/invoice-converter.js old-invoice.pdf --output new-invoice.pdf
```

Options:

- `--accept-review` — write the PDF even if address fields have low confidence
- `--strict` — treat validation warnings as fatal

Ambiguous addresses block generation unless you pass `--accept-review`. IBAN, amount, currency, and reference are never rewritten by heuristics.

## Tests

```bash
npm test
```

Synthetic QR payloads and Swiss street fixtures live next to the modules. There are no real customer invoices in this repository.

## Adding real PDF fixtures

1. Put files only on your machine under `tests/fixtures/pdfs/real/` (gitignored).
2. Run the CLI against one of them.
3. If extraction fails, the QR may be drawn as vectors rather than an embedded image. Note the file name and the error; do not commit live invoice data.

## Layout

```
src/parser/      qrParser, pdf QR extraction (OCR stub only)
src/normalizer/  address, IBAN (spaces only), invoice
src/validation/  errors vs warnings
src/generator/   QrBillGenerator adapter over swissqrbill 4.4
src/cli/         invoice-converter
```

Generation uses [swissqrbill](https://github.com/space-invoices/SwissQRBill) 4.x (`SwissQRBill` from `swissqrbill/pdf`). That library is wrapped by `QrBillGenerator`; the rest of the code depends only on `InvoiceData`.
