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

  document.body.classList.add("is-loading");

  window.addEventListener("load", () => {
    requestAnimationFrame(() => {
      document.body.classList.remove("is-loading");
    });
  });

  document.addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (!isInternalNavigation(link)) return;

    const url = new URL(link.href, window.location.href);

    if (url.href === window.location.href) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    e.preventDefault();

    document.body.classList.add("is-transitioning");

    setTimeout(() => {
      window.location.href = url.href;
    }, 250);
  });
}

function preloadPage(url) {
  const existing = document.querySelector(`link[rel="prefetch"][href="${url}"]`);
  if (existing) return;

  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = url;
  document.head.appendChild(link);
}

function initPrefetching() {
  document.addEventListener("mouseover", (e) => {
    const link = e.target.closest("a");
    if (!isInternalNavigation(link)) return;
    preloadPage(link.href);
  });

  document.addEventListener("focusin", (e) => {
    const link = e.target.closest("a");
    if (!isInternalNavigation(link)) return;
    preloadPage(link.href);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initPageTransitions();
  initPrefetching();
});