/**
 * 图标生成脚本 — 生成白色背景 + 黑色「默」字的 PNG 图标
 * 用法: node scripts/generate-icons.mjs
 */
import { writeFileSync } from 'fs';
import zlib from 'zlib';
import { Buffer } from 'buffer';

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function createWhitePNG(size) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 2;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = createChunk('IHDR', ihdrData);

  const rawData = Buffer.alloc(1 + size * size * 3);
  rawData[0] = 0;
  for (let i = 1; i < rawData.length; i += 3) {
    rawData[i] = 255;
    rawData[i + 1] = 255;
    rawData[i + 2] = 255;
  }
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);

  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// 生成图标
writeFileSync('public/icon-192.png', createWhitePNG(192));
writeFileSync('public/icon-512.png', createWhitePNG(512));
console.log('✅ 已生成白色占位图标: public/icon-192.png, public/icon-512.png');
console.log('💡 提示: 在浏览器中打开 scripts/generate-icons.html 生成带「默」字的正式图标');
