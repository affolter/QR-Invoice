/**
 * Unfiltered RGBA PNG. No Node zlib, no canvas, no extra packages.
 * Uses stored (uncompressed) DEFLATE so it runs in the browser and in Node.
 *
 * @param { Uint8ClampedArray } rgba
 * @param { number } width
 * @param { number } height
 * @returns { Uint8Array }
 * @pure
 */
export const encodePng = (rgba, width, height) => {
  const raw = new Uint8Array(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const dest = y * (1 + width * 4);
    raw[dest] = 0;
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), dest + 1);
  }
  const ihdr = new Uint8Array(13);
  writeU32(ihdr, 0, width);
  writeU32(ihdr, 4, height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const chunks = [pngChunk("IHDR", ihdr), pngChunk("IDAT", zlibStore(raw)), pngChunk("IEND", new Uint8Array(0))];
  return concat([signature, ...chunks]);
};

/**
 * @param { string } type
 * @param { Uint8Array } data
 * @returns { Uint8Array }
 * @pure
 */
function pngChunk(type, data) {
  const name = new TextEncoder().encode(type);
  const len = new Uint8Array(4);
  writeU32(len, 0, data.length);
  const crc = new Uint8Array(4);
  writeU32(crc, 0, crc32(concat([name, data])));
  return concat([len, name, data, crc]);
}

/**
 * @param { Uint8Array } data
 * @returns { Uint8Array }
 * @pure
 */
function zlibStore(data) {
  const blocks = [];
  let offset = 0;
  do {
    const len = Math.min(65535, data.length - offset);
    const block = new Uint8Array(5 + len);
    block[0] = offset + len >= data.length ? 1 : 0;
    block[1] = len & 0xff;
    block[2] = (len >> 8) & 0xff;
    const nlen = 0xffff ^ len;
    block[3] = nlen & 0xff;
    block[4] = (nlen >> 8) & 0xff;
    block.set(data.subarray(offset, offset + len), 5);
    blocks.push(block);
    offset += len;
  } while (offset < data.length);
  const adler = new Uint8Array(4);
  writeU32(adler, 0, adler32(data));
  return concat([new Uint8Array([0x78, 0x01]), ...blocks, adler]);
}

/**
 * @param { Uint8Array[] } parts
 * @returns { Uint8Array }
 * @pure
 */
function concat(parts) {
  let length = 0;
  for (const part of parts) length += part.length;
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/**
 * @param { Uint8Array } bytes
 * @param { number } offset
 * @param { number } value
 */
function writeU32(bytes, offset, value) {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

/**
 * @param { Uint8Array } bytes
 * @returns { number }
 * @pure
 */
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = (CRC_TABLE[(c ^ (bytes[i] ?? 0)) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * @param { Uint8Array } data
 * @returns { number }
 * @pure
 */
function adler32(data) {
  let a = 1;
  let b = 0;
  for (let i = 0; i < data.length; i += 1) {
    a = (a + (data[i] ?? 0)) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}
