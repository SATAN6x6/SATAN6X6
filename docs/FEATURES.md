# ⚡ Satan6x6 Features

Complete reference for all Satan6x6 capabilities.

---

## 💬 Conversation

### Natural Conversation
- Smart context-aware chat
- Powered by Claude Sonnet 4
- Handles complex multi-turn reasoning

### Persistent Memory
- Survives bot restarts, VPS reboots, crashes
- Topic detection and categorization
- Auto-summarization of older conversations

**Commands:**
- `/history [keyword]` — search past conversations
- `/topics` — list all discussed topics
- `/summary` — summary of recent conversations
- `/clear` — reset memory (with confirmation)

---

## 📊 Market Intelligence

### `/viral` — Viral Topic Search

| Command | Description |
|---------|-------------|
| `/viral` | Default: crypto token recommendations |
| `/viral world` / `global` | Global viral news |
| `/viral twitter` / `kol` | Crypto Twitter & KOL chatter |
| `/viral news` | Crypto news summary |
| `/viral market` | Fear/Greed + trending + DEX pairs |
| `/viral [custom]` | Free-form topic search |

### Data Sources
- Fear & Greed Index (real-time)
- DexScreener trending pairs
- DEX trending tokens
- Google News crypto
- Crypto Twitter monitoring

---

## 💰 Wallet & Portfolio

### `/wallet`
Real-time wallet status:
- SOL balance + USD value
- All SPL tokens with current prices
- Token holdings with metadata
- Total portfolio value

### `/balance`
Quick SOL balance check.

---

## 🪙 Token Launch Pipeline

### `/launchtoken` — Start Launch Flow

**Complete Flow:**
```
1. /launchtoken
2. /viral (AI rec) OR /manual (custom) OR /generate (concept)
3. /accepttoken — confirm token details
4. Twitter input (auto-detect + manual + /twitterskip)
5. Telegram input (manual + /tgskip)
6. Website input (manual + /webskip)
7. Upload logo image
8. /meteora [SOL amount] — liquidity config
9. /confirmlaunch — execute!
```

### What Happens On Launch

| Step | Action | Cost |
|------|--------|------|
| 1 | Upload metadata + socials to IPFS | ~free (Pinata) |
| 2 | Upload logo to IPFS | ~free |
| 3 | Mint SPL token via Metaplex | ~0.015 SOL |
| 4 | Revoke mint authority | ~0.001 SOL |
| 5 | Revoke freeze authority | ~0.001 SOL |
| 6 | Create Meteora DAMM v2 pool | ~0.025 SOL |
| 7 | Deposit liquidity | User defined |
| 8 | Auto-generate tweet announcement | ~free |

**Total Cost:** ~0.042 SOL + liquidity deposit

### Post-Launch
- ✅ Metadata visible on Solscan
- ✅ NoMint + No Blacklist (green on GMGN)
- ✅ Tradeable on Jupiter
- ✅ Shows on DexScreener
- ✅ Listed on GMGN with full info
- ✅ Auto-tweet prompt (with approval)

---

## 🐦 Twitter Integration

### `/tweet [topic]`
Generate AI tweet about a topic, with approval workflow.

**Flow:**
1. Request tweet on topic
2. AI generates draft
3. Preview in Telegram
4. `/approve` — post tweet
5. `/skip` — discard

**Satan never tweets without approval.**

### Auto-Tweet on Launch
After successful token launch, Satan automatically generates announcement tweet:

```
$SIMBOL — Token Name

CA: [mint address]
📊 [DexScreener link]
🌐 [Website]
💬 [Telegram]
🐦 [Twitter]

[description]
```

User approves before posting.

---

## 🎨 NFT (Phase 1.5)

### Genesis Collection
4 NFTs representing core identity:
- 🔴 Blood (Common)
- 👻 Ghost (Rare)
- 💗 Chaos (Epic)
- 💜 Origin (Legendary)

**Live on:** [Tensor](https://www.tensor.trade/portfolio?wallet=6M2qBukScUPCTiiH8VmzvLaiaukHkuyime1KWFVXHJdx)

---

## 🛡️ Infrastructure

Satan6x6 is built on [OpenClaw](https://github.com/openclaw) — a battle-tested, MIT-licensed AI agent framework. This gives us a solid foundation for:

- **Messaging** — Telegram adapter out of the box
- **Memory** — Local-first persistent storage (survives restarts)
- **Agent Loop** — Heartbeat scheduling, context assembly, tool execution
- **Extensibility** — Custom skills plug in cleanly

On top of OpenClaw, Satan6x6 adds:

- Custom Solana skills (Metaplex mint, Meteora pool, wallet ops)
- Market intel aggregation (Fear/Greed, DexScreener, Twitter, News)
- Launch pipeline automation
- Twitter posting with approval flow

### 24/7 Operation
- PM2 process management
- Auto-restart on crash
- Auto-start on VPS reboot
- Graceful shutdown handling

### Protection Systems
- PID lock (anti-duplicate instance)
- Webhook cleanup on startup
- Rate limit handling (Helius 429 auto-retry)
- Transaction retry logic (blockhash expiry)

### Configuration
- Environment variables (`.env`)
- Secure wallet storage
- Helius RPC endpoint
- Pinata IPFS credentials

---

## 🔒 Personalization

### Custom Master
- `/setname [name]` — how Satan calls you
- `/setpersonality [trait]` — adjust Satan's vibe
- `/remember [rule]` — absolute rules Satan always follows
- `/forget [number]` — remove a rule
- `/rules` — list all rules

### Default Behavior
- Addresses user with respect ("Sir" by default, customizable)
- Dark, hype personality
- Concise, impactful responses
- Emoji-rich formatting

---

## 🚀 Public Features (Coming Phase 4)

When Satan6x6 goes public via Telegram:
- ✅ Public `/viral` access
- ✅ Public `/wallet` (user wallets)
- ✅ Market analysis
- ✅ AI conversation
- ✅ Tweet generation

Token launch features will be exclusive to satan6x6.xyz (Phase 6).

---

*All features actively maintained. More coming as Satan6x6 evolves.*
