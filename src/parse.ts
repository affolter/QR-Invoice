import { andThen, left, right, type Either } from "./either.js";
import type { AddressType, ParsedAddress, ParsedInvoice } from "./models.js";
import { certain, field, fromLine, missing } from "./models.js";

const MIN = 31;

function splitSpcLines(raw: string): string[] {
  return raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n+$/, "").split("\n");
}

function takeSpcFields(lines: string[]): Either<string, string[]> {
  if (lines.length < MIN) return left(`QR payload has ${lines.length} fields; Swiss QR-bill requires at least ${MIN}`);
  if (lines[30] !== "EPD") return left(`Trailer must be EPD, got ${JSON.stringify(lines[30])}`);
  let end = MIN;
  while (end < lines.length && end < 34 && lines[end]) end += 1;
  return right(lines.slice(0, end));
}

export function extractSwissQrPayload(raw: string): Either<string, string> {
  const start = raw.replace(/^\uFEFF/, "").search(/SPC\r?\n/);
  if (start < 0) return left("No Swiss QR payload (SPC … EPD) found. Pass a .txt/.spc payload file.");
  return andThen(takeSpcFields(splitSpcLines(raw.slice(start))), (lines) => right(lines.join("\n")));
}

function parseAddress(lines: string[], start: number): ParsedAddress {
  return {
    addressType: fromLine<AddressType>(lines, start),
    name: fromLine(lines, start + 1),
    street: fromLine(lines, start + 2),
    buildingNumber: fromLine(lines, start + 3),
    postalCode: fromLine(lines, start + 4),
    city: fromLine(lines, start + 5),
    country: fromLine(lines, start + 6),
  };
}

export function parseQrPayload(raw: string): Either<string, ParsedInvoice> {
  if (!raw?.trim()) return left("QR payload is empty");
  return andThen(takeSpcFields(splitSpcLines(raw)), (lines) => {
    if (lines[0] !== "SPC") return left(`QR type must be SPC, got ${JSON.stringify(lines[0])}`);
    if (lines[2] !== "1") return left(`Coding type must be 1, got ${JSON.stringify(lines[2])}`);
    const creditor = parseAddress(lines, 4);
    const debtor = parseAddress(lines, 20);
    const amountRaw = lines[18] ?? "";
    return right({
      qrType: fromLine(lines, 0),
      qrVersion: fromLine(lines, 1),
      coding: fromLine(lines, 2),
      account: fromLine(lines, 3),
      amount: !amountRaw
        ? missing<number>()
        : /^\d{1,9}(\.\d{2})?$/.test(amountRaw)
          ? certain(Number(amountRaw))
          : field<number>(null, 0, "qr"),
      currency: fromLine(lines, 19),
      referenceType: fromLine(lines, 27),
      reference: fromLine(lines, 28),
      message: fromLine(lines, 29),
      additionalInformation: fromLine(lines, 31),
      av1: fromLine(lines, 32),
      av2: fromLine(lines, 33),
      trailer: fromLine(lines, 30),
      creditor,
      debtor: Object.values(debtor).some((item) => item.value) ? debtor : null,
    });
  });
}
