import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { sliceCanvas, brainProfile, loadVolume, loadImage, sliceToCanvas, sliceToMaskCanvas } from "./brain.js";

const N_SLICES = 44;
const VOL_H = 3.5;
const HERO_TEX = 160;
/* Square planes: the MRI slices are letterboxed on black, so the anatomy
   keeps its aspect ratio and the plane geometry stays constant. */
const HERO_PLANE = 4.2;
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Day / night palettes for the stack.
   Night: the slices are lit from within — bright anatomy on a black plate.
   Day:   the plate is dropped and the anatomy doubles as an alpha mask, so
          the stack reads as translucent ink on paper instead of a glow. */
const THEMES = {
  dark: {
    fog: 0x06080b,
    slice: new THREE.Color(0.85, 0.9, 0.92),
    accent: new THREE.Color(0x5cf2d0),
    dust: new THREE.Color(0x9ef7e4),
    blending: THREE.AdditiveBlending,
    mask: false,
    opacityScale: 1,
    ring: 0.22,
    ring2: 0.14,
    arc: 0.85,
    box: 0.16,
    sweep: 0.045,
    sweepEdge: 0.65,
    particles: 0.5,
  },
  light: {
    fog: 0xf7f5f0,
    slice: new THREE.Color(0x39414b),
    accent: new THREE.Color(0x0b7a66),
    dust: new THREE.Color(0x0b7a66),
    blending: THREE.NormalBlending,
    mask: true,
    opacityScale: 1.45,
    maskGamma: 2,
    ring: 0.34,
    ring2: 0.2,
    arc: 0.8,
    box: 0.3,
    sweep: 0.05,
    sweepEdge: 0.7,
    particles: 0.45,
  },
};

const mount = document.querySelector("[data-hero-canvas]");
if (mount) init();

function init() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x06080b, 0.055);

  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 60);
  camera.position.set(0.15, 0.35, 7.4);
  camera.lookAt(0, 0, 0);

  const group = new THREE.Group();
  group.rotation.set(-0.12, 0.55, 0.02);
  scene.add(group);

  const geo = new THREE.PlaneGeometry(1, 1);
  const slices = [];
  const accentMats = [];

  const makeTexture = (z) => {
    const c = sliceCanvas(HERO_TEX, z, { detail: 1, noise: 0.045, seed: 11 });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    // a second view of the same canvas, sampled raw: used as the day-mode
    // alpha mask, where the *uncrushed* brightness makes a legible drawing
    const mask = new THREE.CanvasTexture(c);
    mask.colorSpace = THREE.NoColorSpace;
    mask.anisotropy = 4;
    return { tex, mask };
  };

  for (let i = 0; i < N_SLICES; i++) {
    const z = i / (N_SLICES - 1);
    const { rx, ry } = brainProfile(z);
    const { tex, mask } = makeTexture(z);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
      side: THREE.DoubleSide,
      color: new THREE.Color(0.85, 0.9, 0.92),
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.set(rx * 2 * 3.05, ry * 2 * 3.05, 1);
    mesh.position.y = (z - 0.5) * VOL_H;
    mesh.renderOrder = i;
    group.add(mesh);
    slices.push({ mesh, mat, tex, mask, z, index: i + 1 });
  }

  const teal = new THREE.Color(0x5cf2d0);

  // scanner rings
  const ringMat = new THREE.MeshBasicMaterial({
    color: teal, transparent: true, opacity: 0.22,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  accentMats.push(ringMat);
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.012, 8, 160), ringMat);
  ring1.position.z = -0.4;
  group.add(ring1);

  const ring2Mat = new THREE.MeshBasicMaterial({
    color: teal, transparent: true, opacity: 0.14,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  accentMats.push(ring2Mat);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.004, 6, 160), ring2Mat);
  ring2.position.z = -0.4;
  group.add(ring2);

  // traveling acquisition arc
  const arcMat = new THREE.MeshBasicMaterial({
    color: teal, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  accentMats.push(arcMat);
  const arc = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.02, 8, 64, 0.9), arcMat);
  arc.position.z = -0.4;
  group.add(arc);

  // field-of-view cage
  const boxMat = new THREE.LineBasicMaterial({ color: 0x5cf2d0, transparent: true, opacity: 0.16 });
  accentMats.push(boxMat);
  const box = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(3.4, VOL_H + 0.5, 3.7)),
    boxMat
  );
  group.add(box);

  // sweep plane — the "active" slice highlight
  const sweepMat = new THREE.MeshBasicMaterial({
    color: teal, transparent: true, opacity: 0.045,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  accentMats.push(sweepMat);
  const sweep = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.7), sweepMat);
  sweep.rotation.x = -Math.PI / 2;
  group.add(sweep);

  const sweepEdgeMat = new THREE.LineBasicMaterial({
    color: 0x5cf2d0, transparent: true, opacity: 0.65,
    blending: THREE.AdditiveBlending,
  });
  accentMats.push(sweepEdgeMat);
  const sweepEdge = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(3.5, 3.8)),
    sweepEdgeMat
  );
  sweepEdge.rotation.x = -Math.PI / 2;
  group.add(sweepEdge);

  // drifting field particles
  const pCount = 340;
  const pPos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 2.4 + Math.random() * 2.6;
    pPos[i * 3] = Math.cos(a) * r;
    pPos[i * 3 + 1] = (Math.random() - 0.5) * 5;
    pPos[i * 3 + 2] = Math.sin(a) * r;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  const particleMat = new THREE.PointsMaterial({
    color: 0x9ef7e4, size: 0.02, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  const particles = new THREE.Points(pGeo, particleMat);
  scene.add(particles);

  /* ---------- day / night ---------- */

  let theme = THEMES.dark;

  function applyTheme(next) {
    theme = next;
    scene.fog.color.set(next.fog);

    for (const s of slices) {
      if (next.mask) {
        // anatomy becomes a mask: no black plate, just translucent ink
        s.mat.map = null;
        s.mat.alphaMap = s.mask;
      } else {
        s.mat.map = s.tex;
        s.mat.alphaMap = null;
      }
      s.mat.color.copy(next.slice);
      s.mat.needsUpdate = true;
    }

    for (const m of accentMats) {
      m.color.copy(next.accent);
      m.blending = next.blending;
    }

    ringMat.opacity = next.ring;
    ring2Mat.opacity = next.ring2;
    arcMat.opacity = next.arc;
    boxMat.opacity = next.box;
    sweepMat.opacity = next.sweep;
    sweepEdgeMat.opacity = next.sweepEdge;

    particleMat.color.copy(next.dust);
    particleMat.blending = next.blending;
    particleMat.opacity = next.particles;
  }

  const themeName = () =>
    document.documentElement.dataset.theme === "light" ? "light" : "dark";

  applyTheme(THEMES[themeName()]);
  document.addEventListener("themechange", () => applyTheme(THEMES[themeName()]));

  /* ---------- the real volume ----------
   * The stack above is a procedural phantom, drawn while the page loads.
   * Once the MRI volume is available every plane is swapped, in place, for
   * the matching slice of the MGE acquisition. If the volume cannot be
   * loaded, the phantom simply stays. */
  const readSliceTotal = document.querySelector("[data-readout-slice-total]");

  loadVolume()
    .then((vol) =>
      Promise.all(
        slices.map(async (s, i) => {
          const img = await loadImage(vol.heroUrl(i));
          s.tex.image = sliceToCanvas(img, HERO_TEX);
          s.tex.needsUpdate = true;
          s.mask.image = sliceToMaskCanvas(img, HERO_TEX, THEMES.light.maskGamma);
          s.mask.needsUpdate = true;
          s.mesh.scale.set(HERO_PLANE, HERO_PLANE, 1);
          s.index = vol.meta.hero.indices[i];
        })
      ).then(() => {
        if (readSliceTotal) readSliceTotal.textContent = `/${vol.meta.stack.count}`;
      })
    )
    .catch(() => {
      /* keep the procedural stack */
    });

  // composer
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.75, 0.28
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // interaction
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener("pointermove", (e) => {
    mouse.tx = (e.clientX / innerWidth) * 2 - 1;
    mouse.ty = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  let scrollY = 0;
  addEventListener("scroll", () => { scrollY = window.scrollY; }, { passive: true });

  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
  });

  const readout = document.querySelector("[data-readout]");
  const heroEl = document.querySelector(".hero");
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.01 })
    .observe(heroEl);

  const readSlice = document.querySelector("[data-readout-slice]");
  let lastRead = -1;

  const clock = new THREE.Clock();
  let t = reduced ? 1.4 : 0;

  function frame() {
    requestAnimationFrame(frame);
    if (document.hidden || !visible) return;

    const dt = Math.min(clock.getDelta(), 0.05);
    if (!reduced) t += dt;

    // triangle-wave sweep: top → bottom → top
    const period = 9;
    const ph = (t % period) / period;
    const tri = ph < 0.5 ? ph * 2 : 2 - ph * 2;
    const sweepY = (tri - 0.5) * (VOL_H + 0.35);

    sweep.position.y = sweepY;
    sweepEdge.position.y = sweepY;
    arc.rotation.z = -t * 0.9;

    let nearestIdx = 0, nearestD = 1e9;
    for (let i = 0; i < slices.length; i++) {
      const s = slices[i];
      const d = Math.abs(s.mesh.position.y - sweepY);
      if (d < nearestD) { nearestD = d; nearestIdx = i; }
      const focus = Math.max(0, 1 - d / 1.15);
      const op = Math.min(1, (0.055 + Math.pow(focus, 1.6) * 0.62) * theme.opacityScale);
      s.mat.opacity += (op - s.mat.opacity) * Math.min(1, dt * 7);
      const tint = Math.pow(focus, 2);
      const base = theme.slice;
      const accent = theme.accent;
      s.mat.color.setRGB(
        base.r + (accent.r - base.r) * tint,
        base.g + (accent.g - base.g) * tint,
        base.b + (accent.b - base.b) * tint
      );
    }

    if (readSlice && nearestIdx !== lastRead) {
      lastRead = nearestIdx;
      readSlice.textContent = String(slices[nearestIdx].index).padStart(3, "0");
    }

    // motion
    mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 3);
    mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 3);

    if (!reduced) {
      group.rotation.y = 0.55 + t * 0.075 + mouse.x * 0.28;
      group.rotation.x = -0.12 + mouse.y * 0.1 + scrollY * 0.00035;
      particles.rotation.y = t * 0.02;
    }

    const fade = Math.max(0, 1 - scrollY / (innerHeight * 0.85));
    mount.style.opacity = String(0.15 + fade * 0.85);

    camera.position.x = 0.15 + mouse.x * 0.35;
    camera.position.y = 0.35 - mouse.y * 0.25;
    camera.lookAt(0, 0, 0);

    composer.render();
  }
  frame();
}
