# QR-Invoice

Local CLI: Swiss QR-bill SPC text in, normalized SPC text out.

```bash
npm install
npm run build
node dist/cli.js old-payload.txt --output new-payload.txt
npm test
```

`--accept-review` writes despite low-confidence addresses. `--strict` treats warnings as fatal. IBAN, amount, currency, and reference are never rewritten.
