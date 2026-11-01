/* ==========================================================================
   markdown.js — a tiny, dependency-free Markdown renderer
   --------------------------------------------------------------------------
   Supports the subset a personal blog actually needs:

     # headings            **bold**  *italic*  `inline code`
     paragraphs            [links](https://…)  ![images](path.png)
     figures               ![alt](path "Optional caption")
     fenced code blocks    blockquotes  ordered / unordered lists
     horizontal rules

   Raw HTML is escaped and shown as text. The input is treated as trusted
   author content, but escaping keeps a stray < from breaking the page.
   ========================================================================== */

const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

/* Allow normal links and images, but not executable schemes such as
   javascript:. Relative paths, anchors and queries pass through. */
function safeUrl(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  if (/^(https?:|mailto:|tel:)/i.test(value)) return value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return "";
  return value;
}

/* Inline formatting. Runs after the block parser has stripped the block
   markers, so it only has to deal with one paragraph / heading / list item
   at a time. Code, links and images are parked in slots first so the
   emphasis regexes cannot wander into their attributes. */
function inline(raw) {
  let text = esc(raw);
  const slots = [];
  const park = (html) => {
    slots.push(html);
    return `\u0000${slots.length - 1}\u0000`;
  };

  text = text.replace(/`([^`]+)`/g, (_, code) => park(`<code>${code}</code>`));

  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => {
    const safe = safeUrl(src);
    return safe ? park(`<img src="${safe}" alt="${alt}" loading="lazy" />`) : alt;
  });

  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    const safe = safeUrl(href);
    if (!safe) return label;
    const external = /^https?:\/\//i.test(safe);
    const rel = external ? ' target="_blank" rel="noopener"' : "";
    return park(`<a href="${safe}"${rel}>${label}</a>`);
  });

  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  text = text.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  text = text.replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>");

  return text.replace(/\u0000(\d+)\u0000/g, (_, i) => slots[+i]);
}

/* A standalone image line becomes a figure. An optional Markdown title in
   quotes is used as the caption: ![alt](path "Figure 1 — caption"). */
function figureHTML(alt, src, caption = "") {
  const safe = safeUrl(src);
  const altText = esc(alt);
  if (!safe) return `<p>${altText}</p>`;
  const captionHTML = caption ? `<figcaption>${inline(caption)}</figcaption>` : "";
  return `<figure><img src="${esc(safe)}" alt="${altText}" loading="lazy" />${captionHTML}</figure>`;
}

export function renderMarkdown(markdown) {
  const lines = String(markdown ?? "").replace(/\r\n?/g, "\n").replace(/\t/g, "  ").split("\n");
  const out = [];

  let para = [];
  let quote = [];
  let list = null; // { type: "ul" | "ol", items: [] }

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${inline(para.join(" "))}</p>`);
      para = [];
    }
  };

  const flushQuote = () => {
    if (quote.length) {
      out.push(`<blockquote><p>${inline(quote.join(" "))}</p></blockquote>`);
      quote = [];
    }
  };

  const flushList = () => {
    if (list) {
      out.push(
        `<${list.type}>${list.items.map((item) => `<li>${inline(item)}</li>`).join("")}</${list.type}>`
      );
      list = null;
    }
  };

  const flushAll = () => {
    flushPara();
    flushQuote();
    flushList();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const fence = trimmed.match(/^```([\w-]*)\s*$/);
    if (fence) {
      flushAll();
      const lang = fence[1];
      const code = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i].trim())) {
        code.push(lines[i]);
        i++;
      }
      out.push(
        `<pre><code${lang ? ` class="language-${esc(lang)}"` : ""}>${esc(
          code.join("\n")
        )}</code></pre>`
      );
      continue;
    }

    if (!trimmed) {
      flushAll();
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushAll();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2].replace(/\s+#+\s*$/, ""))}</h${level}>`);
      continue;
    }

    if (/^(\*\s*){3,}$/.test(trimmed) || /^(-\s*){3,}$/.test(trimmed) || /^(_\s*){3,}$/.test(trimmed)) {
      flushAll();
      out.push("<hr />");
      continue;
    }

    const quoted = trimmed.match(/^>\s?(.*)$/);
    if (quoted) {
      flushPara();
      flushList();
      quote.push(quoted[1]);
      continue;
    }
    if (quote.length) flushQuote();

    const image = trimmed.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/);
    if (image) {
      flushAll();
      out.push(figureHTML(image[1], image[2], image[3]));
      continue;
    }

    const ul = trimmed.match(/^[-*+]\s+(.*)$/);
    const ol = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      flushPara();
      flushQuote();
      const type = ul ? "ul" : "ol";
      if (list && list.type !== type) flushList();
      if (!list) list = { type, items: [] };
      list.items.push((ul || ol)[1]);
      continue;
    }

    if (list) {
      list.items[list.items.length - 1] += ` ${trimmed}`;
      continue;
    }

    para.push(trimmed);
  }

  flushAll();
  return out.join("\n");
}
