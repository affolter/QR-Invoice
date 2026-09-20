# Decisions

## ADR-001 — Browser-first

**Context:** The tool must migrate real Affolter invoices (SPC or PDF with an embedded QR) without sending patient-adjacent files to a server.

**Decision:** Parse, normalize, validate, and restamp run in the tab. Node is optional (static files + JSON validate).

**Consequences:** PDF libraries load only in the browser/CLI adapter. A future webpage that only needs SPC imports `@qr-invoice/core`.

## ADR-002 — No PDF upload

**Context:** PDF decode needs pixels of an image XObject. Putting that on a server would create storage, logging, and egress risk.

**Decision:** `POST /api/validate` accepts JSON `InvoiceData` only (32 KiB). `%PDF` bodies get 415. Capabilities advertise `pdf: false`.

**Consequences:** Scan-only pages without an image XObject stay out of scope. Restamp stays in `@qr-invoice/pdf`.

## ADR-003 — Shared core in vanilla JS + JsDoc, not a TypeScript rewrite

**Context:** The mission mentions “strict TypeScript”. The domain already runs as vanilla modules with `checkJs` / `strict`. A `.ts` rewrite would be a large behaviour risk (Either, `K→S`, `8 B`) for no user-visible gain. Classes/React would fight Kolibri’s small functions.

**Decision:** Keep `packages/core` as JS + JsDoc generics/unions. `tsc -p jsconfig.json --noEmit` is the type gate. One `InvoiceData` type is shared by browser, CLI, and `POST /api/validate`.

**Consequences:** No compile step for runtime. No Redux, no domain classes.

## ADR-004 — Dependency minimum

**Context:** Kolibri prefers zero runtime deps. PDF restamp cannot be zero-dep without inventing a PDF parser.

**Decision:** Core has **zero** runtime npm dependencies. Adapter deps are listed in `docs/architecture.md` (purpose / why not owned). No `swissqrbill`, no OCR kit, no database.

## ADR-005 — Combined address `K` → structured `S`

**Context:** IG 2.3 removed combined address type `K`. Existing QR images still encode `K` lines such as `Seestrasse 8 B`.

**Decision:** Parse keeps `K`. Normalize splits street/building/zip/city and emits `S`. Do not squash `8 B` to `8B` or `8`. Ranges `12-14` / `12/14` and French `4bis` / `4 bis` stay as printed.

**Consequences:** Ambiguous lines (`Route 12 Dorf 8`) need review. Printed slip text on a restamped PDF may still show `K`; banks read the QR.

## ADR-006 — No AI in the product path

**Context:** Address inference is deterministic regex + confidence, not a model.

**Decision:** No LLM, no remote AI API, no generated “repair” of IBAN/amount/reference. Low confidence is review, not autocomplete.

**Consequences:** The optional JSON API only re-runs `validateInvoice`.

## ADR-007 — Address review is a projector, not a second convert

**Context:** Accepting inferred addresses used to re-run `convert(originalBytes, { acceptReview: true })`, which dropped any street edits in the form.

**Decision:** `applyAddressReview(invoice, patches)` copies only `creditor.*` / `debtor.*` address keys. IBAN, amount, currency, reference, and `creditor.account` stay on the source invoice. The webpage binds those address keys to Observables and emits with `writeInvoice`.

**Consequences:** Ambiguous examples (`fixtures/spc/review-needed.txt`) can be corrected in the tab. A patched IBAN in the form is ignored.
