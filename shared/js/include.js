async function loadPartial(selector, path) {
    const host = document.querySelector(selector);
    if (!host) return;
  
    try {
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load partial: ${path}`);
      host.innerHTML = await res.text();
    } catch (err) {
      console.error(err);
    }
  }
  
  function markActiveNav() {
    const page = document.body.dataset.page;
    if (!page) return;
  
    const link = document.querySelector(`[data-nav-link="${page}"]`);
    if (link) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
  }
  
  function ensureTransitionLayer() {
    if (document.querySelector(".page-transition")) return;
  
    const layer = document.createElement("div");
    layer.className = "page-transition";
    layer.setAttribute("aria-hidden", "true");
    document.body.appendChild(layer);
  }
  
  function isInternalNavigation(link) {
    if (!link) return false;
    if (link.target && link.target !== "_self") return false;
    if (link.hasAttribute("download")) return false;
  
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#")) return false;
  
    const url = new URL(link.href, window.location.href);
    return url.origin === window.location.origin;
  }
  
  function initPageTransitions() {
    ensureTransitionLayer();
  
    // Wipe away on page load
    document.body.classList.add("is-loading");
    window.addEventListener("load", () => {
      requestAnimationFrame(() => {
        document.body.classList.remove("is-loading");
      });
    });
  
    // Intercept internal nav clicks
    document.addEventListener("click", (e) => {
      const link = e.target.closest("a");
      if (!isInternalNavigation(link)) return;
  
      const url = new URL(link.href, window.location.href);
  
      // skip same-page exact URL
      if (url.href === window.location.href) return;
  
      // allow modifier-clicks / new tabs
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  
      e.preventDefault();
  
      document.body.classList.add("is-transitioning");
  
      setTimeout(() => {
        window.location.href = url.href;
      }, 300);
    });
  }
  
  document.addEventListener("DOMContentLoaded", async () => {
    const depth = Number(document.body.dataset.depth || "0");
    const prefix = "../".repeat(depth);
  
    await loadPartial("[data-include='header']", `${prefix}partials/header.html`);
    markActiveNav();
    initPageTransitions();
  });