import { deflateSync } from 'node:zlib';

const width = 512;
const height = 256;
const armor = { x: 2, y: 2, width: 220, height: 211 };
const mirrorArmorX = 227;
const visor = { x: 2, y: 223, width: 202, height: 29 };
const palette = {
  Dark: { color: '#1e242d', roughness: .34, metallic: .72 },
  Gunmetal: { color: '#333c4a', roughness: .28, metallic: .78 },
  Rubber: { color: '#14171c', roughness: .85, metallic: .12 },
  AccentRed: { color: '#dc2626', roughness: .35, metallic: .4, emissive: '#521014' },
  LedGreen: { color: '#10b981', roughness: .32, metallic: .18, emissive: '#0c875e' },
  Bolt: { color: '#161b22', roughness: .2, metallic: .9 },
};
const paletteNames = Object.keys(palette);

export function atlasUV(material, u, v, mirrorArmor = false) {
  if (material === 'Armor' || material === 'Visor') {
    const rect = material === 'Armor' ? armor : visor;
    const left = material === 'Armor' && mirrorArmor ? mirrorArmorX : rect.x;
    return [(left + .5 + Math.min(1, Math.max(0, u)) * (rect.width - 1)) / width,
      (rect.y + .5 + Math.min(1, Math.max(0, 1 - v)) * (rect.height - 1)) / height];
  }
  const index = paletteNames.indexOf(material);
  if (index === -1) throw new Error(`Unknown V-Pulse material ${material}`);
  return [480.5 / width, (index * 32 + 16.5) / height];
}

const glyphs = {
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
};

function glyphAt(text, x, y, left, top, scale) {
  const ix = Math.floor((x - left) / scale);
  const iy = Math.floor((y - top) / scale);
  if (ix < 0 || ix >= text.length * 6 || iy < 0 || iy >= 7) return false;
  return glyphs[text[Math.floor(ix / 6)]][iy][ix % 6] === '1';
}

const rgb = color => [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
const clamp = (n, upper) => Math.min(upper, Math.max(0, n));
const armorPalette = ['#4b5563', '#374151', '#e2e8f0', '#dc2626', '#f59e0b', '#111827'].map(rgb);
const screenPalette = ['#071620', '#10b981', '#154138'].map(rgb);

function armorPaint(x, y, mirrored) {
  const labelX = mirrored ? 868 - x : x;
  if (glyphAt('V-PULSE', labelX, y, 350, 185, 4) || glyphAt('!', x, y, 204, 223, 2.5)) return armorPalette[5];
  if (y >= 205 && y <= 246 && Math.abs(x - 210) < (y - 205) * .58) return armorPalette[4];
  if (y >= 198 && y <= 250 && ((x >= 885 && x <= 893) || (x >= 902 && x <= 932 - (30 / 26) * Math.abs(y - 224)))) return armorPalette[3];
  if (x >= 545 && x < 591) return armorPalette[2];
  return y >= 290 ? armorPalette[1] : armorPalette[0];
}

function depth(x, y) {
  const line = (at, sample) => Math.max(0, 1 - Math.abs(at - sample) / 3);
  const horizontal = x > 40 && x < 984 ? Math.max(line(40, y), line(285, y), line(472, y)) : 0;
  const vertical = y > 40 && y < 472 ? Math.max(...[40, 280, 640, 984].map(at => line(at, x))) : 0;
  return -Math.max(horizontal, vertical);
}

function textureRows() {
  const maps = Array.from({ length: 4 }, () => Buffer.alloc((width * 3 + 1) * height));
  const white = [255, 255, 255], black = [0, 0, 0], flatNormal = [128, 128, 255];
  const paletteRgb = paletteNames.map(name => ({
    ...palette[name], color: rgb(palette[name].color),
    emissive: palette[name].emissive ? rgb(palette[name].emissive) : black,
  }));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let color = white, roughness = .36, metallic = .58, emissive = black, normal = flatNormal;
      if (x < 452 && y <= 216) {
        const mirrored = x >= 225;
        const canvasX = clamp((x - (mirrored ? mirrorArmorX : armor.x)) / (armor.width - 1), 1) * 1023;
        const canvasY = clamp((y - armor.y) / (armor.height - 1), 1) * 511;
        color = armorPaint(canvasX, canvasY, mirrored);
        const dx = (depth(canvasX + 2, canvasY) - depth(canvasX - 2, canvasY)) * .24;
        const dy = (depth(canvasX, canvasY + 2) - depth(canvasX, canvasY - 2)) * .24;
        const n = Math.hypot(dx, dy, 1);
        normal = [Math.round((1 - dx / n) * 127.5), Math.round((1 + dy / n) * 127.5), Math.round((1 + 1 / n) * 127.5)];
      } else if (x < 211 && y > 216) {
        const px = clamp(x - visor.x, visor.width - 1);
        const py = clamp(y - visor.y, visor.height - 1);
        const lit = glyphAt('060', px, py, 60, 3, 2.6) || (py >= 23 && py < 26 && px > 18 && px < 80);
        color = lit ? screenPalette[1] : py % 5 === 0 ? screenPalette[2] : screenPalette[0];
        emissive = color;
        metallic = .1;
        roughness = .23;
      } else if (x >= 452 && y < paletteRgb.length * 32) {
        ({ color, roughness, metallic, emissive } = paletteRgb[Math.floor(y / 32)]);
      }
      const offset = y * (width * 3 + 1) + 1 + x * 3;
      const values = [color, [255, Math.round(roughness * 255), Math.round(metallic * 255)], emissive, normal];
      maps.forEach((buffer, index) => buffer.set(values[index], offset));
    }
  }
  return maps;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let i = 0; i < 8; i++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  return value;
});

function pngChunk(type, payload) {
  const chunk = Buffer.alloc(12 + payload.length);
  chunk.writeUInt32BE(payload.length, 0);
  chunk.write(type, 4, 4, 'ascii');
  payload.copy(chunk, 8);
  let crc = -1;
  for (let i = 4; i < 8 + payload.length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ chunk[i]) & 0xff];
  chunk.writeUInt32BE((crc ^ -1) >>> 0, 8 + payload.length);
  return chunk;
}

function rgbPng(rows) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(rows)), pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

export function embedVpulseTextures(bytes) {
  const original = Buffer.from(bytes);
  const jsonLength = original.readUInt32LE(12);
  const json = JSON.parse(original.toString('utf8', 20, 20 + jsonLength));
  const chunks = [original.subarray(28 + jsonLength)];
  let binaryLength = chunks[0].length;
  json.images = [];
  json.textures = [];
  json.samplers = [{ wrapS: 33071, wrapT: 33071, magFilter: 9729, minFilter: 9987 }];
  for (const rows of textureRows()) {
    const image = rgbPng(rows);
    const index = json.images.length;
    json.images.push({ bufferView: json.bufferViews.length, mimeType: 'image/png' });
    json.textures.push({ source: index, sampler: 0 });
    json.bufferViews.push({ buffer: 0, byteOffset: binaryLength, byteLength: image.length });
    const padding = Buffer.alloc((4 - image.length % 4) % 4);
    chunks.push(image, padding);
    binaryLength += image.length + padding.length;
  }
  const material = json.materials[0];
  material.pbrMetallicRoughness.baseColorTexture = { index: 0 };
  material.pbrMetallicRoughness.metallicRoughnessTexture = { index: 1 };
  material.pbrMetallicRoughness.metallicFactor = 1;
  material.pbrMetallicRoughness.roughnessFactor = 1;
  material.emissiveTexture = { index: 2 };
  material.emissiveFactor = [1, 1, 1];
  material.normalTexture = { index: 3, scale: .35 };
  json.buffers[0].byteLength = binaryLength;
  const encoded = Buffer.from(JSON.stringify(json));
  const jsonPadded = Buffer.concat([encoded, Buffer.alloc((4 - encoded.length % 4) % 4, 0x20)]);
  const header = Buffer.alloc(20);
  header.write('glTF', 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + jsonPadded.length + binaryLength, 8);
  header.writeUInt32LE(jsonPadded.length, 12);
  header.write('JSON', 16);
  const binaryHeader = Buffer.alloc(8);
  binaryHeader.writeUInt32LE(binaryLength, 0);
  binaryHeader.write('BIN\0', 4);
  return Buffer.concat([header, jsonPadded, binaryHeader, ...chunks]);
}
