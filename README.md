# QR-Invoice

Convert a Swiss QR-bill from combined address type `K` to structured `S`. Runs in the browser. IBAN, amount, currency, and reference are never rewritten. House numbers like `8 B` stay `8 B`.

```
web/       the page — drop files here
src/       convert the QR payload (parse → normalize → validate → write)
src/pdf/   read and restamp a QR image in a PDF
cli/       same convert, from the terminal (optional)
samples/   example inputs
```

```bash
npm install
npm run web
npm test
```

Open http://127.0.0.1:43187 and drop `samples/combined-k.txt` or `samples/combined-k.pdf`.

Optional CLI:

```bash
npm run cli -- samples/combined-k.txt --output /tmp/qr-invoice-out.txt
```

`--accept-review` writes despite low-confidence addresses. `--strict` treats warnings as fatal.

PDF restamp overlays a new QR. Printed slip text may still show type `K`; banks read the QR. Scan-only pages without an image XObject are unsupported. Needs Node 20.19+.
