import { createWriteStream, mkdirSync } from 'fs';
import { join } from 'path';
import zlib from 'zlib';

const ICONS_DIR = new URL('../src-tauri/icons/', import.meta.url).pathname.slice(1);
mkdirSync(ICONS_DIR, { recursive: true });

const R = 129, G = 140, B = 248; // #818cf8

function crc32(buf) {
  let c = 0xFFFFFFFF;
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let v = i;
    for (let j = 0; j < 8; j++) v = (v & 1) ? (0xEDB88320 ^ (v >>> 1)) : (v >>> 1);
    table[i] = v;
  }
  for (const b of buf) c = table[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function makePNG(w, h) {
  const chunks = [];
  function chunk(type, data) {
    const t = Buffer.from(type, 'ascii');
    const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const len = Buffer.alloc(4); len.writeUInt32BE(d.length);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([t, d])));
    return Buffer.concat([len, t, d, crcBuf]);
  }
  const sig = Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(w, 0); ihdrData.writeUInt32BE(h, 4);
  ihdrData[8] = 8; ihdrData[9] = 6; // 6 = RGBA
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    const off = y * (1 + w * 4);
    raw[off] = 0;
    for (let x = 0; x < w; x++) {
      raw[off + 1 + x*4] = R; raw[off + 2 + x*4] = G;
      raw[off + 3 + x*4] = B; raw[off + 4 + x*4] = 255;
    }
  }
  const compressed = zlib.deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdrData), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

function makeICO(sizes) {
  const pngs = sizes.map(s => makePNG(s, s));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
  const dirSize = sizes.length * 16;
  let offset = 6 + dirSize;
  const dirs = sizes.map((s, i) => {
    const dir = Buffer.alloc(16);
    dir[0] = s >= 256 ? 0 : s; dir[1] = s >= 256 ? 0 : s;
    dir[4] = 1; dir[6] = 32;
    dir.writeUInt32LE(pngs[i].length, 8);
    dir.writeUInt32LE(offset, 12);
    offset += pngs[i].length;
    return dir;
  });
  return Buffer.concat([header, ...dirs, ...pngs]);
}

import { writeFileSync } from 'fs';

const specs = [
  ['32x32.png', 32], ['128x128.png', 128],
  ['128x128@2x.png', 256], ['icon.png', 512],
];
for (const [name, size] of specs) {
  writeFileSync(join(ICONS_DIR, name), makePNG(size, size));
  console.log(`Created ${name}`);
}

writeFileSync(join(ICONS_DIR, 'icon.ico'), makeICO([16, 32, 48, 256]));
console.log('Created icon.ico');

// Minimal ICNS for macOS (ic09 = 512x512 PNG)
const png512 = makePNG(512, 512);
const icnsEntry = Buffer.alloc(8);
icnsEntry.write('ic09', 0, 'ascii'); icnsEntry.writeUInt32BE(png512.length + 8, 4);
const icnsHeader = Buffer.alloc(8);
icnsHeader.write('icns', 0, 'ascii'); icnsHeader.writeUInt32BE(png512.length + 16, 4);
writeFileSync(join(ICONS_DIR, 'icon.icns'), Buffer.concat([icnsHeader, icnsEntry, png512]));
console.log('Created icon.icns');
console.log('Done!');
