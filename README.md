# QR-Invoice

Local TypeScript CLI that reads a Swiss QR-bill **SPC payload** (plain text), normalizes legacy addresses, validates against SIX IG QR-bill 2.3 (payload version `0200`), and writes a new SPC file.

No UI, OCR, PDF libraries, or network upload. The only npm packages are TypeScript and Node types for compile/test.

## Install

```bash
npm install
npm run build
```

Node.js 18.18 or newer.

## Convert

```bash
node dist/cli/invoice-converter.js old-payload.txt --output new-payload.txt
```

`old-payload.txt` is the Swiss Payments Code string (`SPC` … `EPD`), not a PDF. A file that merely *contains* that text also works.

Options:

- `--accept-review` — write even if address fields have low confidence
- `--strict` — treat validation warnings as fatal

IBAN, amount, currency, and reference are never rewritten by heuristics. Write vs skip is one function, `canWrite`, used by the CLI and the pipeline.

## Tests

```bash
npm test
```

Fixtures are synthetic SPC strings in `src/parser/qr-payload-fixtures.ts`.

## Adding real samples

Copy payload dumps into `tests/fixtures/pdfs/real/` on your machine (gitignored).

## Layout

```
src/parser/       parseQrPayload, takeSpcFields / extractSwissQrPayload
src/normalizer/   address, IBAN (spaces only), invoice
src/validation/   errors vs warnings (one mod97)
src/generator/    buildQrPayload
src/pipeline.ts   convert, canWrite
src/cli/          invoice-converter
```
