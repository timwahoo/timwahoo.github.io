/* MRI brain slices.
 *
 * Two sources live here: a procedural axial phantom (pure canvas math) that
 * stands in until the real acquisition arrives, and the loader for the MGE
 * volume in assets/mri. Nothing here depends on a build step.
 */

function rng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function brainProfile(z) {
  const t = Math.min(1, Math.max(0, z));
  let f = Math.pow(Math.sin(Math.PI * (0.115 + 0.885 * t)), 0.55);
  f = Math.max(f, 0.17);
  const taper = 1 - 0.1 * Math.max(0, t - 0.72) / 0.28;
  return { rx: 0.44 * f * taper, ry: 0.475 * f * taper };
}

function superEllipse(ctx, cx, cy, rx, ry, n) {
  const steps = 96;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    const x = cx + rx * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
    const y = cy + ry * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function gray(v) {
  const g = Math.max(0, Math.min(255, Math.round(v * 255)));
  return `rgb(${g},${g},${g})`;
}

export function drawBrainSlice(ctx, S, z, opts = {}) {
  const detail = opts.detail ?? 1;
  const seed = opts.seed ?? 7;
  const rand = rng(Math.floor(seed * 1000 + z * 8977) + 17);

  ctx.save();
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, S, S);

  const cx = S / 2, cy = S / 2;
  const { rx, ry } = brainProfile(z);
  const RX = rx * S, RY = ry * S;
  if (RX < 3) { ctx.restore(); return; }

  const n = 2.6;
  const inVentricles = z > 0.26 && z < 0.74;
  const vEnv = inVentricles
    ? Math.sin(Math.PI * (z - 0.26) / 0.48)
    : 0;

  // scalp / fat (bright on T1)
  superEllipse(ctx, cx, cy, RX, RY, n);
  ctx.fillStyle = gray(0.82);
  ctx.fill();

  // skull (signal void)
  superEllipse(ctx, cx, cy, RX * 0.955, RY * 0.955, n);
  ctx.fillStyle = gray(0.1);
  ctx.fill();

  // dura
  superEllipse(ctx, cx, cy, RX * 0.9, RY * 0.9, n);
  ctx.fillStyle = gray(0.24);
  ctx.fill();

  // CSF space
  superEllipse(ctx, cx, cy, RX * 0.865, RY * 0.865, n);
  ctx.fillStyle = gray(0.93);
  ctx.fill();

  // brain parenchyma (gray matter)
  superEllipse(ctx, cx, cy, RX * 0.815, RY * 0.815, n);
  ctx.fillStyle = gray(0.52);
  ctx.fill();

  ctx.save();
  ctx.clip();

  // white matter core
  ctx.filter = `blur(${Math.max(1, S * 0.012)}px)`;
  superEllipse(ctx, cx, cy - RY * 0.02, RX * 0.6, RY * 0.6, 2.3);
  ctx.fillStyle = gray(0.74);
  ctx.fill();

  // deep gray structures
  if (vEnv > 0.05) {
    const th = RY * 0.1;
    ctx.fillStyle = gray(0.6);
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + sgn * RX * 0.2, cy + RY * 0.05, RX * 0.14, th, sgn * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.filter = "none";

  // ventricles (CSF — bright on T2)
  if (vEnv > 0.03) {
    const w = RX * (0.1 + 0.055 * vEnv);
    const h = RY * (0.16 + 0.12 * vEnv);
    ctx.fillStyle = gray(0.95);
    for (const sgn of [-1, 1]) {
      ctx.save();
      ctx.translate(cx + sgn * RX * 0.155, cy - RY * 0.03);
      ctx.rotate(sgn * -0.22);
      ctx.beginPath();
      ctx.moveTo(-w * 0.1, -h);
      ctx.quadraticCurveTo(w * 1.1, -h * 0.5, w * 0.75, h * 0.85);
      ctx.quadraticCurveTo(w * 0.1, h * 0.35, -w * 0.3, h * 0.2);
      ctx.quadraticCurveTo(-w * 0.5, -h * 0.4, -w * 0.1, -h);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // third ventricle
    ctx.beginPath();
    ctx.ellipse(cx, cy + RY * 0.04, RX * 0.02, RY * 0.11 * vEnv, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // sulci — GM invaginations from the surface
  if (detail > 0.35) {
    const sulci = Math.round(20 + 12 * detail);
    ctx.strokeStyle = gray(0.44);
    ctx.lineCap = "round";
    for (let i = 0; i < sulci; i++) {
      const a = (i / sulci) * Math.PI * 2 + rand() * 0.4;
      const depth = 0.22 + rand() * 0.3;
      const wig = (rand() - 0.5) * 0.5;
      const x0 = cx + Math.cos(a) * RX * 0.8;
      const y0 = cy + Math.sin(a) * RY * 0.8;
      const x1 = cx + Math.cos(a + wig * 0.3) * RX * (0.8 - depth);
      const y1 = cy + Math.sin(a + wig * 0.3) * RY * (0.8 - depth);
      ctx.lineWidth = S * (0.014 + rand() * 0.012);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(
        cx + Math.cos(a + wig * 0.15) * RX * (0.8 - depth * 0.45),
        cy + Math.sin(a + wig * 0.15) * RY * (0.8 - depth * 0.45),
        x1, y1
      );
      ctx.stroke();
      if (rand() > 0.5) {
        ctx.lineWidth = S * 0.011;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(
          cx + Math.cos(a + wig) * RX * (0.8 - depth * 1.25),
          cy + Math.sin(a + wig) * RY * (0.8 - depth * 1.25)
        );
        ctx.stroke();
      }
    }
  }

  // interhemispheric fissure
  ctx.strokeStyle = gray(0.35);
  ctx.lineWidth = Math.max(1, S * 0.014);
  ctx.beginPath();
  ctx.moveTo(cx, cy - RY * 0.84);
  ctx.quadraticCurveTo(cx + RX * 0.015, cy, cx, cy + RY * 0.84);
  ctx.stroke();

  ctx.restore();

  // faint intensity inhomogeneity (B1 shading)
  const grad = ctx.createRadialGradient(cx - RX * 0.3, cy - RY * 0.4, 0, cx, cy, RX * 1.4);
  grad.addColorStop(0, "rgba(255,255,255,0.12)");
  grad.addColorStop(0.55, "rgba(255,255,255,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.34)");
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);
  ctx.globalCompositeOperation = "source-over";

  // noise
  if (detail > 0.3) {
    const amt = opts.noise ?? 0.035;
    const img = ctx.getImageData(0, 0, S, S);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] + d[i + 1] + d[i + 2] === 0) continue;
      const g = (rand() - 0.5) * 255 * amt;
      d[i] = Math.max(0, Math.min(255, d[i] + g));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + g));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + g));
    }
    ctx.putImageData(img, 0, 0);
  }

  ctx.restore();
}

const texCache = new Map();

export function sliceCanvas(S, z, opts) {
  const key = `${S}|${z.toFixed(4)}|${opts?.seed ?? 7}|${opts?.detail ?? 1}|${opts?.noise ?? 0}`;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement("canvas");
  c.width = c.height = S;
  drawBrainSlice(c.getContext("2d"), S, z, opts);
  texCache.set(key, c);
  return c;
}

export function sliceImageFloat(S, z, opts) {
  const c = sliceCanvas(S, z, { ...opts, detail: 1.2, noise: 0.03 });
  const d = c.getContext("2d").getImageData(0, 0, S, S).data;
  const out = new Float32Array(S * S);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4] / 255;
  return out;
}

/* ---------- real volume (assets/mri) ----------
 *
 * The site ships a real, skull-stripped axial MGE volume (TE 3 ms, 1 mm
 * isotropic) as a stack of PNGs, described by assets/mri/manifest.json.
 * Everything above stays in place as the fallback: if the manifest or the
 * images cannot be fetched, the procedural phantom is used instead and the
 * site looks exactly as it did before.
 */

const MANIFEST_URL = "assets/mri/manifest.json";

let volumePromise = null;

export function loadVolume(url = MANIFEST_URL) {
  if (!volumePromise) {
    volumePromise = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`manifest ${r.status}`);
        return r.json();
      })
      .then((meta) => {
        const base = new URL(url, location.href);
        const dir = (rel) => new URL(rel.endsWith("/") ? rel : `${rel}/`, base).href;
        const stackDir = dir(meta.stack.dir);
        const heroDir = dir(meta.hero.dir);
        const labDir = dir(meta.lab.dir);
        return {
          meta,
          stackUrl: (i) =>
            new URL(`${meta.stack.prefix}${String(i).padStart(meta.stack.digits, "0")}.png`, stackDir).href,
          heroUrl: (i) => new URL(meta.hero.files[i], heroDir).href,
          labUrl: () => new URL(meta.lab.file, labDir).href,
        };
      })
      .catch((err) => {
        volumePromise = null;
        throw err;
      });
  }
  return volumePromise;
}

const imgCache = new Map();

export function loadImage(url) {
  if (!imgCache.has(url)) {
    imgCache.set(
      url,
      new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => {
          imgCache.delete(url);
          rej(new Error(`image failed: ${url}`));
        };
        im.src = url;
      })
    );
  }
  return imgCache.get(url);
}

/* Draw a slice into a square canvas, letterboxed on black, so the anatomy
   keeps its aspect ratio instead of being stretched. */
export function sliceToCanvas(img, size, readFrequently) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d", readFrequently ? { willReadFrequently: true } : undefined);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  const s = size / Math.max(img.width, img.height);
  const w = img.width * s, h = img.height * s;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  return c;
}

/* The day-mode ink mask. A T1 volume has very bright white matter, so the
   raw brightness would flood the interior into solid ink; the gamma pushes
   the mid-tones down and leaves the ventricles and the gray/white boundary
   legible on paper. */
export function sliceToMaskCanvas(img, size, gamma) {
  const c = sliceToCanvas(img, size, true);
  const ctx = c.getContext("2d");
  const d = ctx.getImageData(0, 0, size, size);
  const p = d.data;
  const g = gamma || 1;
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) lut[i] = Math.round(255 * Math.pow(i / 255, g));
  for (let i = 0; i < p.length; i += 4) {
    p[i] = lut[p[i]];
    p[i + 1] = lut[p[i + 1]];
    p[i + 2] = lut[p[i + 2]];
  }
  ctx.putImageData(d, 0, 0);
  return c;
}

/* Resample a slice into an N x N array of 0..1 samples, for the FFT. */
export function sliceToFloat(img, N) {
  const c = sliceToCanvas(img, N, true);
  const d = c.getContext("2d").getImageData(0, 0, N, N).data;
  const out = new Float32Array(N * N);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4] / 255;
  return out;
}
