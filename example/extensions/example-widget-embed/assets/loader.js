// Ship this same guard in the file your script tag points at, and deploy it
// before the embed goes live. Until the script tag is deleted, a store with
// the embed on loads both copies, in either order.
(function () {
  if (window.__exampleWidgetLoaded) return;
  window.__exampleWidgetLoaded = true;

  function start() {
    var root = document.getElementById("example-widget-root");
    if (!root) {
      // Loaded from the old script tag, which has no embed markup.
      root = document.createElement("div");
      root.id = "example-widget-root";
      document.body.appendChild(root);
    }
    var accent = root.getAttribute("data-accent") || "#1a73e8";
    root.style.cssText = "position:fixed;bottom:16px;right:16px;padding:8px 12px;color:#fff;background:" + accent;
    root.textContent = "Example widget";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
