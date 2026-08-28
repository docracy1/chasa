document.querySelectorAll("[data-copy-mcp]").forEach(function (btn) {
  btn.addEventListener("click", function () {
    var el = document.getElementById("mcp-url");
    var text = el ? el.textContent.trim() : "https://api.docstoc.io/mcp";
    navigator.clipboard.writeText(text).then(function () {
      btn.textContent = "Copied";
      setTimeout(function () {
        btn.textContent = "Copy";
      }, 1500);
    });
  });
});
document.querySelectorAll("[data-copy-mcp-snippet]").forEach(function (btn) {
  btn.addEventListener("click", function () {
    var id = btn.getAttribute("data-copy-from");
    var label = btn.getAttribute("data-copy-label") || "Copy";
    var el = id ? document.getElementById(id) : null;
    var text = el ? el.textContent.trim() : "";
    if (!text) return;
    navigator.clipboard.writeText(text).then(function () {
      btn.textContent = "Copied";
      setTimeout(function () {
        btn.textContent = label;
      }, 1500);
    });
  });
});
