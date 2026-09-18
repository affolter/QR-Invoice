export type FieldSource = "qr" | "inferred" | "manual";

export type ParsedField<T> = {
  value: T | null;
  confidence: number;
  source: FieldSource;
};

export const CONFIDENCE_REVIEW_THRESHOLD = 0.8;

export function parsedField<T>(value: T | null, confidence: number, source: FieldSource): ParsedField<T> {
  return { value, confidence, source };
}

export function certain<T>(value: T, source: FieldSource = "qr"): ParsedField<T> {
  return parsedField(value, 1, source);
}

export function missing<T>(source: FieldSource = "qr"): ParsedField<T> {
  return parsedField<T>(null, 0, source);
}

export function fromLine<T extends string = string>(lines: string[], index: number): ParsedField<T> {
  const value = lines[index] ?? "";
  return value ? certain(value as T, "qr") : missing<T>("qr");
}

export function copyIfPresent(target: object, key: string, field: ParsedField<unknown>): void {
  if (field.value !== null && field.value !== undefined && field.value !== "") {
    (target as Record<string, unknown>)[key] = field.value;
  }
}

export function needsReview(field: ParsedField<unknown>, threshold = CONFIDENCE_REVIEW_THRESHOLD): boolean {
  if (field.value === null || field.value === undefined || field.value === "") {
    return false;
  }
  return field.confidence < threshold;
}
