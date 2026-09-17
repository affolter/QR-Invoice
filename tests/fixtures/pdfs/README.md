# PDF fixtures

This folder is for **local** invoice PDFs only.

`real/` is gitignored. Copy sample invoices there yourself:

```text
tests/fixtures/pdfs/real/legacy-combined-address.pdf
```

Do not commit invoices. They contain customer and payment data.

The unit suite uses synthetic SPC strings in `src/parser/qr-payload-fixtures.ts` instead.
