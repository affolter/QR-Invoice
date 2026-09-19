# QR-Invoice

Local CLI: Swiss QR-bill in, structured Swiss QR-bill out.

- `.txt` / `.spc` — Swiss Payments Code text
- `.pdf` — reads the QR image from the invoice and restamps a new QR on the same page

Vanilla JavaScript with JsDoc types. Node runs `src/` directly.

```bash
npm install
node src/cli.js old-payload.txt --output new-payload.txt
node src/cli.js "samples/Frey Peter 2026 Rechnung Nicolle.pdf" --output Frey-Peter-2026-Invoice-new.pdf
npm test
```

`--accept-review` writes despite low-confidence addresses. `--strict` treats warnings as fatal. IBAN, amount, currency, and reference are never rewritten.

PDF support needs Node 20+ (`pdfjs-dist`). A PDF that has no embedded QR image (scan-only page without an image XObject) cannot be decoded yet.
