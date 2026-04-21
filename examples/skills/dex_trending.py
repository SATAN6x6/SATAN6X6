#!/usr/bin/env python3
"""
dex_trending.py — Satan6x6 Skill

Fetches trending pairs on Solana from DexScreener's public API.
Returns the top N pairs by recent volume, formatted for LLM prompts.

DexScreener aggregates real-time data across major Solana DEXs
(Raydium, Orca, Meteora, etc). Trending pairs indicate where retail
attention is currently concentrated — useful input for both
recommendation generation and sentiment analysis.

No API key required.
"""

import json
import sys
import urllib.request
from typing import Any


ENDPOINT = "https://api.dexscreener.com/latest/dex/search?q=solana"
LIMIT = 10


def fetch_pairs() -> list[dict[str, Any]]:
    """Fetch and return the top Solana pairs by 24h volume."""
    req = urllib.request.Request(ENDPOINT, headers={"User-Agent": "Satan6x6/1.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        payload = json.loads(resp.read().decode("utf-8"))

    pairs = payload.get("pairs") or []
    # Filter to Solana chain only
    solana_pairs = [p for p in pairs if p.get("chainId") == "solana"]

    # Sort by 24h volume descending
    solana_pairs.sort(
        key=lambda p: float(p.get("volume", {}).get("h24", 0) or 0),
        reverse=True,
    )
    return solana_pairs[:LIMIT]


def format_pair(pair: dict[str, Any]) -> str:
    """One-line summary of a single pair."""
    base = pair.get("baseToken", {}).get("symbol", "?")
    quote = pair.get("quoteToken", {}).get("symbol", "?")
    price = pair.get("priceUsd", "?")
    vol24 = pair.get("volume", {}).get("h24", 0)
    change24 = pair.get("priceChange", {}).get("h24", 0)
    liq = pair.get("liquidity", {}).get("usd", 0)

    try:
        vol_str = f"${float(vol24):,.0f}"
    except (TypeError, ValueError):
        vol_str = "?"
    try:
        liq_str = f"${float(liq):,.0f}"
    except (TypeError, ValueError):
        liq_str = "?"
    try:
        change_str = f"{float(change24):+.1f}%"
    except (TypeError, ValueError):
        change_str = "?"

    return (
        f"{base}/{quote}  —  ${price}  "
        f"(24h vol {vol_str}, liq {liq_str}, {change_str})"
    )


def format_for_llm(pairs: list[dict[str, Any]]) -> str:
    """Format pair list into a prompt-ready block."""
    if not pairs:
        return "No trending pairs retrieved."
    lines = ["Solana DEX trending pairs (by 24h volume):\n"]
    for i, p in enumerate(pairs, 1):
        lines.append(f"{i:>2}. {format_pair(p)}")
    return "\n".join(lines)


def main() -> int:
    try:
        pairs = fetch_pairs()
        print(format_for_llm(pairs))
        return 0
    except Exception as e:
        print(f"[dex_trending] error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
