# QR-Invoice

Convert a Swiss QR-bill from combined address type `K` to structured `S`. Runs in the browser. IBAN, amount, currency, and reference are never rewritten. House numbers like `8 B` stay `8 B`.

```bash
npm install
npm run web
npm test
```

Open http://127.0.0.1:43187. Drop one or more files — further drops **append**. Click a row to review it, Remove to drop it from the list. Try `fixtures/spc/affolter-27338.txt`, `fixtures/pdf/affolter-27338.pdf`, or **Load example that needs review**.

Optional CLI:

```bash
npm run cli -- fixtures/spc/affolter-27338.txt --output /tmp/qr-invoice-out.txt
```

`--accept-review` writes despite low-confidence addresses. `--strict` treats warnings as fatal.

PDF restamp overlays a new QR. Printed slip text may still show type `K`; banks read the QR. Scan-only pages without an image XObject are unsupported. Needs Node 20.19+.
