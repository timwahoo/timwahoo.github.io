/* Build the derived MRI assets from the source PNG stack.
 *
 *   node tools/build-mri-assets.mjs
 *
 * Reads  assets/png_stack/slice_NNNN.png   (8-bit grayscale, 224x186)
 * Writes assets/mri/hero/slice_NN.png       (160x160, square, 44 slices)
 *        assets/mri/lab/phantom.png         (256x256, one slice)
 *        assets/mri/manifest.json           (what the site reads)
 *
 * The source stack is never modified. Everything here is plain Node
 * (fs + zlib), so there is no build step for the site itself.
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "assets", "png_stack");
const OUT = path.join(ROOT, "assets", "mri");

/* ---------- PNG decode (8-bit grayscale, non-interlaced) ---------- */

function decodePNG(file) {
  const buf = fs.readFileSync(file);
  let pos = 8, ihdr = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      ihdr = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), depth: data[8], color: data[9], interlace: data[12] };
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (!ihdr) throw new Error(`${file}: no IHDR`);
  if (ihdr.depth !== 8 || ihdr.color !== 0 || ihdr.interlace !== 0) {
    throw new Error(`${file}: expected 8-bit grayscale, got depth=${ihdr.depth} color=${ihdr.color} interlace=${ihdr.interlace}`);
  }
  const { width, height } = ihdr;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(width * height);
  let rp = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rp++];
    const line = raw.subarray(rp, rp + width);
    rp += width;
    const cur = out.subarray(y * width, (y + 1) * width);
    const prev = y ? out.subarray((y - 1) * width, y * width) : null;
    for (let x = 0; x < width; x++) {
      const a = x >= 1 ? cur[x - 1] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= 1 ? prev[x - 1] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 255;
    }
  }
  return { width, height, data: out };
}

/* ---------- PNG encode (8-bit grayscale) ---------- */

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, data) {
  const stride = width;
  const raw = Buffer.alloc(height * (stride + 1));
  const cand = [Buffer.alloc(stride), Buffer.alloc(stride), Buffer.alloc(stride), Buffer.alloc(stride), Buffer.alloc(stride)];
  for (let y = 0; y < height; y++) {
    const row = data.subarray(y * stride, (y + 1) * stride);
    const prev = y ? data.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= 1 ? row[x - 1] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= 1 ? prev[x - 1] : 0;
      cand[0][x] = row[x];
      cand[1][x] = (row[x] - a) & 255;
      cand[2][x] = (row[x] - b) & 255;
      cand[3][x] = (row[x] - ((a + b) >> 1)) & 255;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      cand[4][x] = (row[x] - pr) & 255;
    }
    let best = 0, bestScore = Infinity;
    for (let f = 0; f < 5; f++) {
      let score = 0;
      for (let x = 0; x < stride; x++) {
        const v = cand[f][x];
        score += v < 128 ? v : 256 - v;
      }
      if (score < bestScore) { bestScore = score; best = f; }
    }
    raw[y * (stride + 1)] = best;
    cand[best].copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 0;   // grayscale
  ihdr[10] = 0;  // deflate
  ihdr[11] = 0;  // adaptive filtering
  ihdr[12] = 0;  // no interlace
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------- resampling ---------- */

/* Fit a w x h image into a square of `size`, letterboxed on black, then
 * resample to `size` x `size`. The anatomy keeps its aspect ratio. */
function fitSquare(img, size) {
  const side = Math.max(img.width, img.height);
  const out = new Float32Array(size * size);
  const scale = size / side;
  const ox = (size - img.width * scale) / 2;
  const oy = (size - img.height * scale) / 2;
  for (let y = 0; y < size; y++) {
    const sy = (y - oy) / scale;
    for (let x = 0; x < size; x++) {
      const sx = (x - ox) / scale;
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      const fx = sx - x0, fy = sy - y0;
      const g = (px, py) => {
        if (px < 0 || py < 0 || px >= img.width || py >= img.height) return 0;
        return img.data[py * img.width + px];
      };
      const v =
        g(x0, y0) * (1 - fx) * (1 - fy) +
        g(x0 + 1, y0) * fx * (1 - fy) +
        g(x0, y0 + 1) * (1 - fx) * fy +
        g(x0 + 1, y0 + 1) * fx * fy;
      out[y * size + x] = v;
    }
  }
  return out;
}

function toBytes(f) {
  const b = Buffer.alloc(f.length);
  for (let i = 0; i < f.length; i++) b[i] = Math.max(0, Math.min(255, Math.round(f[i])));
  return b;
}

/* ---------- build ---------- */

const HERO_SIZE = 160;
const HERO_COUNT = 44;
const LAB_SIZE = 256;

const files = fs.readdirSync(SRC).filter((f) => f.endsWith(".png")).sort();
if (!files.length) throw new Error(`no PNGs in ${SRC}`);

const indexOf = (f) => parseInt(f.match(/(\d+)\.png$/)[1], 10);

// decode + measure every slice once
const slices = files.map((f) => {
  const img = decodePNG(path.join(SRC, f));
  let fg = 0, sum = 0, max = 0;
  for (let i = 0; i < img.data.length; i++) {
    const v = img.data[i];
    sum += v;
    if (v > max) max = v;
    if (v > 8) fg++;
  }
  return { file: f, index: indexOf(f), img, coverage: fg / img.data.length, mean: sum / img.data.length, max };
});

// keep the slices that actually contain head tissue
const USABLE = slices.filter((s) => s.coverage > 0.05);
const first = USABLE[0].index;
const last = USABLE[USABLE.length - 1].index;
const byIndex = new Map(slices.map((s) => [s.index, s]));

// hero: evenly spaced samples across the usable range
const heroIndices = [];
for (let i = 0; i < HERO_COUNT; i++) {
  heroIndices.push(first + Math.round((i * (last - first)) / (HERO_COUNT - 1)));
}

// lab: the mid-brain slice
const labIndex = Math.round((first + last) / 2);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "hero"), { recursive: true });
fs.mkdirSync(path.join(OUT, "lab"), { recursive: true });

let heroBytes = 0;
const heroFiles = [];
heroIndices.forEach((idx, i) => {
  const src = byIndex.get(idx);
  if (!src) throw new Error(`missing slice ${idx}`);
  const bytes = toBytes(fitSquare(src.img, HERO_SIZE));
  const name = `slice_${String(i).padStart(2, "0")}.png`;
  fs.writeFileSync(path.join(OUT, "hero", name), encodePNG(HERO_SIZE, HERO_SIZE, bytes));
  heroBytes += fs.statSync(path.join(OUT, "hero", name)).size;
  heroFiles.push(name);
});

const labBytes = toBytes(fitSquare(byIndex.get(labIndex).img, LAB_SIZE));
fs.writeFileSync(path.join(OUT, "lab", "phantom.png"), encodePNG(LAB_SIZE, LAB_SIZE, labBytes));
const labSize = fs.statSync(path.join(OUT, "lab", "phantom.png")).size;

const manifest = {
  source: "assets/png_stack",
  sequence: "MGE",
  te: 3,
  tr: 7.2,
  plane: "axial",
  contrast: "T1-weighted",
  voxelMm: 1,
  spacingMm: 1,
  width: byIndex.get(labIndex).img.width,
  height: byIndex.get(labIndex).img.height,
  stack: {
    dir: "../png_stack",
    prefix: "slice_",
    digits: 4,
    first,
    last,
    count: last - first + 1,
    center: (first + last) / 2,
  },
  hero: { dir: "hero", size: HERO_SIZE, files: heroFiles, indices: heroIndices },
  lab: { dir: "lab", file: "phantom.png", size: LAB_SIZE, index: labIndex },
};
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

console.log(`source      ${files.length} slices, ${byIndex.get(labIndex).img.width}x${byIndex.get(labIndex).img.height}`);
console.log(`usable      ${first}..${last} (${manifest.stack.count} slices)`);
console.log(`hero        ${heroIndices.length} x ${HERO_SIZE}x${HERO_SIZE} -> ${(heroBytes / 1024).toFixed(0)} KB on disk`);
console.log(`lab         slice ${labIndex} at ${LAB_SIZE}x${LAB_SIZE} -> ${(labSize / 1024).toFixed(0)} KB`);
console.log(`manifest    assets/mri/manifest.json`);
