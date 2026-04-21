#!/usr/bin/env python3
"""
Fear & Greed Index Skill
Fetches current crypto market sentiment from alternative.me API.

This is an EXAMPLE skill showcasing how Satan6x6 aggregates market intelligence.
Output is consumed by /viral market command in the main bot.
"""

import json
import urllib.request


def fetch_fear_greed():
    """Fetch current Fear & Greed Index for crypto market."""
    url = "https://api.alternative.me/fng/?limit=1"

    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            data = json.loads(response.read().decode())

        if not data.get('data') or len(data['data']) == 0:
            return "No data available"

        fg = data['data'][0]
        value = int(fg['value'])
        classification = fg['value_classification']
        timestamp = fg.get('timestamp', 'unknown')

        emoji = get_emoji(value)

        return f"{emoji} Fear & Greed Index: {value}/100 ({classification})"

    except Exception as e:
        return f"Error fetching Fear & Greed: {str(e)}"


def get_emoji(value):
    """Map index value to appropriate emoji."""
    if value < 25:
        return "😱"  # Extreme Fear
    elif value < 45:
        return "😨"  # Fear
    elif value < 55:
        return "😐"  # Neutral
    elif value < 75:
        return "😎"  # Greed
    else:
        return "🤑"  # Extreme Greed


if __name__ == "__main__":
    print(fetch_fear_greed())
