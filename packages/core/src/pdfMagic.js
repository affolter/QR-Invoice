/**
 * PDF magic bytes only. No PDF libraries.
 * @param { Uint8Array } bytes
 * @returns { boolean }
 * @pure
 */
export function isPdf(bytes) {
  return bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}
