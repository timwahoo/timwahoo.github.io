import { SITE } from "../data/data.js";

/* ==========================================================================
   personalize.js — turns data/data.js into the visible website
   --------------------------------------------------------------------------
   Two hooks are used by the markup:

     data-bind="path"            → textContent   = SITE value at path
     data-bind="path|html"       → innerHTML     = SITE value at path
     data-bind="path|href"       → href attribute
     data-bind="path|content"    → content attribute (meta tags)
     data-bind="path|src"        → src attribute

      data-render="type"          → fills the element with a generated list
      data-render="type:path"     → …reading the list from that path

      data-feature="name"         → removes the element when features[name]
                                    is false in data/data.js

      data-require="path"         → removes the element when the data at that
                                    path is missing or empty, so a section
                                    disappears instead of rendering hollow
                                    (space-separated = all must be non-empty)
    ========================================================================== */

/* ---------- data helpers ---------- */

const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

function normalize(site) {
  const s = { ...site };
  s.identity = { ...site.identity };
  s.identity.fullName = `${s.identity.firstName ?? ""} ${s.identity.lastName ?? ""}`.trim();

  s.meta = { ...site.meta };
  s.meta.title = s.meta.title || [s.identity.fullName, s.identity.role].filter(Boolean).join(" — ");
  s.meta.description =
    s.meta.description ||
    [s.identity.fullName, s.identity.role, s.identity.tagline].filter(Boolean).join(" — ");
  s.meta.ogTitle = s.meta.ogTitle || s.identity.fullName;
  s.meta.ogDescription = s.meta.ogDescription || s.meta.description;
  s.meta.title = s.meta.title || "Personal site";

  s.links = site.links ?? [];
  s.features = site.features ?? {};
  return s;
}

const DATA = normalize(SITE);

function get(path) {
  if (!path) return undefined;
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), DATA);
}

/* ---------- document metadata ---------- */

function applyMeta() {
  document.title = DATA.meta.title;

  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", DATA.meta.description);

  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute("content", DATA.meta.ogTitle);

  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute("content", DATA.meta.ogDescription);
}

/* ---------- string bindings ---------- */

function applyBindings() {
  document.querySelectorAll("[data-bind]").forEach((el) => {
    el.dataset.bind
      .trim()
      .split(/\s+/)
      .forEach((token) => {
        const [path, mode] = token.split("|");
        const value = get(path);
        if (value == null) return;

        if (mode === "html") el.innerHTML = value;
        else if (mode) el.setAttribute(mode, value);
        else el.textContent = value;
      });
  });
}

/* ---------- optional blocks ---------- */

function applyFeatures() {
  document.querySelectorAll("[data-feature]").forEach((el) => {
    if (DATA.features[el.dataset.feature] === false) el.remove();
  });
}

/* ---------- blocks that need data to exist ---------- */

function isEmpty(value) {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

function applyRequirements() {
  document.querySelectorAll("[data-require]").forEach((el) => {
    const paths = el.dataset.require.trim().split(/\s+/);
    if (paths.some((p) => isEmpty(get(p)))) el.remove();
  });
}

/* ---------- list renderers ---------- */

const delay = (i, step) => ` style="--d:${(i * step).toFixed(2)}s"`;

const RENDERERS = {
  /* nav bar links */
  nav: {
    path: "nav.items",
    fn: (items) =>
      items
        .map(
          (i) =>
            `<a href="${esc(i.href)}"${i.page ? ` data-nav="${esc(i.page)}"` : ""}>${esc(
              i.label
            )}</a>`
        )
        .join(""),
  },

  /* footer columns */
  footerPages: {
    path: "nav.items",
    fn: (items) =>
      items.map((i) => `<li><a href="${esc(i.href)}">${esc(i.label)}</a></li>`).join(""),
  },

  footerLinks: {
    path: "links",
    fn: (links) =>
      links
        .filter((l) => l.showInFooter !== false)
        .map((l) => `<li><a href="${esc(l.href ?? "#")}">${esc(l.label)}</a></li>`)
        .join(""),
  },

  /* hero — animated name lines */
  heroName: {
    fn: () => {
      const lines =
        DATA.identity.nameLines ?? [
          { text: DATA.identity.firstName },
          { text: DATA.identity.lastName, italic: true },
        ];
      return lines
        .map(
          (l) =>
            `<span class="ln"><span>${
              l.italic ? `<em>${esc(l.text)}</em>` : esc(l.text)
            }</span></span>`
        )
        .join("");
    },
  },

  /* hero — call to action buttons */
  heroActions: {
    path: "hero.actions",
    fn: (actions) =>
      actions
        .map(
          (a) =>
            `<a class="btn btn-${a.style === "ghost" ? "ghost" : "solid"}" href="${esc(
              a.href
            )}">${esc(a.label)} <span class="arr">→</span></a>`
        )
        .join(""),
  },

  /* hero — instrument readout */
  readout: {
    path: "hero.readout",
    fn: (rows) =>
      rows
        .map((r) => {
          const attr = r.attr ? ` ${r.attr}` : "";
          const unit = r.unit ? `<span${r.unitAttr ? ` ${r.unitAttr}` : ""}>${esc(r.unit)}</span>` : "";
          return `<span>${esc(r.label)} <b${attr}>${esc(r.value)}</b>${unit}</span>`;
        })
        .join(""),
  },

  /* scrolling keyword strip — duplicated so the loop is seamless */
  marquee: {
    path: "marquee",
    fn: (words) => {
      const one = words.map((w) => `<span>${esc(w)}</span>`).join("");
      return one + one;
    },
  },

  /* home — counters */
  stats: {
    path: "home.about.stats",
    fn: (stats) =>
      stats
        .map(
          (s) =>
            `<div class="stat"><b>${esc(s.value)}${
              s.suffix ? `<sup>${esc(s.suffix)}</sup>` : ""
            }</b><span>${esc(s.label)}</span></div>`
        )
        .join(""),
  },

  /* a stack of paragraphs */
  paragraphs: {
    fn: (paras) => paras.map((p) => `<p>${p}</p>`).join(""),
  },

  /* home — research direction rows */
  directions: {
    path: "home.directions.items",
    fn: (items) =>
      items
        .map(
          (d, i) =>
            `<a class="theme-row rv" href="${esc(d.href ?? "#")}"${delay(i, 0.1)}>
              <span class="t-idx">${esc(d.idx)}</span>
              <h3>${esc(d.title)}</h3>
              <p>${esc(d.body)}</p>
              <span class="t-arr">↗</span>
            </a>`
        )
        .join(""),
  },

  /* home — selected work cards */
  work: {
    path: "home.work.items",
    fn: (items) =>
      items
        .map(
          (w, i) =>
            `<a class="card rv" href="${esc(w.href ?? "#")}"${delay(i, 0.1)}>
              <div class="card-top">
                <span class="card-idx">${esc(w.idx)}</span>
                <span class="card-status">${esc(w.status)}</span>
              </div>
              <h3>${esc(w.title)}</h3>
              <p>${esc(w.body)}</p>
              <div class="card-tags">${(w.tags ?? [])
                .map((t) => `<span class="tag">${esc(t)}</span>`)
                .join("")}</div>
              <span class="card-arrow">→</span>
            </a>`
        )
        .join(""),
  },

  /* research — one block per thread */
  threads: {
    path: "research.threads",
    fn: (threads) =>
      threads
        .map((t) => {
          const figure = t.figure
            ? `<figure class="r-figure rv" style="--d:0.15s">
                <canvas data-mini="${esc(t.figure.kind)}"></canvas>
                <figcaption>${t.figure.caption ?? ""}</figcaption>
              </figure>`
            : "";
          return `<div class="rblock${t.flip ? " flip" : ""}" id="${esc(t.id)}">
              <div class="rv">
                <span class="r-idx">${esc(t.idx)}</span>
                <h3>${esc(t.title)}</h3>
                ${(t.paragraphs ?? []).map((p) => `<p>${p}</p>`).join("")}
                <ul class="rlist">${(t.points ?? [])
                  .map((p) => `<li>${esc(p)}</li>`)
                  .join("")}</ul>
              </div>
              ${figure}
            </div>`;
        })
        .join(""),
  },

  /* research — tools we ship */
  tools: {
    path: "research.tools.items",
    fn: (items) =>
      items
        .map(
          (t, i) =>
            `<a class="tool rv" href="${esc(t.href ?? "#")}"${delay(i, 0.1)}>
              <span class="t-name">${esc(t.name)}</span>
              <p class="t-desc">${esc(t.desc)}</p>
              <span class="t-meta"><span>${esc(t.meta)}</span><span class="t-go">${esc(
                t.cta
              )}</span></span>
            </a>`
        )
        .join(""),
  },

  /* about — timeline */
  timeline: {
    path: "about.timeline.items",
    fn: (items) =>
      items
        .map(
          (t, i) =>
            `<div class="tl-row rv"${delay(i, 0.06)}>
              <div class="tl-year">${esc(t.year)}</div>
              <div>
                <div class="tl-role">${esc(t.role)}</div>
                <div class="tl-where">${esc(t.where)}</div>
              </div>
            </div>`
        )
        .join(""),
  },

  /* about — toolkit tags */
  toolkit: {
    path: "about.toolkit",
    fn: (tags) => tags.map((t) => `<span class="tag">${esc(t)}</span>`).join(""),
  },

  /* about — contact list */
  contact: {
    path: "links",
    fn: (links) =>
      links
        .map(
          (l) =>
            `<a href="${esc(l.href ?? "#")}"${l.href ? "" : ' aria-disabled="true"'}>${esc(
              l.label
            )} <span class="c-val">${esc(l.value)}</span></a>`
        )
        .join(""),
  },

  /* publications — header buttons */
  pageLinks: {
    path: "publications.links",
    fn: (links) =>
      links
        .map(
          (l) =>
            `<a class="btn btn-ghost" href="${esc(l.href)}" rel="me noopener">${esc(
              l.label
            )} <span class="arr">↗</span></a>`
        )
        .join(""),
  },
};

/* ---------- list rendering ---------- */

function renderLists() {
  document.querySelectorAll("[data-render]").forEach((el) => {
    const [type, path] = el.dataset.render.split(":");
    const renderer = RENDERERS[type];
    if (!renderer) return;

    const source = path || renderer.path;
    const value = source ? get(source) : undefined;
    if (source && value == null) return;

    const list = value == null ? [] : Array.isArray(value) ? value : [value];
    el.innerHTML = renderer.fn(list);
  });
}

/* ---------- go ---------- */

applyMeta();
applyFeatures();
applyRequirements();
applyBindings();
renderLists();
