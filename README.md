# QR-Invoice

Browser-first Swiss QR-bill converter: structured address type `S` out. IBAN, amount, currency, and reference are never rewritten. Combined `K` becomes `S`; house numbers like `8 B` stay `8 B`.

There is no HTTP API. The page converts in the tab. The Node CLI is an optional local tool, not the product backend.

Stay on **0.1.x**. Scan-only PDFs without an image XObject are unsupported. Restamp overlays a new QR; printed slip text may still show type `K`.

## Open the page

```bash
npm install
npm run web
```

Then open http://127.0.0.1:43187 — drop `fixtures/spc/affolter-27338.txt` or `fixtures/pdf/affolter-27338.pdf`. If an address needs review, accept the inferred values before download.

**Node 20.19+** is required to restamp PDFs (`pdfjs-dist`). `@qr-invoice/core` (parse / normalize / validate / build / `canWrite`) has **zero** runtime npm dependencies and uses no Node builtins.

`--accept-review` / the on-page accept button writes despite low-confidence addresses. `--strict` (CLI) treats warnings as fatal.

## Optional CLI

```bash
npm run cli -- fixtures/spc/affolter-27338.txt --output /tmp/qr-invoice-out.txt
npm run cli -- fixtures/pdf/affolter-27338.pdf --output /tmp/qr-invoice-out.pdf
npm test
```

## Packages

| package | role |
|---|---|
| `@qr-invoice/core` | SPC parse → normalize → validate → build, `canWrite`, text `convert` |
| `@qr-invoice/pdf` | optional adapter: `jsqr`, `pdf-lib`, `pdfjs-dist`, `qrcode` |
| `@qr-invoice/cli` | file I/O around the same in-memory convert |

```js
import { convert } from "@qr-invoice/core";
import { convert as convertPdf } from "@qr-invoice/pdf";
```
