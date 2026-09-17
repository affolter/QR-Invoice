export type FieldSource = "qr" | "pdf" | "ocr" | "inferred" | "manual";

export interface ParsedField<T> {
  value: T | null;
  confidence: number;
  source: FieldSource;
}

export const CONFIDENCE_REVIEW_THRESHOLD = 0.8;

export function parsedField<T>(
  value: T | null,
  confidence: number,
  source: FieldSource,
): ParsedField<T> {
  return { value, confidence, source };
}

export function certain<T>(value: T, source: FieldSource = "qr"): ParsedField<T> {
  return parsedField(value, 1, source);
}

export function missing<T>(source: FieldSource = "qr"): ParsedField<T> {
  return parsedField<T>(null, 0, source);
}

export function needsReview(field: ParsedField<unknown>, threshold = CONFIDENCE_REVIEW_THRESHOLD): boolean {
  if (field.value === null || field.value === undefined || field.value === "") {
    return false;
  }
  return field.confidence < threshold;
}
