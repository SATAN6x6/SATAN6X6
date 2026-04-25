/**
 * Satan6x6 Public Bot - Master Entry
 * Friendly tone, info commands, AI chat, premium subscription
 *
 * Run with: pm2 start master-public.js --name satan6x6-public
 */

require('dotenv').config({ path: process.env.DOTENV_PATH || require('path').join(__dirname, '.env') });
const TelegramBot = require('node-telegram-bot-api');
const Anthropic = require('@anthropic-ai/sdk');
const { TwitterApi } = require('twitter-api-v2');
const fs = require('fs');
const path = require('path');

// Import handlers
const handlers = require('./public-handlers');
const { checkRateLimit, getUserTier } = require('./rate-limiter');
const { initSubscription, startPaymentMonitor } = require('./subscription');
const { startTweetAlerts } = require('./tweet-alerts');
const { trackUser, trackCommand, formatStatsMessage } = require('./user-tracker');

// Owner Telegram ID — only this user can run admin commands
const OWNER_ID = parseInt(process.env.OWNER_TELEGRAM_ID) || 0;

// ─── CONFIG ─────────────────────────────────────────
const PUBLIC_BOT_TOKEN = process.env.PUBLIC_BOT_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SUBSCRIPTION_WALLET = process.env.SUBSCRIPTION_WALLET;

// Twitter API (OAuth 1.0a credentials)
const TWITTER_CONFIG = {
  appKey: process.env.TWITTER_APP_KEY,
  appSecret: process.env.TWITTER_APP_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET
};

// Bearer token for app-only API v2 (search, user lookup) — more reliable than user context
const TWITTER_BEARER = process.env.TWITTER_BEARER_TOKEN;

// Validation
if (!PUBLIC_BOT_TOKEN) {
  console.error('❌ PUBLIC_BOT_TOKEN not set in .env');
  console.error('   See .env.example for required environment variables');
  process.exit(1);
}

if (!ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY not set');
  process.exit(1);
}

// ─── INIT CLIENTS ───────────────────────────────────
const claude = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// Use Bearer token if available (better for v2 search), fallback to OAuth 1.0a
let twitter;
if (TWITTER_BEARER) {
  twitter = new TwitterApi(TWITTER_BEARER);
  console.log('🐦 Twitter: using Bearer Token (app-only v2)');
} else {
  twitter = new TwitterApi(TWITTER_CONFIG);
  console.log('🐦 Twitter: using OAuth 1.0a (no Bearer set in .env)');
}

// Lock file (prevent double-instance)
const LOCK_FILE = require('path').join(process.env.DATA_DIR || __dirname, '.public-bot.lock');
if (fs.existsSync(LOCK_FILE)) {
  try {
    const oldPid = parseInt(fs.readFileSync(LOCK_FILE, 'utf-8').trim());
    process.kill(oldPid, 0); // check if process alive
    console.error(`❌ Public bot already running (PID ${oldPid})`);
    console.error(`   Run: pkill -9 -f "node master-public" && rm ${LOCK_FILE}`);
    process.exit(1);
  } catch(e) {
    fs.unlinkSync(LOCK_FILE);
    console.log('🔓 Removed stale lock file');
  }
}
fs.writeFileSync(LOCK_FILE, String(process.pid));
console.log('🔒 Public bot lock acquired: PID', process.pid);

// Clean any pending webhook before starting polling
async function cleanWebhook() {
  try {
    const axios = require('axios');
    await axios.get(`https://api.telegram.org/bot${PUBLIC_BOT_TOKEN}/deleteWebhook?drop_pending_updates=true`, { timeout: 5000 });
    console.log('🧹 Webhook cleaned');
  } catch(e) {
    console.log('⚠ Webhook cleanup warning:', e.message);
  }
}

// ─── BOT INSTANCE ───────────────────────────────────
const bot = new TelegramBot(PUBLIC_BOT_TOKEN, {
  polling: { autoStart: false, params: { timeout: 10 } }
});

// Handle polling errors gracefully
bot.on('polling_error', (error) => {
  if (error.message && error.message.includes('409')) {
    console.error('⚠ Polling conflict (will not spam)');
  } else {
    console.error('Polling error:', error.message);
  }
});

// ─── GLOBAL USER TRACKING ───────────────────────────
// Tracks every user interaction for /stats (owner-only)
bot.on('message', (msg) => {
  if (!msg || !msg.from || msg.from.is_bot) return;
  
  // Track user
  trackUser(msg);
  
  // Track command if it starts with /
  if (msg.text && msg.text.startsWith('/')) {
    const cmd = msg.text.split(' ')[0]; // get just /command part
    trackCommand(cmd);
  }
});

// ─── ADMIN: /stats (owner only) ─────────────────────
bot.onText(/^\/stats$/, async (msg) => {
  // Only owner can see stats
  if (msg.from.id !== OWNER_ID) {
    return; // silent ignore for non-owners (don't reveal command exists)
  }
  
  try {
    const statsText = formatStatsMessage();
    await bot.sendMessage(msg.chat.id, statsText, { parse_mode: 'Markdown' });
  } catch (e) {
    console.error('Stats error:', e);
    await bot.sendMessage(msg.chat.id, '⚠️ Failed to load stats: ' + e.message);
  }
});

// ─── COMMAND HANDLERS ───────────────────────────────

// /start - Welcome message
bot.onText(/^\/start$/, async (msg) => {
  await handlers.handleStart(bot, msg);
});

// /help - Show commands
bot.onText(/^\/help$/, async (msg) => {
  await handlers.handleHelp(bot, msg);
});

// /about - About Satan6x6
bot.onText(/^\/about$/, async (msg) => {
  await handlers.handleAbout(bot, msg);
});

// /price - Token info
bot.onText(/^\/price$/, async (msg) => {
  await handlers.handlePrice(bot, msg);
});

// /nft - NFT collection
bot.onText(/^\/nft$/, async (msg) => {
  await handlers.handleNFT(bot, msg);
});

// /ecosystem - Tech stack
bot.onText(/^\/ecosystem$/, async (msg) => {
  await handlers.handleEcosystem(bot, msg);
});

// /links - Official links
bot.onText(/^\/links$/, async (msg) => {
  await handlers.handleLinks(bot, msg);
});

// /roadmap - Project roadmap
bot.onText(/^\/roadmap$/, async (msg) => {
  await handlers.handleRoadmap(bot, msg);
});

// ─── TWITTER INTEL (Free tier) ───────────────────────

// /viral - Viral crypto tweets
bot.onText(/^\/viral$/, async (msg) => {
  await handlers.handleViral(bot, msg, twitter);
});

// /elon - Elon Musk latest
bot.onText(/^\/elon$/, async (msg) => {
  await handlers.handleElon(bot, msg, twitter);
});

// /vitalik - Vitalik Buterin (Ethereum)
bot.onText(/^\/vitalik$/, async (msg) => {
  await handlers.handleQuickPerson(bot, msg, twitter, 'VitalikButerin', '🦄 @VitalikButerin LATEST TWEETS');
});

// /saylor - Michael Saylor (Bitcoin)
bot.onText(/^\/saylor$/, async (msg) => {
  await handlers.handleQuickPerson(bot, msg, twitter, 'saylor', '🟧 @saylor LATEST TWEETS');
});

// /cz - CZ Binance
bot.onText(/^\/cz$/, async (msg) => {
  await handlers.handleQuickPerson(bot, msg, twitter, 'cz_binance', '🟡 @cz_binance LATEST TWEETS');
});

// /anatoly - Solana co-founder
bot.onText(/^\/anatoly$/, async (msg) => {
  await handlers.handleQuickPerson(bot, msg, twitter, 'aeyakovenko', '🟣 @aeyakovenko LATEST TWEETS');
});

// /mert - Helius CEO
bot.onText(/^\/mert$/, async (msg) => {
  await handlers.handleQuickPerson(bot, msg, twitter, '0xMert_', '⚡ @0xMert_ LATEST TWEETS');
});

// /ansem - Memecoin trader
bot.onText(/^\/ansem$/, async (msg) => {
  await handlers.handleQuickPerson(bot, msg, twitter, 'blknoiz06', '🐸 @blknoiz06 (Ansem) LATEST TWEETS');
});

// /zachxbt - On-chain detective
bot.onText(/^\/zachxbt$/, async (msg) => {
  await handlers.handleQuickPerson(bot, msg, twitter, 'zachxbt', '🔍 @zachxbt LATEST TWEETS');
});

// /who @username - Universal: check any Twitter user's latest tweets
bot.onText(/^\/who(?:\s+@?(\w+))?$/, async (msg, match) => {
  await handlers.handleWho(bot, msg, twitter, match[1]);
});

// /influencer - Top crypto influencers
bot.onText(/^\/influencer$/, async (msg) => {
  await handlers.handleInfluencer(bot, msg, twitter);
});

// /web3 - Web3 trending news
bot.onText(/^\/web3$/, async (msg) => {
  await handlers.handleWeb3(bot, msg, twitter);
});

// /track @username - Track specific user
bot.onText(/^\/track\s+@?(\w+)$/, async (msg, match) => {
  await handlers.handleTrack(bot, msg, match[1]);
});

// /tracking - Show tracked users
bot.onText(/^\/tracking$/, async (msg) => {
  await handlers.handleTrackingList(bot, msg);
});

// /untrack @username - Stop tracking
bot.onText(/^\/untrack\s+@?(\w+)$/, async (msg, match) => {
  await handlers.handleUntrack(bot, msg, match[1]);
});

// ─── SUBSCRIPTION ───────────────────────────────────

// /subscribe - How to subscribe
bot.onText(/^\/subscribe$/, async (msg) => {
  await handlers.handleSubscribe(bot, msg, SUBSCRIPTION_WALLET);
});

// /status - Premium status check
bot.onText(/^\/status$/, async (msg) => {
  await handlers.handleStatus(bot, msg);
});

// /alerts on/off - Tweet alerts toggle
bot.onText(/^\/alerts(?:\s+(on|off|status))?$/, async (msg, match) => {
  await handlers.handleAlerts(bot, msg, match[1]);
});

// ─── PREMIUM ONLY ───────────────────────────────────

// /portfolio - User wallet portfolio (Premium only)
bot.onText(/^\/portfolio(?:\s+(.+))?$/, async (msg, match) => {
  await handlers.handlePortfolio(bot, msg, match[1]);
});

// /airdrop - Airdrop eligibility (Premium only)
bot.onText(/^\/airdrop$/, async (msg) => {
  await handlers.handleAirdrop(bot, msg);
});

// ─── COMING SOON ────────────────────────────────────

// /launch - Coming soon
bot.onText(/^\/launch$/, async (msg) => {
  await handlers.handleLaunchSoon(bot, msg);
});

// /404work - Coming soon
bot.onText(/^\/404work$/, async (msg) => {
  await handlers.handle404Work(bot, msg);
});

// ─── AI CHAT (free conversation) ─────────────────────

bot.on('message', async (msg) => {
  // Skip if it's a command (starts with /)
  if (!msg.text || msg.text.startsWith('/')) return;

  // Rate limit check
  const tier = getUserTier(msg.from.id);
  const limit = tier === 'premium' ? 66 : 6;
  const allowed = checkRateLimit(msg.from.id, limit);

  if (!allowed.ok) {
    bot.sendMessage(msg.chat.id,
      `⚠️ Slow down, mortal.\n\n` +
      `You've reached your hourly limit (${limit} messages).\n` +
      `Reset in ${allowed.resetIn} minutes. ⏳\n\n` +
      `${tier === 'free' ? '💎 Upgrade to Premium with /subscribe for 66 msg/hour!' : ''}`
    );
    return;
  }

  // Process AI chat
  await handlers.handleAIChat(bot, msg, claude, tier);
});

// ─── STARTUP ────────────────────────────────────────
async function startBot() {
  console.log('😈 Satan6x6 Public Bot starting...');

  // Init subscription system
  initSubscription();

  // Clean webhook before polling
  await cleanWebhook();

  // Start polling
  bot.startPolling();
  console.log('📡 Polling started');

  // Start payment monitor (check incoming SOL)
  startPaymentMonitor(bot);
  console.log('💰 Payment monitor started');

  // Start tweet alerts (notify premium when @6x6satan tweets)
  startTweetAlerts(bot, twitter);
  console.log('🐦 Tweet alerts started');

  console.log('✅ Satan6x6 Public Bot is LIVE!');
}

// ─── GRACEFUL SHUTDOWN ──────────────────────────────
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  bot.stopPolling();
  if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
  console.log('🔓 Lock released');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM');
  bot.stopPolling();
  if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
  process.exit(0);
});

// Start
startBot().catch(err => {
  console.error('💀 Startup failed:', err);
  if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
  process.exit(1);
});
