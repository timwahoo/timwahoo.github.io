import { fft2d, ifft2dMag, fftshift2d, ifftshift2d } from "./fft.js";
import { sliceImageFloat, loadVolume, loadImage, sliceToFloat } from "./brain.js";
import { SITE } from "../data/data.js";

const N = 256;

const root = document.querySelector("[data-lab]");
if (root) init();

async function init() {
  // ---- data ------------------------------------------------------------
  // a real slice of the MGE acquisition; the procedural phantom is only
  // used when the volume cannot be loaded
  let img;
  try {
    const vol = await loadVolume();
    const im = await loadImage(vol.labUrl());
    img = sliceToFloat(im, N);
  } catch (err) {
    img = sliceImageFloat(N, 0.47, { seed: 5 });
  }
  const ksp = fft2d(img, N);
  // fftshift so DC sits at the centre: the masks below are all built around
  // index N/2, and that is where a centred k-space axis has k = 0
  fftshift2d(ksp.re, ksp.im, N);
  const { re: kRe, im: kIm } = ksp;

  const logNorm = new Float32Array(N * N);
  let maxLog = 0;
  for (let i = 0; i < N * N; i++) {
    const v = Math.log1p(Math.hypot(kRe[i], kIm[i]));
    logNorm[i] = v;
    if (v > maxLog) maxLog = v;
  }
  for (let i = 0; i < N * N; i++) logNorm[i] /= maxLog;

  const LUT = magmaLUT(256);

  // ---- dom -------------------------------------------------------------
  const $ = (s) => root.querySelector(s);
  const cvTruth = $("#panel-truth");
  const cvKsp = $("#panel-ksp");
  const cvRec = $("#panel-rec");
  const valAcq = root.querySelectorAll("#val-acq, [data-acq]");
  const valPsnr = root.querySelectorAll("#val-psnr, [data-psnr]");
  const valR = $("#val-r");
  const valNoise = $("#val-noise");
  const note = $("#lab-note");
  const replay = $("#replay");

  const ctxTruth = cvTruth.getContext("2d");
  const ctxKsp = cvKsp.getContext("2d");
  const ctxRec = cvRec.getContext("2d");
  for (const c of [cvTruth, cvKsp, cvRec]) { c.width = N; c.height = N; }

  drawGray(ctxTruth, img, N);

  // ---- state -----------------------------------------------------------
  let traj = "cartesian";
  let R = 4;
  let noise = 0;
  let progress = 1;
  let playing = false;
  let started = false;

  const NOTES = SITE.research?.lab?.notes ?? {};

  const trajBtns = root.querySelectorAll("[data-traj]");
  trajBtns.forEach((b) =>
    b.addEventListener("click", () => {
      trajBtns.forEach((x) => x.classList.toggle("on", x === b));
      traj = b.dataset.traj;
      note.innerHTML = NOTES[traj] ?? "";
      restart();
    })
  );

  const rRange = $("#ctrl-r");
  const nRange = $("#ctrl-noise");

  rRange.addEventListener("input", () => {
    R = [2, 3, 4, 6, 8][+rRange.value];
    valR.textContent = `${R}×`;
    restart();
  });

  nRange.addEventListener("input", () => {
    noise = +nRange.value / 100;
    valNoise.textContent = `${nRange.value}`;
    restart();
  });

  replay.addEventListener("click", restart);

  // ---- masks -----------------------------------------------------------
  const mask = new Float32Array(N * N);
  let spiralPts = null;

  function centroidLines(r) {
    const out = [];
    const c = N / 2;
    for (let x = 0; x < N; x++) {
      const d = x - c;
      if (((d % r) + r) % r === 0) out.push(x);
    }
    out.sort((a, b) => Math.abs(a - N / 2) - Math.abs(b - N / 2));
    return out;
  }

  function spiralPoints(r) {
    if (spiralPts && spiralPts.r === r) return spiralPts.pts;
    const shots = Math.max(2, Math.round(136 / r));
    const turns = shots;
    const pts = [];
    let th = 0;
    const thMax = Math.PI * 2 * turns;
    while (th < thMax) {
      const rad = (N / 2 - 1) * (th / thMax);
      const dth = Math.min(0.35, 1.6 / Math.max(rad, 2));
      const x = Math.round(N / 2 + Math.cos(th) * rad);
      const y = Math.round(N / 2 + Math.sin(th) * rad);
      if (x >= 0 && x < N && y >= 0 && y < N) pts.push(y * N + x);
      th += dth;
    }
    spiralPts = { r, pts };
    return pts;
  }

  function buildMask(p) {
    mask.fill(0);

    if (traj === "cartesian") {
      const lines = centroidLines(R);
      const count = Math.max(1, Math.ceil(p * lines.length));
      for (let i = 0; i < count; i++) {
        const x = lines[i];
        for (let y = 0; y < N; y++) mask[y * N + x] = 1;
      }
      return lines.length ? count / lines.length : 0;
    }

    if (traj === "radial") {
      const spokes = Math.ceil((Math.PI / 2) * N / R);
      const count = Math.max(1, Math.ceil(p * spokes));
      for (let s = 0; s < count; s++) {
        const a = (s / spokes) * Math.PI + 0.0007;
        const ca = Math.cos(a), sa = Math.sin(a);
        for (let t = -N / 2; t <= N / 2; t++) {
          const x = Math.round(N / 2 + t * ca);
          const y = Math.round(N / 2 + t * sa);
          if (x >= 0 && x < N && y >= 0 && y < N) mask[y * N + x] = 1;
        }
      }
      return count / spokes;
    }

    const pts = spiralPoints(R);
    const count = Math.max(1, Math.ceil(p * pts.length));
    for (let i = 0; i < count; i++) mask[pts[i]] = 1;
    return count / pts.length;
  }

  // ---- reconstruction ---------------------------------------------------
  const recRe = new Float64Array(N * N);
  const recIm = new Float64Array(N * N);
  const recImg = new Float32Array(N * N);

  function gaussian() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function reconstruct(acq) {
    const sigmaImg = noise * 0.11;
    const sigmaK = (sigmaImg * N) / Math.SQRT2;

    for (let i = 0; i < N * N; i++) {
      const m = mask[i];
      let r = kRe[i] * m;
      let im = kIm[i] * m;
      if (m > 0 && sigmaImg > 0) {
        r += gaussian() * sigmaK;
        im += gaussian() * sigmaK;
      }
      recRe[i] = r;
      recIm[i] = im;
    }

    // the masked spectrum lives in centred coordinates — undo the shift so
    // the inverse FFT gets the natural ordering it expects
    ifftshift2d(recRe, recIm, N);
    const mag = ifft2dMag(recRe, recIm, N);

    let mse = 0;
    for (let i = 0; i < N * N; i++) {
      recImg[i] = mag[i];
      const d = mag[i] - img[i];
      mse += d * d;
    }
    mse /= N * N;
    const psnr = mse > 1e-9 ? 10 * Math.log10(1 / mse) : 99;

    drawGray(ctxRec, recImg, N);
    drawKsp();

    valPsnr.forEach((el) => (el.textContent = `${psnr.toFixed(1)} dB`));
    valAcq.forEach((el) => (el.textContent = `${(acq * 100).toFixed(0)}%`));
  }

  // ---- drawing ----------------------------------------------------------
  function drawGray(ctx, data, n) {
    const id = ctx.createImageData(n, n);
    const d = id.data;
    for (let i = 0; i < n * n; i++) {
      const v = Math.max(0, Math.min(255, data[i] * 255));
      d[i * 4] = v;
      d[i * 4 + 1] = v;
      d[i * 4 + 2] = v;
      d[i * 4 + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);
  }

  function drawKsp() {
    const id = ctxKsp.createImageData(N, N);
    const d = id.data;
    for (let i = 0; i < N * N; i++) {
      let v = logNorm[i];
      if (mask[i] < 0.5) v *= 0.045;
      const c = LUT[(v * 255) | 0];
      d[i * 4] = c[0];
      d[i * 4 + 1] = c[1];
      d[i * 4 + 2] = c[2];
      d[i * 4 + 3] = 255;
    }
    ctxKsp.putImageData(id, 0, 0);
  }

  function magmaLUT(size) {
    const stops = [
      [0.0, 0, 0, 4],
      [0.15, 26, 15, 70],
      [0.3, 87, 16, 110],
      [0.45, 146, 40, 110],
      [0.6, 201, 62, 80],
      [0.75, 245, 122, 32],
      [0.9, 252, 193, 68],
      [1.0, 252, 253, 191],
    ];
    const lut = [];
    for (let i = 0; i < size; i++) {
      const t = i / (size - 1);
      let s = 0;
      while (s < stops.length - 2 && t > stops[s + 1][0]) s++;
      const a = stops[s], b = stops[s + 1];
      const f = (t - a[0]) / (b[0] - a[0] || 1);
      lut.push([
        Math.round(a[1] + (b[1] - a[1]) * f),
        Math.round(a[2] + (b[2] - a[2]) * f),
        Math.round(a[3] + (b[3] - a[3]) * f),
      ]);
    }
    return lut;
  }

  // ---- acquisition loop ---------------------------------------------------
  const ACQ_SECONDS = 4.2;

  function restart() {
    progress = 0;
    playing = true;
    started = true;
  }

  let last = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, 0.06);
    last = now;
    if (!playing) return;

    progress = Math.min(1, progress + dt / ACQ_SECONDS);
    const acq = buildMask(progress);
    reconstruct(acq);

    if (progress >= 1) playing = false;
  }
  requestAnimationFrame(tick);

  buildMask(1);
  reconstruct(1);

  const io = new IntersectionObserver(
    ([e]) => {
      if (e.isIntersecting && !started) {
        started = true;
        restart();
        io.disconnect();
      }
    },
    { threshold: 0.25 }
  );
  io.observe(root);
}
