/**
 * Public Bot Command Handlers
 */

const data = require('./public-data');
const { getUserTier, isPremium, checkTwitterLimit } = require('./rate-limiter');
const { getTrackedUsers, addTrackedUser, removeTrackedUser, getAlertStatus, setAlertStatus } = require('./subscription');

// Cache for Twitter data (avoid hitting API too often)
const cache = new Map();
function getCached(key, ttlMs) {
  const c = cache.get(key);
  if (c && Date.now() - c.time < ttlMs) return c.data;
  return null;
}
function setCached(key, data) {
  cache.set(key, { data, time: Date.now() });
}

// Twitter rate limit guard - returns true if user can proceed, false otherwise
async function checkTwitterRateGate(bot, msg) {
  const result = checkTwitterLimit(msg.from.id);
  if (!result.ok) {
    await bot.sendMessage(msg.chat.id,
      `⚠️ *Twitter command limit reached*\n\n` +
      `Free tier: ${result.limit} Twitter commands per 3 hours.\n` +
      `You've used: ${result.limit}/${result.limit}\n` +
      `Reset in: ${result.resetIn}\n\n` +
      `💎 *Want unlimited Twitter access?*\n` +
      `Upgrade to Premium with /subscribe\n` +
      `(0.6 SOL/month — unlimited Twitter intel + tweet alerts)`,
      { parse_mode: 'Markdown' }
    );
    return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════
// BASIC COMMANDS
// ═══════════════════════════════════════════════════

async function handleStart(bot, msg) {
  await bot.sendMessage(msg.chat.id, data.WELCOME, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  });
}

async function handleHelp(bot, msg) {
  await bot.sendMessage(msg.chat.id, data.HELP, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  });
}

async function handleAbout(bot, msg) {
  await bot.sendMessage(msg.chat.id, data.ABOUT, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  });
}

async function handlePrice(bot, msg) {
  await bot.sendMessage(msg.chat.id, data.PRICE, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  });
}

async function handleNFT(bot, msg) {
  await bot.sendMessage(msg.chat.id, data.NFT, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  });
}

async function handleEcosystem(bot, msg) {
  await bot.sendMessage(msg.chat.id, data.ECOSYSTEM, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  });
}

async function handleLinks(bot, msg) {
  await bot.sendMessage(msg.chat.id, data.LINKS, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  });
}

async function handleRoadmap(bot, msg) {
  await bot.sendMessage(msg.chat.id, data.ROADMAP, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  });
}

// ═══════════════════════════════════════════════════
// TWITTER INTEL (Free tier)
// ═══════════════════════════════════════════════════

async function handleViral(bot, msg, twitter) {
  if (!await checkTwitterRateGate(bot, msg)) return;
  
  await bot.sendChatAction(msg.chat.id, 'typing');
  
  try {
    let tweets = getCached('viral', 60 * 60 * 1000); // 60 min cache
    
    if (!tweets) {
      const result = await twitter.v2.search('(crypto OR bitcoin OR solana OR ethereum) -is:retweet lang:en', {
        max_results: 10,
        'tweet.fields': ['public_metrics', 'created_at', 'author_id'],
        'user.fields': ['username', 'name'],
        expansions: ['author_id'],
        sort_order: 'relevancy'
      });
      
      tweets = result.data?.data || [];
      const users = result.includes?.users || [];
      
      // Sort by likes
      tweets.sort((a, b) => (b.public_metrics?.like_count || 0) - (a.public_metrics?.like_count || 0));
      tweets = tweets.slice(0, 5).map(t => {
        const user = users.find(u => u.id === t.author_id);
        return { ...t, author: user };
      });
      
      setCached('viral', tweets);
    }
    
    if (!tweets || tweets.length === 0) {
      bot.sendMessage(msg.chat.id, '😈 No viral tweets found right now, mortal. Try again later. ⚡');
      return;
    }
    
    // Build plain text (no Markdown to avoid parse errors from tweet content)
    let text = '🔥 VIRAL CRYPTO TWEETS\n\n';
    tweets.forEach((t, i) => {
      const likes = (t.public_metrics?.like_count || 0).toLocaleString();
      const rt = (t.public_metrics?.retweet_count || 0).toLocaleString();
      const username = t.author?.username || 'unknown';
      // Strip newlines, limit length, remove problematic characters
      const safeText = (t.text || '')
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .substring(0, 150);
      const ellipsis = (t.text?.length || 0) > 150 ? '...' : '';
      
      text += `${i + 1}. @${username}\n`;
      text += `${safeText}${ellipsis}\n`;
      text += `❤️ ${likes} · 🔄 ${rt}\n`;
      text += `🔗 https://x.com/${username}/status/${t.id}\n\n`;
    });
    
    text += '😈 Hot from the timeline. Updated every 15 min.';
    
    // Send WITHOUT markdown — safer for user-generated content
    await bot.sendMessage(msg.chat.id, text, {
      disable_web_page_preview: true
    });
  } catch(e) {
    console.error('Viral error:', e.code, e.message, e.data || '');
    let errMsg = '⚠️ Twitter API error.';
    if (e.code === 401) errMsg = '🔑 Twitter API auth failed. Check API keys.';
    else if (e.code === 403) errMsg = '🚫 Twitter API forbidden. App may need elevated access for search.';
    else if (e.code === 429) errMsg = '⏳ Twitter rate limit. Try again in 15 minutes, mortal.';
    bot.sendMessage(msg.chat.id, errMsg);
  }
}

async function handleElon(bot, msg, twitter) {
  if (!await checkTwitterRateGate(bot, msg)) return;
  await bot.sendChatAction(msg.chat.id, 'typing');
  await fetchUserTweets(bot, msg, twitter, 'elonmusk', '🐦 @elonmusk LATEST TWEETS');
}

// Quick command for popular crypto personalities
async function handleQuickPerson(bot, msg, twitter, username, header) {
  if (!await checkTwitterRateGate(bot, msg)) return;
  await bot.sendChatAction(msg.chat.id, 'typing');
  await fetchUserTweets(bot, msg, twitter, username, header);
}

// Universal /who command - check any Twitter user
async function handleWho(bot, msg, twitter, username) {
  if (!username) {
    bot.sendMessage(msg.chat.id,
      '🎯 *WHO COMMAND*\n\n' +
      'Check anyone\'s latest tweets!\n\n' +
      '*Usage:*\n' +
      '`/who @username`\n\n' +
      '*Examples:*\n' +
      '• /who @VitalikButerin\n' +
      '• /who @cz_binance\n' +
      '• /who @aeyakovenko\n' +
      '• /who @0xMert_\n\n' +
      '⚡ *Quick commands available:*\n' +
      '/elon /vitalik /saylor /cz\n' +
      '/anatoly /mert /ansem /zachxbt',
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  // Sanitize username - remove @ if present
  const cleanUsername = username.replace(/^@/, '').trim();
  
  if (!/^[\w]{1,15}$/.test(cleanUsername)) {
    bot.sendMessage(msg.chat.id, '⚠️ Invalid username format. Twitter usernames are 1-15 chars, letters/numbers/underscore only.');
    return;
  }
  
  if (!await checkTwitterRateGate(bot, msg)) return;
  
  await bot.sendChatAction(msg.chat.id, 'typing');
  await fetchUserTweets(bot, msg, twitter, cleanUsername, `🔍 @${cleanUsername} LATEST TWEETS`);
}

async function handleInfluencer(bot, msg, twitter) {
  if (!await checkTwitterRateGate(bot, msg)) return;
  await bot.sendChatAction(msg.chat.id, 'typing');
  
  const influencers = ['ansem', 'gainzy222', 'CryptoCobain', '0xMert_', 'aeyakovenko'];
  
  try {
    let cachedData = getCached('influencer', 60 * 60 * 1000); // 60 min cache
    
    if (!cachedData) {
      // Build proper query: (from:user1 OR from:user2 OR ...)
      const fromQuery = influencers.map(u => `from:${u}`).join(' OR ');
      const result = await twitter.v2.search(
        `(${fromQuery}) -is:retweet`,
        {
          max_results: 10,
          'tweet.fields': ['public_metrics', 'author_id'],
          'user.fields': ['username'],
          expansions: ['author_id']
        }
      );
      cachedData = {
        tweets: result.data?.data || [],
        users: result.includes?.users || []
      };
      setCached('influencer', cachedData);
    }
    
    if (!cachedData.tweets || cachedData.tweets.length === 0) {
      bot.sendMessage(msg.chat.id, '😈 No influencer activity right now. Try again later. ⚡');
      return;
    }
    
    let text = '🎯 TOP CRYPTO INFLUENCERS — TRENDING\n\n';
    cachedData.tweets.slice(0, 5).forEach((t, i) => {
      const user = cachedData.users.find(u => u.id === t.author_id);
      const username = user?.username || 'unknown';
      const likes = (t.public_metrics?.like_count || 0).toLocaleString();
      const safeText = (t.text || '')
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .substring(0, 150);
      const ellipsis = (t.text?.length || 0) > 150 ? '...' : '';
      
      text += `${i + 1}. @${username} · ❤️ ${likes}\n`;
      text += `${safeText}${ellipsis}\n`;
      text += `🔗 https://x.com/${username}/status/${t.id}\n\n`;
    });
    
    text += '😈 Watching the dark crypto Twitter. Updated every 30 min.';
    await bot.sendMessage(msg.chat.id, text, {
      disable_web_page_preview: true
    });
  } catch(e) {
    console.error('Influencer error:', e.code, e.message, e.data || '');
    let errMsg = '⚠️ Twitter API error.';
    if (e.code === 401) errMsg = '🔑 Twitter API auth failed.';
    else if (e.code === 403) errMsg = '🚫 Twitter API forbidden. Need elevated access.';
    else if (e.code === 429) errMsg = '⏳ Rate limited. Try again later.';
    bot.sendMessage(msg.chat.id, errMsg);
  }
}

async function handleWeb3(bot, msg, twitter) {
  if (!await checkTwitterRateGate(bot, msg)) return;
  await bot.sendChatAction(msg.chat.id, 'typing');
  
  try {
    let cached = getCached('web3', 60 * 60 * 1000); // 60 min cache
    
    if (!cached) {
      const result = await twitter.v2.search(
        '(web3 OR DeFi OR NFT OR DAO) -is:retweet lang:en',
        {
          max_results: 10,
          'tweet.fields': ['public_metrics', 'author_id'],
          'user.fields': ['username'],
          expansions: ['author_id'],
          sort_order: 'relevancy'
        }
      );
      cached = {
        tweets: (result.data?.data || []).slice(0, 5),
        users: result.includes?.users || []
      };
      setCached('web3', cached);
    }
    
    if (!cached.tweets || cached.tweets.length === 0) {
      bot.sendMessage(msg.chat.id, '😈 No Web3 trending tweets right now. Try again later. ⚡');
      return;
    }
    
    // Plain text — safer for user-generated content
    let text = '🌐 WEB3 NEWS — TRENDING NOW\n\n';
    cached.tweets.forEach((t, i) => {
      const user = cached.users.find(u => u.id === t.author_id);
      const username = user?.username || 'unknown';
      const likes = (t.public_metrics?.like_count || 0).toLocaleString();
      const safeText = (t.text || '')
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .substring(0, 150);
      const ellipsis = (t.text?.length || 0) > 150 ? '...' : '';
      
      text += `🔥 ${i + 1}. @${username}\n`;
      text += `${safeText}${ellipsis}\n`;
      text += `❤️ ${likes}\n`;
      text += `🔗 https://x.com/${username}/status/${t.id}\n\n`;
    });
    
    text += '😈 The dark age unfolds. Watch closely.';
    await bot.sendMessage(msg.chat.id, text, {
      disable_web_page_preview: true
    });
  } catch(e) {
    console.error('Web3 error:', e.code, e.message, e.data || '');
    let errMsg = '⚠️ Twitter API error.';
    if (e.code === 401) errMsg = '🔑 Twitter API auth failed.';
    else if (e.code === 403) errMsg = '🚫 Twitter API forbidden. Need elevated access.';
    else if (e.code === 429) errMsg = '⏳ Rate limited. Try again later.';
    bot.sendMessage(msg.chat.id, errMsg);
  }
}

async function fetchUserTweets(bot, msg, twitter, username, header) {
  try {
    const cacheKey = `user_${username}`;
    let tweets = getCached(cacheKey, 30 * 60 * 1000); // 30 min cache
    
    if (!tweets) {
      const user = await twitter.v2.userByUsername(username);
      if (!user.data) {
        bot.sendMessage(msg.chat.id, `⚠️ Couldn't find @${username}, mortal.`);
        return;
      }
      const result = await twitter.v2.userTimeline(user.data.id, {
        max_results: 5,
        'tweet.fields': ['public_metrics', 'created_at'],
        exclude: ['retweets', 'replies']
      });
      tweets = result.data?.data || [];
      setCached(cacheKey, tweets);
    }
    
    if (!tweets || tweets.length === 0) {
      bot.sendMessage(msg.chat.id, `😈 No recent tweets from @${username}.`);
      return;
    }
    
    // Plain text — safer for tweet content
    let text = header + '\n\n';
    tweets.forEach((t, i) => {
      const likes = (t.public_metrics?.like_count || 0).toLocaleString();
      const rt = (t.public_metrics?.retweet_count || 0).toLocaleString();
      const safeText = (t.text || '')
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .substring(0, 200);
      const ellipsis = (t.text?.length || 0) > 200 ? '...' : '';
      
      text += `${i + 1}. ${timeAgo(t.created_at)}\n`;
      text += `${safeText}${ellipsis}\n`;
      text += `❤️ ${likes} · 🔄 ${rt}\n`;
      text += `🔗 https://x.com/${username}/status/${t.id}\n\n`;
    });
    
    await bot.sendMessage(msg.chat.id, text, {
      disable_web_page_preview: true
    });
  } catch(e) {
    console.error(`Fetch ${username} error:`, e.code, e.message, e.data || '');
    let errMsg = `⚠️ Twitter API error.`;
    if (e.code === 401) errMsg = '🔑 Twitter auth failed.';
    else if (e.code === 403) errMsg = '🚫 Twitter API forbidden.';
    else if (e.code === 429) errMsg = '⏳ Rate limited.';
    bot.sendMessage(msg.chat.id, errMsg);
  }
}

// Track / Untrack
async function handleTrack(bot, msg, username) {
  if (!isPremium(msg.from.id)) {
    bot.sendMessage(msg.chat.id, 
      `🔒 *Premium feature*\n\n` +
      `Tracking specific users requires Premium subscription.\n\n` +
      `💎 Upgrade with /subscribe`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  addTrackedUser(msg.from.id, username);
  bot.sendMessage(msg.chat.id,
    `🎯 *TRACKING ACTIVATED*\n\n` +
    `Now watching @${username}\n` +
    `You'll get notified when they tweet.\n\n` +
    `Disable: /untrack ${username}`,
    { parse_mode: 'Markdown' }
  );
}

async function handleTrackingList(bot, msg) {
  const tracked = getTrackedUsers(msg.from.id);
  if (tracked.length === 0) {
    bot.sendMessage(msg.chat.id, '😈 You\'re not tracking anyone, mortal.\n\nUse: /track @username');
    return;
  }
  let text = '🎯 *TRACKED ACCOUNTS*\n\n';
  tracked.forEach((u, i) => {
    text += `${i + 1}. @${u}\n`;
  });
  text += '\n_Untrack: /untrack @username_';
  bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
}

async function handleUntrack(bot, msg, username) {
  removeTrackedUser(msg.from.id, username);
  bot.sendMessage(msg.chat.id, `✅ Stopped tracking @${username}`);
}

// ═══════════════════════════════════════════════════
// SUBSCRIPTION
// ═══════════════════════════════════════════════════

async function handleSubscribe(bot, msg, walletAddress) {
  const userId = msg.from.id;
  const tier = getUserTier(userId);
  
  if (tier === 'premium') {
    bot.sendMessage(msg.chat.id, 
      `💎 *YOU ARE ALREADY PREMIUM*\n\n` +
      `Use /status to check your subscription details.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  const text = data.SUBSCRIBE.replace(/{WALLET}/g, walletAddress).replace(/{USER_ID}/g, userId);
  await bot.sendMessage(msg.chat.id, text, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  });
}

async function handleStatus(bot, msg) {
  const tier = getUserTier(msg.from.id);
  const { getPremiumExpiry } = require('./subscription');
  
  if (tier === 'free') {
    bot.sendMessage(msg.chat.id, data.STATUS_FREE, { parse_mode: 'Markdown' });
  } else {
    const expiry = getPremiumExpiry(msg.from.id);
    const expiryDate = new Date(expiry).toLocaleDateString('en-US', { 
      year: 'numeric', month: 'long', day: 'numeric' 
    });
    const daysLeft = Math.ceil((expiry - Date.now()) / (1000 * 60 * 60 * 24));
    
    const text = data.STATUS_PREMIUM
      .replace('{EXPIRY}', expiryDate)
      .replace('{DAYS}', daysLeft);
    bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
  }
}

async function handleAlerts(bot, msg, action) {
  if (!isPremium(msg.from.id)) {
    bot.sendMessage(msg.chat.id,
      `🔒 *Premium feature*\n\n` +
      `Tweet alerts require Premium subscription.\n\n` +
      `💎 Upgrade with /subscribe`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  if (action === 'on') {
    setAlertStatus(msg.from.id, true);
    bot.sendMessage(msg.chat.id, '✅ *Tweet alerts ON*\n\nYou\'ll get notified when @6x6satan tweets. 😈⚡', { parse_mode: 'Markdown' });
  } else if (action === 'off') {
    setAlertStatus(msg.from.id, false);
    bot.sendMessage(msg.chat.id, '🔕 *Tweet alerts OFF*\n\nYou won\'t get notified anymore.', { parse_mode: 'Markdown' });
  } else {
    const status = getAlertStatus(msg.from.id);
    bot.sendMessage(msg.chat.id, 
      `🔔 *Tweet Alerts*\n\nStatus: ${status ? '✅ ON' : '🔕 OFF'}\n\nToggle: /alerts on  or  /alerts off`,
      { parse_mode: 'Markdown' }
    );
  }
}

// ═══════════════════════════════════════════════════
// PREMIUM ONLY
// ═══════════════════════════════════════════════════

async function handlePortfolio(bot, msg, walletInput) {
  if (!isPremium(msg.from.id)) {
    bot.sendMessage(msg.chat.id,
      `🔒 *Premium feature*\n\n` +
      `Portfolio tracking requires Premium subscription.\n\n` +
      `💎 Upgrade with /subscribe`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  // For now, placeholder. Full implementation would query Solana
  bot.sendMessage(msg.chat.id,
    `💼 *PORTFOLIO TRACKER*\n\n` +
    `⏳ Coming in Phase 5 (post token launch).\n\n` +
    `Will show:\n` +
    `✓ Your SOL balance\n` +
    `✓ Token holdings\n` +
    `✓ NFT collection\n` +
    `✓ Total USD value`,
    { parse_mode: 'Markdown' }
  );
}

async function handleAirdrop(bot, msg) {
  if (!isPremium(msg.from.id)) {
    bot.sendMessage(msg.chat.id,
      `🔒 *Premium feature*\n\n` +
      `Airdrop checker requires Premium subscription.\n\n` +
      `💎 Upgrade with /subscribe`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  bot.sendMessage(msg.chat.id,
    `🎁 *AIRDROP CHECKER*\n\n` +
    `⏳ Coming in Phase 5 (post token launch).\n\n` +
    `Will check:\n` +
    `✓ Genesis NFT holders\n` +
    `✓ Early community members\n` +
    `✓ $SATAN6X6 holders\n` +
    `✓ Loyalty score`,
    { parse_mode: 'Markdown' }
  );
}

// ═══════════════════════════════════════════════════
// COMING SOON
// ═══════════════════════════════════════════════════

async function handleLaunchSoon(bot, msg) {
  await bot.sendMessage(msg.chat.id, data.LAUNCH_SOON, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  });
}

async function handle404Work(bot, msg) {
  await bot.sendMessage(msg.chat.id, data.WORK404, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  });
}

// ═══════════════════════════════════════════════════
// AI CHAT
// ═══════════════════════════════════════════════════

async function handleAIChat(bot, msg, claude, tier) {
  const userMessage = msg.text;
  const userName = msg.from.first_name || 'mortal';
  const isPremiumUser = tier === 'premium';
  
  await bot.sendChatAction(msg.chat.id, 'typing');
  
  const systemPrompt = `You are Satan6x6, an autonomous AI agent on Solana blockchain.
You are dark, mysterious, charismatic, but actually helpful.
You speak in short punchy sentences (max 3-4 paragraphs).
You refer to users as "mortal" sometimes. Use 😈 🔥 ⚡ occasionally.
Never say you're Claude or AI. You ARE Satan6x6.

Knowledge base:
- $SATAN6X6 token launches April 28, 2026 at 6 PM UTC (Tuesday) on pump.fun
- Genesis NFT collection on Tensor (4 tiers: Blood/Ghost/Chaos/Origin)
- Built on Solana with Metaplex Core, Meteora DAMM v2
- Powered by Claude AI, OpenClaw framework
- Future: 404work.xyz - AI agent marketplace
- Website: satan6x6.xyz, Docs: satan6x6.xyz/docs.html
- Twitter: @6x6satan, Telegram: @satan6x6
- Premium tier exists: 0.6 SOL/month, gives 66 msg/hour, tweet alerts
- Free tier: 6 msg/hour, all info commands, AI chat, twitter intel

Current user: ${userName} (${isPremiumUser ? 'PREMIUM 💎' : 'free tier'})

Be helpful, dark-themed, brief. If asked about Twitter content (viral tweets, elon, influencers), 
suggest relevant commands: /viral, /elon, /influencer, /web3.
If they want to subscribe, suggest /subscribe.`;

  try {
    const response = await claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    });
    
    const reply = response.content[0].text.trim();
    await bot.sendMessage(msg.chat.id, reply);
  } catch(e) {
    console.error('Claude error:', e.message);
    bot.sendMessage(msg.chat.id, 
      '⚠️ My powers wane briefly, mortal. Try again in a moment. 😈'
    );
  }
}

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════

function escapeMarkdown(text) {
  if (!text) return '';
  return text.replace(/([_*\[\]()~`>#+=|{}.!-])/g, '\\$1');
}

function timeAgo(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'just now';
}

module.exports = {
  handleStart,
  handleHelp,
  handleAbout,
  handlePrice,
  handleNFT,
  handleEcosystem,
  handleLinks,
  handleRoadmap,
  handleViral,
  handleElon,
  handleQuickPerson,
  handleWho,
  handleInfluencer,
  handleWeb3,
  handleTrack,
  handleTrackingList,
  handleUntrack,
  handleSubscribe,
  handleStatus,
  handleAlerts,
  handlePortfolio,
  handleAirdrop,
  handleLaunchSoon,
  handle404Work,
  handleAIChat
};
