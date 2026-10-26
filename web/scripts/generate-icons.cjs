const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function generateTradingBoyPng(size, isMaskable = false) {
  const rowSize = size * 4 + 1;
  const rawData = Buffer.alloc(size * rowSize);

  const radius = isMaskable ? 0 : Math.round(size * 0.22);
  const centerX = size / 2;
  const centerY = size / 2;

  // Colors
  const bgR1 = 2, bgG1 = 132, bgB1 = 199; // #0284c7
  const bgR2 = 7, bgG2 = 89, bgB2 = 133;  // #075985
  const greenR = 16, greenG = 185, greenB = 129; // #10b981
  const redR = 239, redG = 68, redB = 68;       // #ef4444
  const goldR = 245, goldG = 158, goldB = 11;   // #f59e0b
  const whiteR = 255, whiteG = 255, whiteB = 255;

  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < size; x++) {
      const pxOffset = rowOffset + 1 + x * 4;

      // Rounded corner check
      let inBounds = true;
      if (radius > 0) {
        let dx = 0, dy = 0;
        if (x < radius) dx = radius - x;
        else if (x >= size - radius) dx = x - (size - radius - 1);
        if (y < radius) dy = radius - y;
        else if (y >= size - radius) dy = y - (size - radius - 1);

        if (dx > 0 && dy > 0 && (dx * dx + dy * dy > radius * radius)) {
          inBounds = false;
        }
      }

      if (!inBounds) {
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
        continue;
      }

      // Default background gradient (Top-Left to Bottom-Right)
      const gradFrac = (x + y) / (2 * size);
      let r = Math.round(bgR1 + (bgR2 - bgR1) * gradFrac);
      let g = Math.round(bgG1 + (bgG2 - bgG1) * gradFrac);
      let b = Math.round(bgB1 + (bgB2 - bgB1) * gradFrac);
      let a = 255;

      // Coordinate scaling
      const normX = x / size;
      const normY = y / size;

      // 1. Gold POC line across center
      if (normY >= 0.505 && normY <= 0.520 && normX >= 0.18 && normX <= 0.82) {
        r = goldR; g = goldG; b = goldB;
      }

      // 2. Candlestick 1: Green (Bullish) at X = 0.33
      // Wick
      if (normX >= 0.32 && normX <= 0.34 && normY >= 0.28 && normY <= 0.74) {
        r = greenR; g = greenG; b = greenB;
      }
      // Body
      if (normX >= 0.27 && normX <= 0.39 && normY >= 0.42 && normY <= 0.68) {
        r = greenR; g = greenG; b = greenB;
      }

      // 3. Candlestick 2: Red (Bearish) at X = 0.50
      // Wick
      if (normX >= 0.49 && normX <= 0.51 && normY >= 0.20 && normY <= 0.80) {
        r = redR; g = redG; b = redB;
      }
      // Body
      if (normX >= 0.44 && normX <= 0.56 && normY >= 0.34 && normY <= 0.70) {
        r = redR; g = redG; b = redB;
      }

      // 4. Candlestick 3: Green (Bullish Impulse) at X = 0.67
      // Wick
      if (normX >= 0.66 && normX <= 0.68 && normY >= 0.24 && normY <= 0.65) {
        r = greenR; g = greenG; b = greenB;
      }
      // Body
      if (normX >= 0.61 && normX <= 0.73 && normY >= 0.30 && normY <= 0.58) {
        r = greenR; g = greenG; b = greenB;
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  function crc32(buf) {
    let c = ~0;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (-(c & 1) & 0xedb88320);
    }
    return ~c;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type);
    const body = Buffer.concat([typeBuf, data]);
    const crc = Buffer.alloc(4);
    crc.writeInt32BE(crc32(body), 0);
    return Buffer.concat([len, body, crc]);
  }

  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    header,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

const iconsDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(iconsDir, { recursive: true });

fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), generateTradingBoyPng(192, false));
fs.writeFileSync(path.join(iconsDir, 'icon-192-maskable.png'), generateTradingBoyPng(192, true));
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), generateTradingBoyPng(512, false));
fs.writeFileSync(path.join(iconsDir, 'icon-512-maskable.png'), generateTradingBoyPng(512, true));
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.png'), generateTradingBoyPng(180, false));

console.log('All PWA PNG icons generated successfully in public/icons/');
