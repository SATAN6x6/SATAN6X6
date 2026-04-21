#!/usr/bin/env python3
"""
google_news.py — Satan6x6 Skill

Fetches trending crypto news headlines from Google News RSS.
Returns a concatenated text block suitable for feeding into an LLM prompt.

This is one of Satan6x6's "skill" modules — small, single-purpose scripts
that the bot can invoke on demand. Each skill is a standalone executable;
Satan's core shells out to run it and captures stdout.

No API key required. Uses the public Google News RSS endpoint.
"""

import sys
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime


QUERY = "crypto"
LIMIT = 8
LANG = "en"
COUNTRY = "US"


def fetch_news(query: str = QUERY, limit: int = LIMIT) -> list[dict]:
    """Fetch top news items from Google News RSS."""
    encoded = urllib.parse.quote(query)
    url = (
        f"https://news.google.com/rss/search?q={encoded}"
        f"&hl={LANG}&gl={COUNTRY}&ceid={COUNTRY}:{LANG}"
    )

    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = resp.read()

    root = ET.fromstring(data)
    items = []
    for item in root.iter("item")[:limit] if False else list(root.iter("item"))[:limit]:
        title = item.findtext("title", default="").strip()
        source = item.find("source")
        source_name = source.text if source is not None else ""
        pub_date = item.findtext("pubDate", default="").strip()
        if title:
            items.append({
                "title": title,
                "source": source_name,
                "date": pub_date,
            })
    return items


def format_for_llm(items: list[dict]) -> str:
    """Format news items into a compact text block."""
    if not items:
        return "No news items retrieved."

    lines = [f"Crypto news snapshot ({datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}):\n"]
    for i, it in enumerate(items, 1):
        line = f"{i}. {it['title']}"
        if it['source']:
            line += f"  —  {it['source']}"
        lines.append(line)
    return "\n".join(lines)


def main() -> int:
    try:
        items = fetch_news()
        print(format_for_llm(items))
        return 0
    except Exception as e:
        print(f"[google_news] error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
