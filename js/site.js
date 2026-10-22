import { drawBrainSlice, loadVolume, loadImage } from "./brain.js";

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- day / night theme ----------
   The mode lives in `documentElement.dataset.theme`; the inline snippet in
   every <head> sets it before the first paint, so this module only has to
   wire up the button, remember the choice and tell the rest of the page.
   -------------------------------------------------------------------------- */

const THEME_KEY = "site-theme";
const rootEl = document.documentElement;

const systemTheme = () =>
  window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";

function storedTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : null;
  } catch {
    return null;
  }
}

function applyTheme(theme, persist = false) {
  rootEl.dataset.theme = theme;
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* private mode — the theme just won't stick */
    }
  }

  const label = theme === "light" ? "Switch to night mode" : "Switch to day mode";
  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    btn.setAttribute("aria-label", label);
    btn.title = label;
  });

  // keep the browser chrome (address bar on mobile) in step with the page
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", theme === "light" ? "#f7f5f0" : "#06080b");

  document.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
}

const themeToggle = document.querySelector("[data-theme-toggle]");
if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    applyTheme(rootEl.dataset.theme === "light" ? "dark" : "light", true);
  });
}

applyTheme(rootEl.dataset.theme || storedTheme() || systemTheme());

// follow the OS while the visitor has not made an explicit choice
window
  .matchMedia("(prefers-color-scheme: light)")
  .addEventListener("change", (e) => {
    if (!storedTheme()) applyTheme(e.matches ? "light" : "dark");
  });

/* ---------- hero volume on / off ----------
   The WebGL volume behind the home page can be switched off by the visitor —
   on a low-power machine, or when the motion is unwelcome. The choice is
   remembered under the `site-hero` key and announced with a `herochange`
   event on `document`; `js/hero.js` listens for it. The inline snippet in
   the <head> reads the same key before the first paint, so the volume never
   flashes on for someone who switched it off.
   -------------------------------------------------------------------------- */

const HERO_KEY = "site-hero";

function applyHero(visible, persist = false, announce = true) {
  rootEl.dataset.hero = visible ? "on" : "off";
  if (persist) {
    try {
      localStorage.setItem(HERO_KEY, visible ? "on" : "off");
    } catch {
      /* private mode — the choice just won't stick */
    }
  }

  const label = visible ? "Turn off the hero volume" : "Turn on the hero volume";
  document.querySelectorAll("[data-hero-toggle]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(visible));
    btn.setAttribute("aria-label", label);
    btn.title = label;
  });

  if (announce) {
    document.dispatchEvent(new CustomEvent("herochange", { detail: { visible } }));
  }
}

const heroToggle = document.querySelector("[data-hero-toggle]");
if (heroToggle) {
  applyHero(rootEl.dataset.hero !== "off", false, false);
  heroToggle.addEventListener("click", () => {
    applyHero(rootEl.dataset.hero === "off", true);
  });
}

/* ---------- nav ---------- */
const nav = document.querySelector(".nav");
const progress = document.querySelector(".scroll-progress");
const toggle = document.querySelector(".nav-toggle");
const links = document.querySelector(".nav-links");

function onScroll() {
  const y = window.scrollY;
  if (nav) nav.classList.toggle("scrolled", y > 30);
  if (progress) {
    const h = document.documentElement.scrollHeight - innerHeight;
    progress.style.width = `${h > 0 ? (y / h) * 100 : 0}%`;
  }
}
addEventListener("scroll", onScroll, { passive: true });
onScroll();

if (toggle && links) {
  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
  });
  links.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
      links.classList.remove("open");
      toggle.classList.remove("open");
      document.body.style.overflow = "";
    })
  );
}

const page = document.body.dataset.page;
document.querySelectorAll("[data-nav]").forEach((a) => {
  if (a.dataset.nav === page) a.setAttribute("aria-current", "page");
});

/* ---------- reveal ---------- */
const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    }
  },
  { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
);
document.querySelectorAll(".rv, .sec-head").forEach((el) => io.observe(el));

new MutationObserver((muts) => {
  for (const m of muts) {
    for (const n of m.addedNodes) {
      if (n.nodeType !== 1) continue;
      if (n.matches?.(".rv, .sec-head")) io.observe(n);
      n.querySelectorAll?.(".rv, .sec-head").forEach((el) => io.observe(el));
    }
  }
}).observe(document.body, { childList: true, subtree: true });

/* ---------- spotlight cards ---------- */
document.querySelectorAll(".card").forEach((card) => {
  card.addEventListener("pointermove", (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    card.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  });
});

/* ---------- toast + copy ---------- */
let toastEl = null;
let toastTimer = 0;

function toast(msg) {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.className = "toast";
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
}

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-copy]");
  if (!btn) return;
  try {
    await navigator.clipboard.writeText(btn.dataset.copy);
    toast("Copied to clipboard");
  } catch {
    toast("Copy failed");
  }
});

/* ---------- year ---------- */
document.querySelectorAll("[data-year]").forEach((el) => {
  el.textContent = new Date().getFullYear();
});

/* ---------- portrait: scrub through the volume ---------- */
const portrait = document.querySelector("[data-portrait] canvas");
if (portrait) {
  const ctx = portrait.getContext("2d");
  const S = 460;
  // the acquisition is 224 x 186 in plane; the portrait shows it transposed
  // (x and y swapped) and flipped vertically, so the frame is 186 wide by 224 tall
  const ASPECT = 186 / 224;
  portrait.width = S;
  portrait.height = Math.round(S / ASPECT);
  ctx.imageSmoothingQuality = "high";
  const hudSlice = document.querySelector("[data-hud-slice]");
  const hudZ = document.querySelector("[data-hud-z]");

  let z = 0.47;
  let target = 0.47;
  let t = 0;
  let dragging = false;
  let userTouched = false;

  // scratch square for the procedural fallback
  const PS = Math.min(portrait.width, portrait.height);
  const scratch = document.createElement("canvas");
  scratch.width = scratch.height = PS;
  const sctx = scratch.getContext("2d", { willReadFrequently: true });

  // the real volume, once it lands
  let vol = null;
  let first = 0, last = 0, count = 0, center = 0, spacing = 1;
  const drawn = new Map();
  let current = -1;

  function drawPhantom() {
    drawBrainSlice(sctx, PS, z, { detail: 1.25, noise: 0.032, seed: 3 });
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, portrait.width, portrait.height);
    // transpose + vertical flip: source (u,v) -> (s*v, s*(W-u)), letterboxed into the frame
    const s = Math.min(portrait.width / scratch.height, portrait.height / scratch.width);
    ctx.save();
    ctx.translate((portrait.width - scratch.height * s) / 2, (portrait.height - scratch.width * s) / 2);
    ctx.transform(0, -s, s, 0, 0, s * scratch.width);
    ctx.drawImage(scratch, 0, 0);
    ctx.restore();
  }

  function drawSlice(idx) {
    const img = drawn.get(idx);
    if (!img) return false;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, portrait.width, portrait.height);
    // transpose + vertical flip: source (u,v) -> (s*v, s*(W-u))
    const s = Math.min(portrait.width / img.height, portrait.height / img.width);
    ctx.save();
    ctx.translate((portrait.width - img.height * s) / 2, (portrait.height - img.width * s) / 2);
    ctx.transform(0, -s, s, 0, 0, s * img.width);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
    return true;
  }

  function requestSlice(idx) {
    if (!vol || drawn.has(idx)) return;
    loadImage(vol.stackUrl(idx))
      .then((img) => {
        drawn.set(idx, img);
        if (current === idx) paint();
      })
      .catch(() => {
        /* slice unavailable — keep the previous frame */
      });
  }

  function paint() {
    if (!vol) {
      drawPhantom();
      const idx = Math.round(z * 41) + 1;
      if (hudSlice) hudSlice.textContent = `slice ${String(idx).padStart(3, "0")} / 042`;
      if (hudZ) hudZ.textContent = `z = ${(z * 120).toFixed(1)} mm`;
      return;
    }
    const idx = first + Math.round(z * (count - 1));
    current = idx;
    drawSlice(idx);
    if (hudSlice) hudSlice.textContent = `slice ${String(idx).padStart(3, "0")} / ${String(last).padStart(3, "0")}`;
    const mm = (center - idx) * spacing;
    if (hudZ) hudZ.textContent = `z = ${mm >= 0 ? "+" : "−"}${Math.abs(mm).toFixed(1)} mm`;
    requestSlice(idx);
  }

  portrait.addEventListener("pointerdown", (e) => {
    dragging = true;
    userTouched = true;
    portrait.setPointerCapture(e.pointerId);
    setZ(e);
  });
  portrait.addEventListener("pointermove", (e) => { if (dragging) setZ(e); });
  portrait.addEventListener("pointerup", () => { dragging = false; });

  function setZ(e) {
    const r = portrait.getBoundingClientRect();
    target = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
  }

  function loop(now) {
    requestAnimationFrame(loop);
    if (!userTouched && !reduced) {
      t = now / 1000;
      const ph = (t % 14) / 14;
      target = 0.12 + 0.76 * (ph < 0.5 ? ph * 2 : 2 - ph * 2);
    }
    const nz = z + (target - z) * (dragging ? 0.5 : 0.08);
    if (Math.abs(nz - z) > 0.0004) { z = nz; paint(); }
  }
  paint();
  requestAnimationFrame(loop);

  // swap in the real acquisition
  loadVolume()
    .then((v) => {
      vol = v;
      first = v.meta.stack.first;
      last = v.meta.stack.last;
      count = v.meta.stack.count;
      center = v.meta.stack.center;
      spacing = v.meta.spacingMm;
      paint();
    })
    .catch(() => {
      /* keep the procedural slice */
    });
}

/* ---------- research mini figures ---------- */
const figs = document.querySelectorAll("[data-mini]");
if (figs.length) {
  const runners = [];
  figs.forEach((cv) => {
    const kind = cv.dataset.mini;
    const ctx = cv.getContext("2d");
    const runner = makeFigure(kind, cv, ctx);
    if (runner) runners.push(runner);
  });

  const fio = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const r = runners.find((x) => x.cv === e.target);
        if (r) r.visible = e.isIntersecting;
      }
    },
    { threshold: 0.15 }
  );
  runners.forEach((r) => fio.observe(r.cv));

  let last = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    for (const r of runners) if (r.visible) r.draw(now / 1000, dt);
  }
  requestAnimationFrame(tick);
}

function fitCanvas(cv) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = cv.clientWidth || 300;
  const h = cv.clientHeight || 180;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
  }
  return dpr;
}

/* Reset a figure canvas to its CSS size and clear it to the panel colour. */
function beginFrame(cv, ctx) {
  const dpr = fitCanvas(cv);
  const w = cv.width / dpr, h = cv.height / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#04060a";
  ctx.fillRect(0, 0, w, h);
  return { w, h };
}

function makeFigure(kind, cv, ctx) {
  const state = { cv, visible: false, draw: () => {} };

  if (kind === "mask") {
    state.draw = (t) => {
      const { w, h } = beginFrame(cv, ctx);

      const cols = 44, rows = Math.round(cols * (h / w));
      const cw = w / cols, ch = h / rows;
      const p = (t * 0.24) % 1.25;
      const cx = cols / 2, cy = rows / 2;
      const maxD = Math.hypot(cx, cy);

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const d = Math.hypot(x - cx, y - cy) / maxD;
          const keep = Math.random() < Math.pow(1 - d, 1.9) + 0.04;
          if (!keep) continue;
          const phase = 1 - d;
          if (phase > p) continue;
          const a = Math.min(1, (p - phase) * 6);
          ctx.fillStyle = `rgba(92,242,208,${0.25 + a * 0.6})`;
          ctx.fillRect(x * cw + 0.6, y * ch + 0.6, cw - 1.2, ch - 1.2);
        }
      }
      ctx.strokeStyle = "rgba(92,242,208,0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    };
    return state;
  }

  if (kind === "motion") {
    state.draw = (t) => {
      const { w, h } = beginFrame(cv, ctx);

      const n = 11;
      const mid = h / 2;
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1);
        const y0 = mid + (k - 0.5) * h * 0.72;
        const shift =
          Math.sin(t * 1.4 + k * 5.2) * h * 0.06 * (0.4 + k * 0.9) +
          Math.sin(t * 0.5 + k * 2.1) * h * 0.03;
        const alpha = 0.25 + 0.6 * Math.sin(Math.PI * k);
        ctx.strokeStyle = `rgba(92,242,208,${alpha * 0.75})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 6) {
          const u = x / w;
          const wob = Math.sin(u * 9 + t * 2 + k * 3) * 4 * (0.3 + k);
          const yy = y0 + shift * Math.sin(Math.PI * u) + wob;
          if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }

      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.moveTo(w / 2, 8);
      ctx.lineTo(w / 2, h - 8);
      ctx.stroke();
      ctx.setLineDash([]);
    };
    return state;
  }

  if (kind === "relax") {
    state.draw = (t) => {
      const { w, h } = beginFrame(cv, ctx);

      const pad = 14;
      const gw = w - pad * 2, gh = h - pad * 2;

      ctx.strokeStyle = "rgba(255,255,255,0.07)";
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = pad + (i / 4) * gh;
        ctx.beginPath();
        ctx.moveTo(pad, y);
        ctx.lineTo(w - pad, y);
        ctx.stroke();
      }

      const T1 = 0.9;
      const curve = (u) => 1 - Math.exp(-u / T1);
      const marker = (t * 0.3) % 1.3;

      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const u = (i / 120) * 1.3;
        const x = pad + (u / 1.3) * gw;
        const y = pad + gh - curve(u) * gh;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "#5cf2d0";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.lineTo(w - pad, h - pad);
      ctx.lineTo(pad, h - pad);
      ctx.closePath();
      ctx.fillStyle = "rgba(92,242,208,0.08)";
      ctx.fill();

      const mx = pad + (marker / 1.3) * gw;
      const my = pad + gh - curve(marker) * gh;
      ctx.strokeStyle = "rgba(92,242,208,0.4)";
      ctx.beginPath();
      ctx.moveTo(mx, pad);
      ctx.lineTo(mx, h - pad);
      ctx.stroke();
      ctx.fillStyle = "#5cf2d0";
      ctx.beginPath();
      ctx.arc(mx, my, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(92,242,208,0.25)";
      ctx.beginPath();
      ctx.arc(mx, my, 9, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(236,234,228,0.45)";
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.fillText("M₀", 4, pad + 8);
      ctx.fillText("t →", w - 30, h - 5);
    };
    return state;
  }

  return null;
}
