import { SITE } from "../data/data.js";
import { renderMarkdown } from "./markdown.js";

/* ==========================================================================
   blog.js — the writing index and the post template
   --------------------------------------------------------------------------
   Metadata lives in data/data.js under `blog.posts`; the article body is a
   Markdown file in posts/. blog.html renders the index, post.html?slug=…
   fetches and renders one post. Both pages share this module.
   ========================================================================== */

const BLOG = SITE.blog ?? {};
const FULL_NAME =
  [SITE.identity?.firstName, SITE.identity?.lastName].filter(Boolean).join(" ") || "Blog";

const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

const POSTS = [...(BLOG.posts ?? [])].sort((a, b) => dateValue(b.date) - dateValue(a.date));

function dateValue(value) {
  const t = Date.parse(value);
  return Number.isNaN(t) ? 0 : t;
}

function formatDate(value) {
  const t = Date.parse(value);
  if (Number.isNaN(t)) return value ?? "";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(t);
}

function readingTime(markdown) {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~|=-]+/g, " ");
  const words = plain.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

async function loadPost(post) {
  const file = post.file || `${post.slug}.md`;
  const res = await fetch(`posts/${file}`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Could not load posts/${file} (${res.status})`);
  const markdown = await res.text();
  return {
    ...post,
    markdown,
    html: renderMarkdown(markdown),
    minutes: readingTime(markdown),
  };
}

function setNamedMeta(name, content) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setPropertyMeta(property, content) {
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/* ---------- index ---------- */

function postRowHTML(post, i) {
  const tags = (post.tags ?? []).map((t) => `<span class="tag">${esc(t)}</span>`).join("");
  const minutes = post.minutes ? `${post.minutes} min read` : "";

  return `<a class="post-row rv" href="post.html?slug=${encodeURIComponent(post.slug)}" data-tags="${esc(
    (post.tags ?? []).join("|")
  )}" style="--d:${Math.min(i * 0.06, 0.3).toFixed(2)}s">
    <span class="post-date mono">${esc(formatDate(post.date))}</span>
    <span class="post-main">
      <span class="post-title">${esc(post.title)}</span>
      <span class="post-excerpt">${esc(post.excerpt ?? "")}</span>
      ${tags ? `<span class="post-tags">${tags}</span>` : ""}
    </span>
    <span class="post-side mono">${esc(minutes)}<span class="post-arrow" aria-hidden="true">→</span></span>
  </a>`;
}

async function initIndex(listEl) {
  const tagBox = document.querySelector("[data-blog-tags]");
  const countEl = document.querySelector("[data-blog-count]");
  const emptyEl = document.querySelector("[data-blog-empty]");
  const filtersEl = document.querySelector("[data-blog-filters]");
  const description = BLOG.sub || `Writing and notes from ${FULL_NAME}.`;

  document.title = `Writing — ${FULL_NAME}`;
  setNamedMeta("description", description);
  setPropertyMeta("og:title", `Writing — ${FULL_NAME}`);
  setPropertyMeta("og:description", description);
  setPropertyMeta("og:type", "website");

  if (!POSTS.length) {
    listEl.innerHTML = "";
    if (filtersEl) filtersEl.hidden = true;
    if (tagBox) tagBox.hidden = true;
    if (countEl) countEl.textContent = "00 / 00";
    if (emptyEl) {
      emptyEl.hidden = false;
      emptyEl.classList.add("in");
    }
    return;
  }

  if (emptyEl) emptyEl.hidden = true;

  const loaded = await Promise.all(
    POSTS.map(async (post) => {
      try {
        return await loadPost(post);
      } catch {
        return { ...post, minutes: null };
      }
    })
  );

  const tags = [...new Set(POSTS.flatMap((post) => post.tags ?? []))];
  const requested = new URLSearchParams(location.search).get("tag");
  let activeTag = requested && tags.includes(requested) ? requested : "all";

  listEl.innerHTML = loaded.map(postRowHTML).join("");

  function applyFilter() {
    let shown = 0;
    listEl.querySelectorAll(".post-row").forEach((row) => {
      const rowTags = (row.dataset.tags || "").split("|").filter(Boolean);
      const ok = activeTag === "all" || rowTags.includes(activeTag);
      row.hidden = !ok;
      if (ok) shown++;
    });
    if (countEl) {
      countEl.textContent = `${String(shown).padStart(2, "0")} / ${POSTS.length}`;
    }
  }

  if (tagBox) {
    tagBox.innerHTML = ["all", ...tags]
      .map(
        (tag) =>
          `<button class="chip${tag === activeTag ? " active" : ""}" type="button" aria-pressed="${
            tag === activeTag
          }" data-tag="${esc(tag)}">${esc(tag === "all" ? "All" : tag)}</button>`
      )
      .join("");
    tagBox.hidden = false;

    tagBox.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      activeTag = btn.dataset.tag;
      tagBox.querySelectorAll(".chip").forEach((chip) => {
        const active = chip === btn;
        chip.classList.toggle("active", active);
        chip.setAttribute("aria-pressed", String(active));
      });
      const url = new URL(location.href);
      if (activeTag === "all") url.searchParams.delete("tag");
      else url.searchParams.set("tag", activeTag);
      history.replaceState(null, "", url.href);
      applyFilter();
    });
  }

  applyFilter();
}

/* ---------- post template ---------- */

function postElements() {
  return {
    kicker: document.querySelector("[data-post-kicker]"),
    title: document.querySelector("[data-post-title]"),
    meta: document.querySelector("[data-post-meta]"),
    date: document.querySelector("[data-post-date]"),
    read: document.querySelector("[data-post-read]"),
    tags: document.querySelector("[data-post-tags]"),
    readout: document.querySelector("[data-post-readout]"),
    body: document.querySelector("[data-post-body]"),
    nav: document.querySelector("[data-post-nav]"),
  };
}

function renderPostNav(index, container) {
  if (!container) return;

  const newer = POSTS[index - 1];
  const older = POSTS[index + 1];

  const item = (post, dir, label) =>
    post
      ? `<a class="post-nav-link ${dir}" href="post.html?slug=${encodeURIComponent(post.slug)}">
           <span class="mono">${label}</span>
           <span class="post-nav-title">${esc(post.title)}</span>
         </a>`
      : "";

  const html = item(newer, "newer", "← Newer") + item(older, "older", "Older →");
  container.innerHTML = html;
  container.hidden = !html;
}

function renderPostHeader(meta, el) {
  if (el.kicker) el.kicker.textContent = BLOG.kicker || "Writing";
  if (el.title) el.title.textContent = meta.title || "Untitled";
  if (el.meta) el.meta.hidden = false;
  if (el.date) el.date.textContent = formatDate(meta.date);

  if (el.tags) {
    const tags = meta.tags ?? [];
    el.tags.innerHTML = tags
      .map(
        (tag) =>
          `<a class="tag" href="blog.html?tag=${encodeURIComponent(tag)}">${esc(tag)}</a>`
      )
      .join("");
    el.tags.hidden = !tags.length;
  }

  if (el.readout) {
    const rows = meta.mri ? meta.readout ?? [] : [];
    el.readout.innerHTML = rows
      .map(
        (row) =>
          `<span>${esc(row.label)} <b>${esc(row.value)}</b>${
            row.unit ? `<span>${esc(row.unit)}</span>` : ""
          }</span>`
      )
      .join("");
    el.readout.hidden = !rows.length;
  }
}

function renderNotFound(el, message) {
  document.body.classList.remove("post-mri");
  if (el.kicker) el.kicker.textContent = BLOG.kicker || "Writing";
  if (el.title) el.title.textContent = "Post not found";
  if (el.meta) el.meta.hidden = true;
  if (el.date) el.date.textContent = "";
  if (el.read) el.read.textContent = "";
  if (el.tags) {
    el.tags.innerHTML = "";
    el.tags.hidden = true;
  }
  if (el.readout) {
    el.readout.innerHTML = "";
    el.readout.hidden = true;
  }
  if (el.nav) {
    el.nav.innerHTML = "";
    el.nav.hidden = true;
  }
  if (el.body) {
    el.body.innerHTML = `<p>${esc(message)}</p>
      <p>Try the <a href="blog.html">index of all writing</a> instead.</p>`;
  }
  document.title = `Post not found — ${FULL_NAME}`;
  setNamedMeta("description", "That post could not be found.");
  setPropertyMeta("og:title", "Post not found");
  setPropertyMeta("og:description", "That post could not be found.");
  setPropertyMeta("og:type", "website");
}

async function initPost() {
  const el = postElements();
  const slug = new URLSearchParams(location.search).get("slug");
  const index = POSTS.findIndex((post) => post.slug === slug);

  if (index === -1) {
    renderNotFound(
      el,
      slug
        ? `Nothing is filed under “${slug}”. It may have been renamed or never sampled.`
        : "No post was requested."
    );
    return;
  }

  const meta = POSTS[index];
  document.body.classList.toggle("post-mri", !!meta.mri);
  renderPostHeader(meta, el);
  renderPostNav(index, el.nav);

  const description = meta.excerpt || `${meta.title} — writing by ${FULL_NAME}.`;
  document.title = `${meta.title} — ${FULL_NAME}`;
  setNamedMeta("description", description);
  setPropertyMeta("og:description", description);
  setPropertyMeta("og:title", meta.title);
  setPropertyMeta("og:type", "article");

  try {
    const post = await loadPost(meta);
    if (el.read) el.read.textContent = `${post.minutes} min read`;
    if (el.body) el.body.innerHTML = post.html;
  } catch {
    if (el.read) el.read.textContent = "";
    if (el.body) {
      el.body.innerHTML = `<p>This post's Markdown file could not be loaded. Check that
        <code>posts/${esc(meta.file || `${meta.slug}.md`)}</code> exists and that the site
        is being served over HTTP.</p>`;
    }
  }
}

/* ---------- go ---------- */

const listEl = document.querySelector("[data-blog-list]");
if (listEl) initIndex(listEl);

if (document.querySelector("[data-post]")) initPost();
