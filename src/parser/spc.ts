import { andThen, left, right, type Either } from "../either.js";

export const SPC_MIN_FIELDS = 31;

export function splitSpcLines(raw: string): string[] {
  return raw
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n+$/, "")
    .split("\n");
}

/** Keep mandatory SPC fields plus any used optional trailer lines (billing / AV1 / AV2). */
export function takeSpcFields(lines: string[]): Either<string, string[]> {
  if (lines.length < SPC_MIN_FIELDS) {
    return left(`QR payload has ${lines.length} fields; Swiss QR-bill requires at least ${SPC_MIN_FIELDS}`);
  }
  if (lines[30] !== "EPD") {
    return left(`Trailer must be EPD, got ${JSON.stringify(lines[30])}`);
  }
  let end = SPC_MIN_FIELDS;
  while (end < lines.length && end < 34 && lines[end]) {
    end += 1;
  }
  return right(lines.slice(0, end));
}

export function extractSwissQrPayload(raw: string): Either<string, string> {
  const start = raw.replace(/^\uFEFF/, "").search(/SPC\r?\n/);
  if (start < 0) {
    return left(
      "No Swiss QR payload (SPC … EPD) found. Pass a .txt/.spc payload file. Image-only PDFs need a QR decoder, which this build does not include.",
    );
  }
  return andThen(takeSpcFields(splitSpcLines(raw.slice(start))), (lines) => right(lines.join("\n")));
}

export function extractSwissQrPayloadFromBytes(bytes: Uint8Array): Either<string, string> {
  const utf8 = Buffer.from(bytes).toString("utf8");
  const raw = utf8.includes("SPC") ? utf8 : Buffer.from(bytes).toString("latin1");
  return extractSwissQrPayload(raw);
}
