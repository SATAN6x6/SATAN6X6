# 🚀 Satan6x6 Public Bot — Deployment Guide

This guide walks you through deploying your own instance of `@summon_satan6x6_bot` on a VPS.

---

## 📋 Prerequisites

- VPS with Ubuntu 22.04+ (any provider — Hostinger, DigitalOcean, AWS, etc.)
- SSH access to your VPS
- Node.js 18+ installed
- PM2 installed globally (`npm install -g pm2`)

### Required Accounts & Keys

You need to obtain the following before starting:

| Service | Purpose | Where |
|---------|---------|-------|
| Telegram Bot | Bot token | [@BotFather](https://t.me/BotFather) |
| Anthropic | Claude AI API | [console.anthropic.com](https://console.anthropic.com) |
| Helius | Solana RPC | [helius.dev](https://helius.dev) (free tier) |
| Twitter Developer | Twitter API | [developer.twitter.com](https://developer.twitter.com) |
| Solana Wallet | Receive subscriptions | Phantom / Solflare |

---

## 🛠️ Step 1: Setup VPS

```bash
# SSH into your VPS
ssh root@your_vps_ip

# Update system
apt update && apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install PM2
npm install -g pm2

# Create project directory
mkdir -p /opt/satan6x6 && cd /opt/satan6x6
```

---

## 📥 Step 2: Clone Repository

```bash
git clone https://github.com/SATAN6x6/SATAN6x6.git .
npm install
```

---

## 🔐 Step 3: Configure Environment

```bash
cp .env.example .env
nano .env
```

Fill in all required values:

```env
PUBLIC_BOT_TOKEN=8xxxxxxxxx:AAxxxxxxxxxxxxxxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxx
SUBSCRIPTION_WALLET=YourSolanaPublicAddress
HELIUS_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
TWITTER_APP_KEY=xxxxxxxxxxxxxx
TWITTER_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWITTER_ACCESS_TOKEN=xxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxxxxxx
TWITTER_ACCESS_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxx
TWITTER_BEARER_TOKEN=AAAAAAAAAAAAAAAAAAAAAxxxxxxxxxxxxxxx
OWNER_TELEGRAM_ID=123456789
```

To find your Telegram User ID, message [@userinfobot](https://t.me/userinfobot).

Save with `Ctrl+O`, exit with `Ctrl+X`.

---

## ▶️ Step 4: Start Bot

```bash
# Start with PM2
pm2 start ecosystem.config.js

# Verify running
pm2 status

# Check logs
pm2 logs satan6x6-public --lines 50

# Save PM2 process list (auto-restart on reboot)
pm2 save
pm2 startup
```

You should see:
```
✓ Bot online: @your_bot_username
✓ Subscription monitor active
✓ Tweet alerts watching @your_twitter_handle
```

---

## 🧪 Step 5: Test the Bot

Open Telegram, find your bot, then test:

```
/start
/help
/about
/viral
/elon
/stats         (only works for OWNER_TELEGRAM_ID)
```

---

## 📊 Owner-Only Commands

The bot has admin commands that only respond to the `OWNER_TELEGRAM_ID` user:

- **`/stats`** — Total users, premium count, top commands, top users

For other users, the command is silently ignored (no acknowledgment).

---

## 🔧 Common Operations

```bash
# View live logs
pm2 logs satan6x6-public

# Restart bot
pm2 restart satan6x6-public

# Stop bot
pm2 stop satan6x6-public

# Check memory usage
pm2 monit

# View saved data
cat users-stats.json | jq
cat premium-users.json | jq
```

---

## 📁 Auto-Generated Data Files

These files are created automatically and contain user data — they're in `.gitignore`:

| File | Purpose |
|------|---------|
| `users-stats.json` | All user activity tracking |
| `commands-stats.json` | Command usage counts |
| `premium-users.json` | Premium subscribers |
| `tracked-users.json` | Tracked Twitter users (per-user) |
| `alert-settings.json` | Tweet alert preferences |
| `processed-tx.json` | Already-processed payment transactions |
| `last-satan-tweet.json` | Last seen tweet ID for alerts |
| `rate-limits.json` | Rate limit counters |

**Backup these files regularly** to preserve user data across deployments.

---

## 🚨 Troubleshooting

### Bot not responding
```bash
pm2 logs satan6x6-public --err
# Look for missing env vars or API key errors
```

### "409 Conflict" errors
Multiple bot instances running. Clean up:
```bash
pkill -9 -f "master-public"
rm .public-bot.lock
pm2 restart satan6x6-public
```

### Twitter rate limits
Switch from OAuth 1.0a to Bearer Token (set `TWITTER_BEARER_TOKEN`).

### Claude API errors
Check your Anthropic account has credits. Free tier has limits.

---

## 🔒 Security Best Practices

1. ✅ Never commit `.env` to git (already in `.gitignore`)
2. ✅ Use a dedicated wallet for subscriptions (not your main wallet)
3. ✅ Keep `OWNER_TELEGRAM_ID` private (it's how you access /stats)
4. ✅ Rotate API keys periodically
5. ✅ Backup data files weekly
6. ✅ Use strong VPS root password + SSH keys only
7. ✅ Enable firewall (`ufw enable`)

---

## 📄 License

MIT — see [LICENSE](LICENSE) file.

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repo
2. Create a feature branch
3. Test your changes
4. Submit a PR

## 🔗 Links

- **Live Bot:** [@summon_satan6x6_bot](https://t.me/summon_satan6x6_bot)
- **Website:** [satan6x6.xyz](https://satan6x6.xyz)
- **Twitter:** [@6x6satan](https://x.com/6x6satan)
- **Project:** [404Work](https://404work.xyz)
