(function () {
  var parts = location.pathname.replace(/\/+$/, "").split("/");
  var slug = parts[parts.length - 1];
  if (!slug || slug === "blog" || slug === "post") {
    document.getElementById("post").innerHTML =
      '<p>Post not found. <a href="/blog/">Back</a></p>';
    return;
  }

  function esc(s) {
    return String(s || "").replace(/</g, "&lt;");
  }

  function slugifyHeading(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  /** Renders CMS / weekly-cron body text: blank-line paragraphs, "##"/"###" headings, "- " lists,
   *  plus a table of contents when there are 3+ H2 sections. Mirrors Docracy's BlogPostDetail
   *  parser (apps/web/src/pages/BlogPostDetail.tsx) so AI-drafted posts render with real structure
   *  instead of one flat wall of paragraphs. */
  function renderBody(body) {
    var lines = String(body || "").replace(/\r\n/g, "\n").split("\n");
    var blocks = [];
    var para = [];
    var listItems = null;

    function flushPara() {
      var text = para.join(" ").trim();
      if (text) blocks.push({ type: "p", text: text });
      para = [];
    }
    function flushList() {
      if (listItems && listItems.length) blocks.push({ type: "list", items: listItems });
      listItems = null;
    }

    lines.forEach(function (raw) {
      var line = raw.replace(/\s+$/, "");
      var trimmed = line.trim();
      if (!trimmed) {
        flushPara();
        flushList();
        return;
      }
      if (trimmed.indexOf("## ") === 0) {
        flushPara();
        flushList();
        blocks.push({ type: "h2", text: trimmed.slice(3).trim() });
        return;
      }
      if (trimmed.indexOf("### ") === 0) {
        flushPara();
        flushList();
        blocks.push({ type: "h3", text: trimmed.slice(4).trim() });
        return;
      }
      if (/^[-*]\s+/.test(trimmed)) {
        flushPara();
        if (!listItems) listItems = [];
        listItems.push(trimmed.replace(/^[-*]\s+/, "").trim());
        return;
      }
      flushList();
      para.push(trimmed);
    });
    flushPara();
    flushList();

    var toc = blocks.filter(function (b) {
      return b.type === "h2";
    });

    var html = "";
    if (toc.length >= 3) {
      html +=
        '<nav class="blog-toc" aria-label="Table of contents"><div class="blog-toc-title">Table of contents</div><ol>' +
        toc
          .map(function (item) {
            return '<li><a href="#' + slugifyHeading(item.text) + '">' + esc(item.text) + "</a></li>";
          })
          .join("") +
        "</ol></nav>";
    }

    html += '<div class="blog-body">';
    blocks.forEach(function (block) {
      if (block.type === "list") {
        html +=
          "<ul>" +
          block.items.map(function (item) { return "<li>" + esc(item) + "</li>"; }).join("") +
          "</ul>";
      } else if (block.type === "h2") {
        html += '<h2 id="' + slugifyHeading(block.text) + '">' + esc(block.text) + "</h2>";
      } else if (block.type === "h3") {
        html += "<h3>" + esc(block.text) + "</h3>";
      } else {
        html += "<p>" + esc(block.text) + "</p>";
      }
    });
    html += "</div>";
    return html;
  }

  fetch("/api/blog/posts/" + encodeURIComponent(slug))
    .then(function (r) {
      if (!r.ok) throw new Error("nf");
      return r.json();
    })
    .then(function (data) {
      var p = data.post;
      document.title = p.title + " — Chasa";
      var canonical = document.getElementById("post-canonical");
      if (canonical) canonical.href = "https://chasa.io/blog/" + slug + "/";
      if (p.description) {
        var desc = document.querySelector('meta[name="description"]');
        if (desc) desc.setAttribute("content", p.description);
      }
      document.getElementById("post").innerHTML =
        '<p><a href="/blog/">← Blog</a></p>' +
        "<h1>" +
        esc(p.title) +
        "</h1>" +
        (p.description ? '<p class="lede">' + esc(p.description) + "</p>" : "") +
        renderBody(p.body);
    })
    .catch(function () {
      document.getElementById("post").innerHTML =
        '<p>Post not found. <a href="/blog/">Back</a></p>';
    });
})();
