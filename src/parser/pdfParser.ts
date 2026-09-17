import { QrPayloadParseError } from "./qrParser.js";

const MIN_FIELDS = 31;

/**
 * Pull an SPC payload out of a UTF-8/Latin-1 file.
 * Does not decode QR images — that needs a decoder library we are not using.
 */
export function extractSwissQrPayload(raw: string): string {
  const normalized = raw.replace(/^\uFEFF/, "");
  const start = normalized.search(/SPC\r?\n/);
  if (start < 0) {
    throw new QrPayloadParseError(
      "No Swiss QR payload (SPC … EPD) found. Pass a .txt/.spc payload file. Image-only PDFs need a QR decoder, which this build does not include.",
    );
  }

  const slice = normalized.slice(start).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = slice.split("\n");
  if (lines.length < MIN_FIELDS) {
    throw new QrPayloadParseError(
      `QR payload has ${lines.length} fields; Swiss QR-bill requires at least ${MIN_FIELDS}`,
    );
  }
  if (lines[30] !== "EPD") {
    throw new QrPayloadParseError(`Trailer must be EPD, got ${JSON.stringify(lines[30])}`);
  }

  let end = MIN_FIELDS;
  if (lines[31]) {
    end = 32;
  }
  if (lines[32]) {
    end = 33;
  }
  if (lines[33]) {
    end = 34;
  }
  return lines.slice(0, end).join("\n");
}

export function extractSwissQrPayloadFromBytes(bytes: Uint8Array): string {
  const latin1 = Buffer.from(bytes).toString("latin1");
  const utf8 = Buffer.from(bytes).toString("utf8");
  const candidates = utf8.includes("SPC") ? utf8 : latin1;
  return extractSwissQrPayload(candidates);
}
