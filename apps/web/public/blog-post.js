(function () {
  var parts = location.pathname.replace(/\/+$/, "").split("/");
  var slug = parts[parts.length - 1];
  if (!slug || slug === "blog" || slug === "post") {
    document.getElementById("post").innerHTML =
      '<p>Post not found. <a href="/blog/">Back</a></p>';
    return;
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
      var paras = (p.body || "")
        .split(/\n\s*\n/)
        .map(function (t) {
          return "<p>" + t.replace(/</g, "&lt;").replace(/\n/g, "<br>") + "</p>";
        })
        .join("");
      document.getElementById("post").innerHTML =
        '<p><a href="/blog/">← Blog</a></p>' +
        "<h1>" +
        p.title.replace(/</g, "&lt;") +
        "</h1>" +
        (p.description
          ? '<p class="lede">' + p.description.replace(/</g, "&lt;") + "</p>"
          : "") +
        paras;
    })
    .catch(function () {
      document.getElementById("post").innerHTML =
        '<p>Post not found. <a href="/blog/">Back</a></p>';
    });
})();
