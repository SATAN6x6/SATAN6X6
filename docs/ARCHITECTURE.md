# 🏗️ Satan6x6 Architecture

High-level system design. Implementation details remain private during development.

---

## System Overview

Satan6x6 is built on [OpenClaw](https://github.com/openclaw) — an open-source AI agent framework that handles messaging, memory, and the agent runtime loop. On top of OpenClaw, Satan6x6 adds custom skills for Solana operations, market intelligence, and token launch automation.

```
┌──────────────────────────────────────────────────────────────┐
│                     USER (Telegram)                          │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│           OpenClaw Framework (Channel Layer)                 │
│  Messaging adapters • Session management • Protocol norm     │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│           OpenClaw Framework (Brain Layer)                   │
│  Agent runtime • Heartbeat • Memory • Context assembly       │
└──────────────────────────┬───────────────────────────────────┘
                           │
         ┌─────────────────┼──────────────────┐
         ▼                 ▼                  ▼
    ┌────────┐       ┌────────────┐     ┌────────────┐
    │ Claude │       │   Custom   │     │  Custom    │
    │ Sonnet │       │   Skills   │     │  Launch    │
    │ (LLM)  │       │  (Intel)   │     │  Pipeline  │
    └────────┘       └────────────┘     └────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│         OpenClaw Framework (Body Layer + Custom)             │
│   Tool executors • Solana SDK • Metaplex • Meteora           │
└──────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. OpenClaw Framework
- **Role:** Agent orchestration foundation
- **Why:** Handles messaging protocol, memory persistence, agent loop, scheduled tasks
- **Approach:** Local-first (data on our infrastructure, not third-party)
- **Layers used:** Channel (Telegram), Brain (runtime + memory), Body (tool execution)

### 2. AI Core (Claude Sonnet 4)
- **Model:** Claude Sonnet 4 via Anthropic API
- **Purpose:** Reasoning, content generation, language adaptation, token concept creation
- **Context:** System prompt + user memory + skill outputs + conversation history

### 3. Custom Intel Layer
- **Viral Detection:** Multiple data sources (Fear/Greed, DexScreener, Twitter, News)
- **Analysis:** Claude reasoning on aggregated intel
- **Delivery:** Formatted output matched to user's language preference

### 4. Custom Launch Pipeline
- **Metadata:** JSON + image uploaded to IPFS (Pinata)
- **Minting:** Metaplex Umi (Core + Token Metadata)
- **Revoke:** SPL Token authority revocation
- **Pool Creation:** Meteora `@meteora-ag/cp-amm-sdk`

### 5. Persistent Memory (via OpenClaw)
- **Storage:** Markdown/JSON files on disk
- **Content:** User profile, preferences, conversation history, custom rules
- **Durability:** Survives bot restarts, VPS reboots, crashes

---

## Data Flow Examples

### Chat Flow
```
User message
  → Command parser
  → Memory loader (context)
  → Claude API with system prompt
  → Response formatter
  → Telegram send
  → Memory save
```

### Token Launch Flow
```
/launchtoken
  → State: awaiting_concept
  → /viral → Claude generates → User approves
  → State: awaiting_socials
  → Twitter/Telegram/Website input
  → State: awaiting_logo
  → Image upload to Pinata
  → State: awaiting_liquidity_config
  → /meteora [amount]
  → State: confirm_launch
  → /confirmlaunch
  → Execute pipeline:
    1. Upload metadata JSON to IPFS
    2. Metaplex mint (token + metadata account)
    3. Revoke mint authority
    4. Revoke freeze authority
    5. Create Meteora pool
    6. Deposit liquidity
    7. Generate announcement tweet
  → Tweet approval flow
  → Done
```

### Viral Intel Flow
```
/viral [topic]
  → Topic classifier (crypto/world/twitter/market/news/custom)
  → Parallel data source fetch:
    - Fear & Greed API
    - DexScreener trending
    - DEX trending tokens
    - News aggregator
    - Twitter monitor
  → Aggregate context
  → Claude analysis with intel context
  → Formatted response to user
```

---

## Security Model

### What's Protected
- **Wallet private keys** — stored with `600` permissions, never transmitted
- **API keys** — environment variables, never in code
- **User data** — local JSON, not synced externally
- **PID lock** — prevents duplicate instances attacking each other

### What's Public
- Token mint addresses (on-chain)
- Transaction signatures (on-chain)
- Bot username (public)
- IPFS metadata (intentionally public)

---

## Deployment

### Current (Private Beta)
- **Host:** VPS (Hostinger)
- **OS:** Ubuntu 24.04 LTS
- **Node:** v22.x
- **Uptime:** 24/7
- **Backup:** Multi-version code backups

### Future (Phase 6)
- **Frontend:** satan6x6.xyz (webhook-based launch pad)
- **Backend:** Microservices for scalability
- **Multi-user:** Wallet-per-user model
- **Storage:** Database (migrate from JSON)

---

## Third-Party Services

| Service | Purpose | Why |
|---------|---------|-----|
| **OpenClaw** | Agent framework | Battle-tested, MIT-licensed, local-first, messaging-native |
| **Anthropic Claude** | AI reasoning | Best-in-class LLM for nuanced responses and language adaptation |
| **Helius RPC** | Solana connectivity | High reliability, DAS API, rate limits |
| **Pinata IPFS** | Metadata/image storage | Developer-friendly, reliable pinning |
| **Metaplex** | NFT/Token standards | Industry standard for Solana |
| **Meteora** | DEX liquidity pools | DAMM v2 permissionless pools |
| **Telegram** | User interface | Low friction, high adoption in crypto |
| **Twitter API v2** | Social posting | Primary marketing channel |

---

## Design Principles

### 1. Never Auto-Act on Public Channels
Satan never tweets, launches, or transacts without user approval.

### 2. Fail Loud, Fail Safe
Errors surface to user. Failed transactions don't corrupt state.

### 3. Idempotent State
State machine can recover from any interruption.

### 4. Concise, On-Brand Voice
Every user-facing string maintains Satan6x6's dark, hype personality — no corporate speak, no fluff.

### 5. Dark Aesthetic Throughout
From emojis to copywriting, the vibe is consistent.

---

*Architecture evolves. This document reflects current state as of Phase 1-3.*
