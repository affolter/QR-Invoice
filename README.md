# Swiss QR Invoice Migration Tool

Browser-first: structured address type `S` out. IBAN, amount, currency, and reference are never rewritten. Combined `K` becomes `S`; `8 B`, `12-14`, `12/14`, `4bis`, and `4 bis` stay as printed.

Conversion runs **in the tab**. Optional Node serves static files and a tiny JSON API (`InvoiceData` only). It never accepts PDF.

Stay on **0.1.x**. Docs: [architecture](docs/architecture.md), [domain](docs/domain.md), [decisions](docs/decisions.md).

## Open the page

```bash
npm install
npm run web
```

http://127.0.0.1:43187 — drop `fixtures/spc/affolter-27338.txt` or `fixtures/pdf/affolter-27338.pdf`.

## JSON API (optional)

```bash
npm run build
npm run server
```

http://127.0.0.1:43188

- `GET /api/health`
- `GET /api/capabilities`
- `POST /api/validate` — JSON `InvoiceData`, 32 KiB max, no PDF/images/storage

The page still converts if this process is down. With both running, `npm run web` proxies `/api` to `:43188`.

## Optional CLI

```bash
npm run cli -- fixtures/spc/affolter-27338.txt --output /tmp/qr-invoice-out.txt
npm test
```
