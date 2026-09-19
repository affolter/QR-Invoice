# QR-Invoice

Local CLI: Swiss Payments Code (SPC) text in, normalized SPC text out. It does not read PDFs or raster QR images.

Vanilla JavaScript with JsDoc types (Kolibri-style). No compile step — Node runs `src/` directly. `tsc --noEmit` only checks those JsDoc types.

```bash
npm install
node src/cli.js old-payload.txt --output new-payload.txt
npm test
```

`--accept-review` writes despite low-confidence addresses. `--strict` treats warnings as fatal. IBAN, amount, currency, and reference are never rewritten.
