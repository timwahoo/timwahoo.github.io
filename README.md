# Personal academic website

A personal website for an MRI physicist and computational-imaging researcher.
Static, dependency-free to host, and designed to load straight from GitHub Pages.

## Make it yours: one file

**Everything personal lives in [`data/data.js`](data/data.js).** Name, role, bio,
projects, publications, links, timeline, headings, the words on every page — all of
it. The `.html` files only carry structure and styling; `js/personalize.js`
injects the content at runtime.

Open `data/data.js`, edit, reload. Nothing else to touch.

```js
export const SITE = {
  identity: {
    firstName: "Nora",
    lastName: "Lindqvist",
    role: "MRI Physicist & Computational Imaging Researcher",
    ...
  },
  ...
};
```

Useful things to know:

| I want to… | Edit |
| --- | --- |
| Change my name and title | `identity` (the hero splits the name automatically) |
| Rewrite the home page intro | `home.about.paragraphs` |
| Swap my projects | `home.work.items` — add or delete entries |
| Change the research threads | `research.threads` |
| Add a paper | `publications.items` — it appears in the list, the filters, the home preview and the BibTeX automatically |
| Add a link (Scholar, ORCID, GitHub, CV…) | `links` — used by the contact list *and* the footer |
| Rename the navigation | `nav.items` |
| Reword the "page not found" page | `notFound` |
| Hide a block (the lab, the WebGL hero, the portrait, the counters, the marquee) | set it to `false` under `features` |
| Hide the day / night switch | `features.themeToggle` → `false` |

Strings marked `/* html */` accept inline markup (`<strong>`, `<em>`, `<a>`, `<br>`);
everything else is inserted as plain text. Add a `url` to a publication entry to
turn its title and PDF buttons into real links.

## What's inside

| Page | Highlights |
| --- | --- |
| `index.html` | WebGL hero — a volumetric brain stack with an animated acquisition sweep, built with **three.js** (bloom post-processing, additive rings, field-of-view wireframe, drifting particles). |
| `research.html` | **k-space Lab** — a live MRI simulator: a real MGE slice → real FFT → undersampled sampling (Cartesian / radial / spiral) → inverse FFT reconstruction, with acceleration and noise controls and live PSNR. |
| `publications.html` | Data-driven publication list with topic + year filters and one-click BibTeX. |
| `about.html` | A scrubbable "portrait" — a real axial slice of the acquisition you can drag through with the pointer. |
| `404.html` | Self-contained "signal lost outside the FOV" page. |

## Design notes

- **Concept:** MRI is an *inverse problem* — you measure frequencies (k-space) and solve for the
  image. Every interactive element plays on that idea.
- **Type:** Instrument Serif (display) + Inter Tight (body) + JetBrains Mono (technical readouts —
  TR, TE, slice index, PSNR).
- **Palette:** near-black `#06080b`, warm off-white ink, and a single signal-teal `#5cf2d0`.
- **Day / night:** every colour is a token in `css/style.css`, so the whole site flips with one
  attribute on `<html>` — see [Day & night mode](#day--night-mode).
- **No frameworks**: vanilla ES modules, one CSS file, no build step. (The derived MRI assets are
  generated once by a Node script and committed — the site itself is just files.)

## Architecture

```
index.html · research.html · publications.html · about.html · 404.html
data/
  data.js                all site content — the single file you personalize
css/style.css            design system (tokens, components, responsive, a11y)
js/
  personalize.js         injects data/data.js into the markup (data-bind / data-render)
  brain.js               the MRI volume loader + a procedural axial phantom (pure canvas math)
  fft.js                 radix-2 FFT, 1D + 2D, forward & inverse
  hero.js                three.js volumetric hero
  kspacelab.js           interactive k-space simulator
  publications.js        publication list/filter/BibTeX rendering
  site.js                nav, day/night toggle, scroll reveals, portrait scrub, mini figures, toasts
assets/
  favicon.svg
  png_stack/             the source acquisition — 158 axial MGE slices
  mri/                   derived assets (generated) — manifest, hero stack, lab phantom
tools/
  build-mri-assets.mjs   regenerates assets/mri from assets/png_stack
```

### Day & night mode

The site ships with two palettes and a switch in the navigation bar.

| | night (default) | day |
| --- | --- | --- |
| background | `#06080b` | `#f7f5f0` (warm paper) |
| ink | `#eceae4` | `#14181d` |
| accent | `#5cf2d0` | `#0b7a66` (deepened so it stays legible on paper) |

How it works:

- `css/style.css` defines every colour as a custom property. `:root` holds the night palette;
  `html[data-theme="light"]` overrides the same properties with the day palette. Nothing in the
  stylesheet hard-codes a colour, so flipping the attribute repaints the whole site.
- A tiny inline script in each `<head>` sets `document.documentElement.dataset.theme` **before the
  first paint** — from `localStorage` if the visitor chose a mode, otherwise from
  `prefers-color-scheme`. No flash of the wrong mode on the way in.
- `js/site.js` owns the button: it toggles the attribute, remembers the choice under the
  `site-theme` key, keeps following the OS while no explicit choice is stored, and announces a
  `themechange` event on `document` for anything drawn on a canvas.
- `js/hero.js` listens for that event and repaints the WebGL volume: at night the slices glow
  (additive blending, bright anatomy on a black plate); by day the plate is dropped and the
  anatomy becomes an alpha mask, so the stack reads as translucent ink on paper.
- The image viewers (the k-space lab panels, the About portrait) stay dark in both modes — medical
  images are read on black, and the frames keep their borders so they read as screens, not holes.
- `features.themeToggle: false` removes the switch entirely.

Both palettes clear WCAG AA for body text (day: ink 16.4:1, secondary 8.2:1, muted 5.0:1,
accent 4.8:1).

### The MRI volume

The hero, the About portrait and the k-space lab are all driven by one real acquisition:
a skull-stripped, axial **MGE** volume kept in `assets/png_stack/` as 8-bit grayscale PNGs.

| | |
| --- | --- |
| sequence | MGE (magnetization-prepared gradient echo), TE 3 ms, TR 7.2 ms |
| contrast | T1-weighted — white matter bright, CSF dark |
| geometry | 224 × 186 in plane, 1 mm isotropic, 153 usable slices (0023 – 0175) |
| plane | axial, ordered superior → inferior |

`js/brain.js` loads `assets/mri/manifest.json` and then:

- the **hero** swaps each plane of its stack for the matching MRI slice — 44 evenly spaced
  samples of the volume, pre-rendered to `assets/mri/hero/`;
- the **About portrait** scrubs the full-resolution stack one slice at a time, loading lazily
  as you drag, and reports the slice index and the position in millimetres; the slice is shown
  **transposed** (x and y swapped) and flipped vertically, so the frame is portrait-shaped —
  186 wide by 224 tall;
- the **k-space lab** Fourier-transforms a real slice (`assets/mri/lab/phantom.png`).

Because the contrast is T1, the day mode needs no inversion: the slice brightness doubles as
the alpha mask (white matter becomes ink, CSF becomes paper), with a gamma on the mask so the
interior stays legible instead of flooding solid.

If the volume cannot be fetched the site falls back to the procedural phantom in `js/brain.js`
— the pages never look broken.

#### Regenerating the derived assets

`assets/mri/` is generated from `assets/png_stack/`:

```sh
node tools/build-mri-assets.mjs
```

The tool is plain Node with no dependencies: it decodes the source PNGs, resamples them onto a
square canvas (letterboxed, so the anatomy keeps its aspect ratio), writes the hero stack and
the lab phantom as 8-bit grayscale PNGs, and writes the manifest that the site reads. Re-run it
whenever the source stack changes.

### How the content gets in

The markup uses four hooks, all handled by `js/personalize.js`:

```html
<h2 data-bind="home.work.heading"></h2>            <!-- text from data/data.js -->
<h2 data-bind="about.title|html"></h2>              <!-- …or markup from data/data.js -->
<div data-render="directions"></div>                <!-- a generated list -->
<section data-feature="lab">…</section>              <!-- removed when features.lab is false -->
<section data-require="home.work.items">…</section> <!-- removed when the list is empty -->
```

`data-render="type"` fills an element with one of the built-in list renderers
(`nav`, `directions`, `work`, `threads`, `tools`, `timeline`, `toolkit`, `contact`,
`stats`, `readout`, `marquee`, `heroName`, `heroActions`, `pageLinks`,
`footerPages`, `footerLinks`, `paragraphs`). Add a renderer in `js/personalize.js`
if you need a new shape of list.

`data-require="path"` is the safety net for a smaller site: leave a list empty
(`items: []`) and the block that holds it disappears entirely instead of showing a
heading with nothing under it.

## What if I don't have all of this?

The demo persona is loud. If your site is quieter, the blocks collapse on their own:

| My situation | What happens |
| --- | --- |
| No publications yet | `publications.items: []` → the Publications page shows one line of prose, the home-page "recent papers" block and the filter chips disappear |
| No open-source projects | `home.work.items: []` / `research.tools.items: []` → "Selected work" and "Tools we ship" disappear |
| No research threads yet | `research.threads: []` → the section disappears |
| No timeline, no toolkit, no contact links | the matching blocks disappear |
| The WebGL hero is too much | `features.heroCanvas: false` |
| The MRI simulator is not your thing | `features.lab: false` |
| The portrait is not your thing | `features.portrait: false`, or swap the `<canvas>` for an `<img>` |
| The TR/TE readout means nothing to you | `hero.readout: []` → the instrument strip disappears |

Nothing is ever half-rendered: every block either has data behind it or is not in
the DOM at all.

## three.js loading

Loaded from jsDelivr via an import map in `index.html`:

```html
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"
  }
}
</script>
```

No bundling required. Everything else is plain ES modules.

## Run locally

Because the site uses ES modules, serve it over HTTP (opening the file directly won't work):

```sh
python3 -m http.server 8080     # or: npx serve .
# then visit http://localhost:8080
```

## Deploy to GitHub Pages

The site is already at the repo root, so it deploys as-is:

1. Push these files to a repository.
2. **Settings → Pages → Source:** "Deploy from a branch".
3. Branch `main`, folder `/ (root)`. Save.
4. GitHub serves `index.html` at your site URL, and `404.html` handles unknown paths.

If the repo is not at the domain root it still works, since all asset URLs are relative.

## Accessibility & performance

- Respects `prefers-reduced-motion` (hero freezes to a representative frame, autoplay stops).
- Keyboard-focusable controls with visible focus rings; ARIA state on the mobile nav.
- Day and night palettes both clear WCAG AA; the mode is remembered per browser and follows the
  operating system until the visitor picks one.
- Canvas work is capped: pixel ratio ≤ 2, textures cached, rAF paused when the tab is hidden or
  the hero leaves the viewport.
- The hero's MRI stack is 44 pre-rendered 160 × 160 grayscale slices (≈ 310 KB, fetched once and
  cached); the About portrait streams full-resolution slices one at a time as you scrub.
- Degrades gracefully — the k-space lab is a progressive enhancement over readable prose.

Content is rendered client-side, so JavaScript must be enabled (the pages show a short
notice when it isn't). Crawlers that execute JavaScript — including Googlebot — see the
full text.

No build, no dependencies to install, no tracking. Just signals.

## Built with opencode

Built with [opencode](https://opencode.ai) — model `opencode/big-pickle`.