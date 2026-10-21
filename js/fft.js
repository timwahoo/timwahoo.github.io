/* Iterative radix-2 FFT — 1D and 2D, power-of-two sizes. */

export function fft(re, im, inverse) {
  const n = re.length;

  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((Math.PI * 2) / len) * (inverse ? 1 : -1);
    const wr = Math.cos(ang), wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < half; j++) {
        const a = i + j, b = a + half;
        const vr = re[b] * cr - im[b] * ci;
        const vi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - vr;
        im[b] = im[a] - vi;
        re[a] += vr;
        im[a] += vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }

  if (inverse) {
    const s = 1 / n;
    for (let i = 0; i < n; i++) { re[i] *= s; im[i] *= s; }
  }
}

export function fft2d(image, N) {
  const re = Float64Array.from(image);
  const im = new Float64Array(N * N);

  for (let y = 0; y < N; y++) {
    const o = y * N;
    fft(re.subarray(o, o + N), im.subarray(o, o + N), false);
  }

  const tr = new Float64Array(N), ti = new Float64Array(N);
  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) { tr[y] = re[y * N + x]; ti[y] = im[y * N + x]; }
    fft(tr, ti, false);
    for (let y = 0; y < N; y++) { re[y * N + x] = tr[y]; im[y * N + x] = ti[y]; }
  }
  return { re, im };
}

/* fftshift / ifftshift — move the DC bin to the centre of the array so the
   k-space axes run -N/2 .. N/2 instead of 0 .. N/2.
   Even sizes: swap the two halves of every row and column.
   Odd sizes: rotate by floor(n/2) (fftshift) / ceil(n/2) (ifftshift).
   Operates in place on the given re/im arrays. */

function shiftRow(a, o, n, dir) {
  const h = n >> 1;
  if (n % 2 === 0) {
    for (let i = 0; i < h; i++) {
      const j = o + i, k = o + i + h;
      const t = a[j]; a[j] = a[k]; a[k] = t;
    }
    return;
  }
  const row = a.subarray(o, o + n);
  const tmp = row.slice();
  for (let i = 0; i < n; i++) row[i] = tmp[(((i + dir * h) % n) + n) % n];
}

function shiftCol(a, n, x, dir) {
  const h = n >> 1;
  if (n % 2 === 0) {
    for (let i = 0; i < h; i++) {
      const j = i * n + x, k = (i + h) * n + x;
      const t = a[j]; a[j] = a[k]; a[k] = t;
    }
    return;
  }
  const tmp = new Float64Array(n);
  for (let i = 0; i < n; i++) tmp[i] = a[i * n + x];
  for (let i = 0; i < n; i++) a[i * n + x] = tmp[(((i + dir * h) % n) + n) % n];
}

function shift2d(re, im, N, dir) {
  for (let y = 0; y < N; y++) {
    const o = y * N;
    shiftRow(re, o, N, dir);
    shiftRow(im, o, N, dir);
  }
  for (let x = 0; x < N; x++) {
    shiftCol(re, N, x, dir);
    shiftCol(im, N, x, dir);
  }
}

export function fftshift2d(re, im, N) {
  shift2d(re, im, N, 1);
}

export function ifftshift2d(re, im, N) {
  shift2d(re, im, N, -1);
}

export function ifft2dMag(reIn, imIn, N) {
  const re = Float64Array.from(reIn);
  const im = Float64Array.from(imIn);

  for (let y = 0; y < N; y++) {
    const o = y * N;
    fft(re.subarray(o, o + N), im.subarray(o, o + N), true);
  }

  const tr = new Float64Array(N), ti = new Float64Array(N);
  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) { tr[y] = re[y * N + x]; ti[y] = im[y * N + x]; }
    fft(tr, ti, true);
    for (let y = 0; y < N; y++) { re[y * N + x] = tr[y]; im[y * N + x] = ti[y]; }
  }

  const mag = new Float32Array(N * N);
  for (let i = 0; i < mag.length; i++) mag[i] = Math.hypot(re[i], im[i]);
  return mag;
}
