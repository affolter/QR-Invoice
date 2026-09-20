# Swiss QR Invoice Migration Tool

Browser-first: structured address type `S` out. IBAN, amount, currency, and reference are never rewritten. Combined `K` becomes `S`; house numbers like `8 B` stay `8 B`.

Conversion runs **in the tab**. The optional Node process only serves static files. It never reads invoices or loads PDF libraries.

Stay on **0.1.x**. Scan-only PDFs without an image XObject are unsupported. Restamp overlays a new QR; printed slip text may still show type `K`.

## Open the page (dev)

```bash
npm install
npm run web
```

http://127.0.0.1:43187 — drop `fixtures/spc/affolter-27338.txt` or `fixtures/pdf/affolter-27338.pdf`.

## Optional static server (no conversion)

```bash
npm run build
npm run server
```

http://127.0.0.1:43188 — GET files from `dist/` only.

**Node 20.19+** is required to restamp PDFs in the CLI (`pdfjs-dist`). `@qr-invoice/core` has zero runtime npm dependencies.

## Optional CLI

```bash
npm run cli -- fixtures/spc/affolter-27338.txt --output /tmp/qr-invoice-out.txt
npm test
```

## Packages

| package | role |
|---|---|
| `@qr-invoice/core` | parse → normalize → validate → build, `canWrite`, text `convert` |
| `@qr-invoice/pdf` | browser/CLI adapter: `jsqr`, `pdf-lib`, `pdfjs-dist`, `qrcode` |
| `@qr-invoice/cli` | optional file I/O |
| `@qr-invoice/server` | optional static HTTP; no PDF, no convert |

## §74 definition of done

| | criterion | status |
|---|---|---|
| 1 | Vanilla JS + JsDoc, Node runs sources, `checkJs` | done |
| 2 | Tagged Either in production; `unwrap` tests-only | done |
| 3 | Core: parse / normalize / validate / build / `canWrite` | done |
| 4 | Core has zero runtime npm deps and no `node:` / PDF imports | done |
| 5 | K→S; `8 B` stays `8 B`; IBAN/amount/currency/reference never rewritten | done |
| 6 | Review blocks write until accept; `--strict` treats warnings as fatal | done |
| 7 | Webpage drop → review → download SPC or restamped PDF **in the browser** | done |
| 8 | UI is a projector of `Converted`; no domain rules in the DOM layer | done |
| 9 | PDF adapter isolated; overlay restamp; no OCR; no Swiss-QR layout library | done |
| 10 | No conversion HTTP API; optional server is static files only | done |
| 11 | Optional CLI around the same in-memory convert | done |
| 12 | Git-tracked fixtures (not live `samples/`); Affolter `8 B` tests | done |
| 13 | Stay 0.1.x; do not claim Kolibri-zero-dep while PDF packages remain | done |

Remaining (explicitly out of this slice, not blockers): full SIX payment-part redraw, scan-only raster PDFs, public 1.0.
