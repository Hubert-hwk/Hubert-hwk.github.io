#!/usr/bin/env python3
"""Zero-dependency integrity checks for the generated static site."""

from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import sys
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
SITE_URL = "https://hubert-hwk.github.io"
HTML_FILES = sorted(ROOT.rglob("*.html"))
REQUIRED_OG = {"og:type", "og:title", "og:description", "og:url", "og:image"}


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: list[str] = []
        self.hrefs: list[str] = []
        self.blank_links: list[str] = []
        self.canonical: list[str] = []
        self.meta: dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if attributes.get("id"):
            self.ids.append(attributes["id"])
        if tag == "a" and attributes.get("href"):
            self.hrefs.append(attributes["href"])
            if attributes.get("target") == "_blank" and "noopener" not in (attributes.get("rel") or ""):
                self.blank_links.append(attributes["href"])
        if tag == "link" and attributes.get("rel") == "canonical":
            self.canonical.append(attributes.get("href", ""))
        if tag == "meta":
            key = attributes.get("property") or attributes.get("name")
            if key:
                self.meta[key] = attributes.get("content", "")


def resolve_local_ref(source: Path, href: str) -> Path | None:
    parsed = urlsplit(href)
    if parsed.scheme or parsed.netloc or href.startswith(("#", "javascript:", "mailto:")):
        return None
    path = unquote(parsed.path)
    if not path:
        return None
    candidate = ROOT / path.lstrip("/") if path.startswith("/") else source.parent / path
    if candidate.is_dir() or path.endswith("/"):
        return candidate / "index.html"
    if not candidate.suffix and (candidate / "index.html").is_file():
        return candidate / "index.html"
    return candidate


def main() -> int:
    errors: list[str] = []
    canonical_urls: set[str] = set()

    for page in HTML_FILES:
        relative = page.relative_to(ROOT)
        raw = page.read_text(encoding="utf-8")
        parser = PageParser()
        parser.feed(raw)

        duplicate_ids = {item for item in parser.ids if parser.ids.count(item) > 1}
        if duplicate_ids:
            errors.append(f"{relative}: duplicate id(s): {', '.join(sorted(duplicate_ids))}")
        if parser.blank_links:
            errors.append(f"{relative}: target=_blank missing rel=noopener: {parser.blank_links}")
        for href in parser.hrefs:
            target = resolve_local_ref(page, href)
            if target is not None and not target.exists():
                errors.append(f"{relative}: broken local link {href!r} -> {target.relative_to(ROOT)}")

        if relative.as_posix() == "404.html":
            if parser.meta.get("robots") != "noindex, nofollow":
                errors.append("404.html: expected robots=noindex, nofollow")
            continue

        if len(parser.canonical) != 1 or not parser.canonical[0].startswith(SITE_URL):
            errors.append(f"{relative}: expected one canonical URL on {SITE_URL}")
        else:
            canonical_urls.add(parser.canonical[0])
        if not parser.meta.get("description"):
            errors.append(f"{relative}: missing meta description")
        missing_og = REQUIRED_OG - parser.meta.keys()
        if missing_og:
            errors.append(f"{relative}: missing Open Graph fields: {', '.join(sorted(missing_og))}")

    sitemap = ROOT / "sitemap.xml"
    try:
        urls = {node.text for node in ET.parse(sitemap).findall("{*}url/{*}loc") if node.text}
    except ET.ParseError as exc:
        errors.append(f"sitemap.xml: invalid XML: {exc}")
        urls = set()
    missing_from_sitemap = canonical_urls - urls
    if missing_from_sitemap:
        errors.append("sitemap.xml: canonical page(s) missing: " + ", ".join(sorted(missing_from_sitemap)))

    if errors:
        print("Site integrity check failed:")
        print("\n".join(f"- {error}" for error in errors))
        return 1
    print(f"Site integrity check passed ({len(HTML_FILES)} HTML pages, {len(canonical_urls)} indexable pages).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
