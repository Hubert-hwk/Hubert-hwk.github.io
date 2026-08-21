#!/usr/bin/env python3
"""Generate sitemap.xml from the canonical URLs in this static site."""

from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
SITE_URL = "https://hubert-hwk.github.io"
POST_URL = re.compile(r"^/(20\d{2})/(\d{2})/(\d{2})/[^/]+/$")


class CanonicalParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.canonicals: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag == "link" and attributes.get("rel") == "canonical":
            href = attributes.get("href")
            if href:
                self.canonicals.append(href)


def article_lastmod(url: str) -> str | None:
    match = POST_URL.fullmatch(url.removeprefix(SITE_URL))
    return "-".join(match.groups()) if match else None


def url_sort_key(url: str) -> tuple[int, str]:
    path = url.removeprefix(SITE_URL)
    fixed = {"/": 0, "/archives/": 1, "/about/hwk.html": 2}
    if path in fixed:
        return (fixed[path], "")
    return (3, path)


def sitemap_xml() -> str:
    urls: set[str] = set()
    for page in ROOT.rglob("*.html"):
        if page.name == "404.html":
            continue
        parser = CanonicalParser()
        parser.feed(page.read_text(encoding="utf-8"))
        urls.update(url for url in parser.canonicals if url.startswith(SITE_URL))

    entries: list[str] = []
    for url in sorted(urls, key=url_sort_key):
        lastmod = article_lastmod(url)
        suffix = f"<lastmod>{lastmod}</lastmod>" if lastmod else ""
        entries.append(f"  <url><loc>{url}</loc>{suffix}</url>")
    return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n" + "\n".join(entries) + "\n</urlset>\n"


def main() -> None:
    (ROOT / "sitemap.xml").write_text(sitemap_xml(), encoding="utf-8")


if __name__ == "__main__":
    main()
