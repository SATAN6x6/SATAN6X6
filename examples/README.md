# Examples — Satan6x6 Skills

This folder contains **non-sensitive** example modules that demonstrate how Satan6x6 gathers market intelligence.

Each Python file in `skills/` is a standalone script that Satan's core invokes on demand. The bot shells out (`python3 skills/foo.py`), captures stdout, and feeds the result into the Claude prompt.

## Why share these?

These skills are:
- **Not proprietary** — they wrap public APIs (DexScreener, alternative.me, Google News RSS)
- **Useful reference** — other developers building Web3 AI agents can adapt the pattern
- **Demonstrative** — show how Satan6x6 collects real-time context

The **core launch pipeline, wallet management, and state machine** remain in the private codebase on the production VPS.

## Available skills

| File | What it does | API key needed? |
|---|---|---|
| `skills/google_news.py` | Latest crypto news from Google News RSS | No |
| `skills/fear_greed.py` | Crypto Fear & Greed Index | No |
| `skills/dex_trending.py` | Top Solana DEX pairs by volume | No |

## Running standalone

```bash
# Works as-is, no setup required
python3 skills/fear_greed.py
python3 skills/dex_trending.py
python3 skills/google_news.py
```

Output is plain text, designed to be concatenated directly into an LLM prompt.

## Extending

To add a new skill, create `skills/your_skill.py` following the pattern:

1. Fetch data from some API
2. Format it as a short human-readable block
3. Print to stdout
4. Exit 0 on success, non-zero on error (log to stderr)

Satan's core will pick it up automatically through the skill executor.
