import type { ParsedField } from "../models/parsed-field.js";
import { parsedField } from "../models/parsed-field.js";

const IBAN_PATTERN = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;

/**
 * IBAN is financial data. This only removes spaces and uppercases letters.
 * It never invents or repairs check digits.
 */
export function normalizeIban(raw: string | null | undefined, source: ParsedField<string>["source"] = "qr"): ParsedField<string> {
  if (raw === null || raw === undefined) {
    return parsedField<string>(null, 0, source);
  }
  const compact = raw.replace(/\s+/g, "").toUpperCase();
  if (!compact) {
    return parsedField<string>(null, 0, source);
  }
  if (!IBAN_PATTERN.test(compact)) {
    return parsedField<string>(raw, 0.2, source);
  }
  return parsedField(compact, 1, source);
}
