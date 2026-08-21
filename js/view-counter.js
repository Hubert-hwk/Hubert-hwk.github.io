(() => {
  "use strict";

  const API = "https://hubert-blog-counter.1961700611.workers.dev";
  const POST_PATH = /^\/20\d{2}\/\d{2}\/\d{2}\/[a-z0-9-]+\/$/;
  const number = new Intl.NumberFormat("zh-CN");

  const isPostPath = (path) => POST_PATH.test(path);

  function visitorId() {
    const key = "hwk_blog_viewer_id";
    try {
      const saved = window.localStorage.getItem(key);
      if (saved) return saved;
      const id = crypto.randomUUID().replaceAll("-", "_");
      window.localStorage.setItem(key, id);
      return id;
    } catch {
      return crypto.randomUUID().replaceAll("-", "_");
    }
  }

  async function knownPostPaths() {
    const fromLinks = [...document.querySelectorAll('a[href*="/20"]')]
      .map((link) => new URL(link.href, window.location.origin).pathname)
      .filter(isPostPath);
    try {
      const response = await fetch("/search.xml", { cache: "force-cache" });
      if (!response.ok) throw new Error("search index unavailable");
      const xml = new DOMParser().parseFromString(await response.text(), "application/xml");
      const fromIndex = [...xml.querySelectorAll("entry > url")]
        .map((entry) => entry.textContent?.trim() || "")
        .filter(isPostPath);
      return [...new Set([...fromLinks, ...fromIndex])];
    } catch {
      return [...new Set(fromLinks)];
    }
  }

  function showCount(element, count, className) {
    let label = element.querySelector(`.${className}`);
    if (!label) {
      label = document.createElement("span");
      label.className = className;
      element.append(label);
    }
    label.innerHTML = `<i class="ri-eye-line" aria-hidden="true"></i> ${number.format(count)}`;
    label.setAttribute("aria-label", `阅读 ${number.format(count)} 次`);
  }

  function renderCards(views) {
    document.querySelectorAll('a.article-title[href], a.featured-post__link[href], a.archive-article-title[href]').forEach((link) => {
      const path = new URL(link.href, window.location.origin).pathname;
      if (!isPostPath(path) || views[path] === undefined) return;
      const card = link.closest(".article") || link.closest(".featured-post") || link.closest(".archive-article");
      const target = card?.querySelector(".article-inner, .archive-article-inner") || card;
      if (target) showCount(target, views[path], "article-view-count");
    });
  }

  function renderArticle(count) {
    const meta = document.querySelector(".post-hero__meta") || document.querySelector(".article-header");
    if (meta) showCount(meta, count, "post-view-count");
  }

  function renderTotal(total) {
    const footer = document.querySelector("footer.footer .outer");
    if (footer) showCount(footer, total, "site-view-count");
  }

  async function loadStats(paths) {
    if (!paths.length) return null;
    const query = new URLSearchParams();
    paths.forEach((path) => query.append("path", path));
    const response = await fetch(`${API}/v1/views?${query}`, { cache: "no-store" });
    if (!response.ok) throw new Error("view stats unavailable");
    return response.json();
  }

  async function recordCurrentPost(path) {
    const response = await fetch(`${API}/v1/hit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, viewerId: visitorId() }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("view recording unavailable");
    return response.json();
  }

  async function start() {
    if (API === "__COUNTER_API__") return;
    const currentPath = window.location.pathname;
    const paths = await knownPostPaths();
    let current = null;
    if (isPostPath(currentPath)) current = await recordCurrentPost(currentPath);
    const stats = await loadStats(paths);
    if (!stats) return;
    renderCards(stats.views);
    renderTotal(stats.total);
    if (current) renderArticle(stats.views[currentPath] ?? current.views);
  }

  window.addEventListener("load", () => {
    void start().catch(() => undefined);
  }, { once: true });
})();
