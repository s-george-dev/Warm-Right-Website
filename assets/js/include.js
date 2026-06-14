// include.js - Shared Loader

const WARM_RIGHT_SUPABASE_URL = 'https://axampuprcnauxbbijmmt.supabase.co';
const WARM_RIGHT_SUPABASE_KEY = 'sb_publishable_NFuFkO0tybTuMvYOQekQmA_62araOjM';

function loadScriptOnce(src) {
  if (document.querySelector(`script[src="${src}"]`)) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function initPublicDatabase() {
  if (typeof supabase === 'undefined') {
    await loadScriptOnce('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
  }

  if (!window.db && typeof supabase !== 'undefined') {
    window.db = supabase.createClient(WARM_RIGHT_SUPABASE_URL, WARM_RIGHT_SUPABASE_KEY);
  }
}

function loadHTML(id, file) {
  return fetch(file)
    .then(res => res.text())
    .then(data => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = data;
    });
}

document.addEventListener("DOMContentLoaded", () => {
  const isGitHub = window.location.hostname.includes("github.io");
  const siteRoot = isGitHub ? "/Warm-Right-Website/" : "/";
  const partialsPath = siteRoot + "partials/";

  Promise.all([
    initPublicDatabase(),
    loadScriptOnce(siteRoot + "assets/js/site-management-public.js?v=4"),
    loadScriptOnce(siteRoot + "assets/js/hero-management-public.js?v=7"),
    loadScriptOnce(siteRoot + "assets/js/content-cards.js?v=6"),
    loadHTML("header", partialsPath + "header.html"),
    loadHTML("footer", partialsPath + "footer.html")
  ]).then(() => {
    const header = document.getElementById("header");
    if (header) {
      fixInjectedPaths(header, siteRoot);
      
      const headerEl = header.querySelector(".header");
      if (headerEl) headerEl.classList.add("loaded");
    }
    const footer = document.getElementById("footer");
    if (footer) fixInjectedPaths(footer, siteRoot);

    // Trigger Nav Logic after fragments are loaded
    if (typeof window.initWarmRight === "function") {
      window.initWarmRight();
    }
    document.dispatchEvent(new Event("includesLoaded"));
  });
});

function fixInjectedPaths(container, root) {
  container.querySelectorAll('a, img').forEach(el => {
    const attr = el.tagName === 'A' ? 'href' : 'src';
    let val = el.getAttribute(attr);
    if (val && !val.startsWith('http') && !val.startsWith('tel:') && !val.startsWith('mailto:') && !val.startsWith('#')) {
      const cleanVal = val.replace(/^(\.\.\/|\.\/|\/)+/, '');
      el.setAttribute(attr, root + cleanVal);
    }
  });
}
