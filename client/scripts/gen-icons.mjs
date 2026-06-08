// Generate simple, valid PNG app icons with zero dependencies (Node core `zlib` only).
// Produces solid warm-orange squares with a soft cream heart in the middle.
// Run: npm run gen-icons

import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../public/icons');

const BG = [249, 115, 22]; // #f97316 warm orange
const FG = [255, 247, 237]; // #fff7ed cream

// CRC32 (PNG chunk checksum).
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// Is (x, y) inside a simple heart shape centered in a `size` square?
function inHeart(x, y, size) {
  const nx = (x / size) * 2 - 1; // -1..1
  const ny = (y / size) * 2 - 1;
  const px = nx * 1.2;
  const py = -ny * 1.2 + 0.35;
  const v = px * px + py * py - 1;
  return v * v * v - px * px * py * py * py < 0;
}

function makePng(size) {
  const bytesPerPixel = 3; // RGB
  const stride = size * bytesPerPixel + 1; // +1 filter byte per row
  const raw = Buffer.alloc(stride * size);

  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter type 0 (None)
    for (let x = 0; x < size; x++) {
      const [r, g, b] = inHeart(x, y, size) ? FG : BG;
      const off = y * stride + 1 + x * bytesPerPixel;
      raw[off] = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type 2 = truecolor RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const size of [192, 512]) {
  const file = path.join(OUT_DIR, `icon-${size}.png`);
  fs.writeFileSync(file, makePng(size));
  console.log(`wrote ${file}`);
}
