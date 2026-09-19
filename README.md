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

A future webpage should call the in-memory backend — no HTTP server in this package:

```js
import { convert } from "qr-invoice";

const input = new Uint8Array(await file.arrayBuffer());
const out = await convert(input, { acceptReview: true, output: "auto" });
if (!out.ok) throw new Error(out.error);
if (!out.value.bytes) throw new Error("blocked until review / validation");
const blob = new Blob([out.value.bytes], { type: out.value.mediaType });
```

`output: "auto"` restamps a PDF when the input is a PDF, otherwise writes SPC text. Use `"pdf"` or `"spc"` to force a format.

PDF read needs Node 20+ (`pdfjs-dist`). A scan-only page without an image XObject cannot be decoded yet.
