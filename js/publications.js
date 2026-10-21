import { SITE } from "../data/data.js";

/* The publication data lives in data/data.js — edit it there. */

export const PUBS = SITE.publications?.items ?? [];
export const TOPICS = SITE.publications?.topics ?? [];

function bibtex(p) {
  const surname = (SITE.identity?.lastName || "anon").toLowerCase().replace(/[^a-z]/g, "");
  const key = `${surname}${p.year}${p.title.split(/[\s:]+/)[0].toLowerCase().replace(/[^a-z]/g, "")}`;
  const type = p.short === "ISMRM" || p.short === "MIDL" ? "inproceedings" : "article";
  const fields =
    type === "article"
      ? `  journal = {${p.venue}},\n  volume  = {},\n  pages   = {},`
      : `  booktitle = {${p.venue}},`;
  return `@${type}{${key},
  title     = {${p.title}},
  author    = {${p.authors}},
${fields}
  year      = {${p.year}}
}`;
}

function rowHTML(p, i) {
  const bib = bibtex(p);
  const href = p.url || "#";
  const noop = p.url ? "" : " data-noop";
  return `
    <article class="pub rv" data-topic="${p.topic}" data-year="${p.year}" style="--d:${Math.min(i * 0.04, 0.3)}s">
      <div class="pub-year">${p.year}</div>
      <div>
        <div class="pub-title">
          <a href="${href}"${noop} aria-label="${p.title.replace(/"/g, "&quot;")}">${p.title}</a>
          <span class="pub-meta">
            <span class="venue">${p.short}</span> · ${p.authors}${p.note ? ` · <span style="color:var(--acc-dim)">${p.note}</span>` : ""}
          </span>
        </div>
      </div>
      <div class="pub-side">
        <button class="mini-btn" data-bib>BibTeX</button>
        <a class="mini-btn" href="${href}"${noop}>PDF</a>
      </div>
      <div class="pub-bib"><pre>${bib.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]))}</pre></div>
    </article>`;
}

export function renderList(container, pubs) {
  container.innerHTML = pubs.map(rowHTML).join("");
  container.querySelectorAll("[data-bib]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = btn.closest(".pub").querySelector(".pub-bib");
      const open = panel.classList.toggle("open");
      btn.textContent = open ? "Hide" : "BibTeX";
      if (open) {
        const pre = panel.querySelector("pre");
        navigator.clipboard?.writeText(pre.textContent).catch(() => {});
      }
    });
  });
  container.querySelectorAll("[data-noop]").forEach((a) =>
    a.addEventListener("click", (e) => e.preventDefault())
  );
}

/* full list page */
const fullList = document.querySelector("[data-pub-list]");
if (fullList) {
  renderList(fullList, PUBS);

  const chipBox = document.querySelector("[data-filters]");
  const count = document.querySelector("[data-pub-count]");
  if (chipBox) chipBox.innerHTML = TOPICS.map(
    (t, i) => `<button class="chip${i === 0 ? " active" : ""}" data-topic="${t.id}">${t.label}</button>`
  ).join("");

  let topic = "all";
  let year = "all";

  const yearBox = document.querySelector("[data-year-filter]");
  const years = ["all", ...[...new Set(PUBS.map((p) => p.year))].sort((a, b) => b - a)];
  if (yearBox) {
    yearBox.innerHTML = years
      .map(
        (y) =>
          `<button class="chip${y === "all" ? " active" : ""}" data-year="${y}">${y === "all" ? "Any year" : y}</button>`
      )
      .join("");
  }

  function apply() {
    let shown = 0;
    fullList.querySelectorAll(".pub").forEach((el) => {
      const okT = topic === "all" || el.dataset.topic === topic;
      const okY = year === "all" || el.dataset.year === year;
      const ok = okT && okY;
      el.classList.toggle("hide", !ok);
      if (ok) shown++;
    });
    if (count) count.textContent = `${String(shown).padStart(2, "0")} / ${PUBS.length}`;
  }

  function wireChips(box, key, set) {
    box.addEventListener("click", (e) => {
      const b = e.target.closest(".chip");
      if (!b) return;
      box.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === b));
      set(b.dataset[key]);
      apply();
    });
  }

  if (chipBox) wireChips(chipBox, "topic", (v) => (topic = v));
  if (yearBox) wireChips(yearBox, "year", (v) => (year = v));

  apply();
}

/* no publications yet — say so instead of showing an empty list */
const empty = document.querySelector("[data-pub-empty]");
if (empty) empty.hidden = PUBS.length > 0;

/* home preview */
const preview = document.querySelector("[data-pub-preview]");
if (preview) {
  renderList(preview, PUBS.slice(0, SITE.publications?.previewCount ?? 5));
}
