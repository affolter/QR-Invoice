# Architecture

Swiss QR Invoice Migration Tool. Convert a legacy combined-address QR-bill (type `K`) to structured type `S` **in the browser**. An optional Node process serves the UI and a tiny JSON API. It never converts PDFs and never stores invoices.

```
browser
  drop SPC | PDF
       │
       ├─ @qr-invoice/pdf   (optional adapter, in-tab)
       └─ @qr-invoice/core  parse → normalize → validate → canWrite → build
              │
              └── download via createOutputFilename

optional Node  :43188
  GET  /              static dist/
  GET  /api/health
  GET  /api/capabilities
  POST /api/validate  JSON InvoiceData only (32 KiB)
```

If the JSON API is down, the page still converts. Vite (`npm run web`) proxies `/api` to `:43188` when that process is running.

## Packages

| package | runtime | role |
|---|---|---|
| `@qr-invoice/core` | none | domain + `createOutputFilename` |
| `@qr-invoice/pdf` | jsqr, pdf-lib, pdfjs-dist, qrcode | image XObject decode + restamp |
| `@qr-invoice/cli` | core + pdf | local files |
| `@qr-invoice/server` | core | static files + JSON validate |

## Production dependency table

Each production npm package (adapter only). Core owns none of these.

| package | purpose | why not owned |
|---|---|---|
| `pdfjs-dist` | parse PDF operators / image XObjects in the **browser or CLI** | PDF object model is large; we do not rasterize pages or OCR |
| `jsqr` | decode a Swiss QR from RGBA pixels of an image XObject | QR bit decoding is a solved library; we only keep SPC starting with `SPC` |
| `qrcode` | encode a new Swiss QR matrix for restamp | need a scannable QR; we stamp the Swiss cross ourselves |
| `pdf-lib` | overlay the new QR on the existing page | we restamp one XObject; we do not redraw the SIX slip |

Dev-only: `typescript` (`checkJs`), `@types/node`, `vite` (dev server + `vite build`). Not used at convert time in core.

## What the server will not do

- PDF or image upload
- `convert()`, OCR, `swissqrbill`, a database
- log IBAN, street, or other address fields
