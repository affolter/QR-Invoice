# Domain

Swiss Payments Code (SPC) IG 2.3: 31+ newline fields, `SPC` … `EPD`.

## Invariants

- Never rewrite IBAN, amount, currency, or reference (IBAN: spaces/case only).
- Address type `K` (combined) becomes structured `S`.
- House numbers keep their printed form: `8 B`, `12-14`, `12/14`, `4bis`, `4 bis`.
- Ambiguous streets stay low-confidence. `canWrite` blocks until review is accepted.
- `--strict` / `strict: true` treats warnings as fatal.
- Production errors are tagged Either `{ ok: true, value } | { ok: false, error }`. `unwrap` is tests-only.

## Pipeline

1. `extractSwissQrPayload` / PDF image XObject → SPC string  
2. `parseQrPayload` — keep `K` as `K`  
3. `normalizeInvoice` — `K→S`, street split, IBAN compact  
4. `validateInvoice` — SIX checks, values unchanged on failure  
5. `canWrite` — review / strict / errors  
6. `buildQrPayload` — emit `S`  
7. `createOutputFilename` — `{stem}-structured.txt|pdf`

`InvoiceData` is the JSON the optional `POST /api/validate` accepts. The API does not parse SPC or PDF.

## Review UI

Financial fields (IBAN, amount, currency, reference) are shown locked. The page does not offer editors that could “fix” money fields.
