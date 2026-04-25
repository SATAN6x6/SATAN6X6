/**
 * Rate Limiter & Tier System
 * - AI chat: 6 free/hour, 66 premium/hour
 * - Twitter commands: 10 free/3-hour, unlimited premium
 * - Info commands: unlimited (no rate limit)
 */

const fs = require('fs');
const path = require('path');

const PREMIUM_FILE = require('path').join(process.env.DATA_DIR || __dirname, 'premium-users.json');

// In-memory rate limit caches (cleared every restart, that's OK)
let aiChatCache = {};        // for AI chat (6/hour)
let twitterCmdCache = {};    // for twitter commands (10/3-hour)

// Cleanup old timestamps every minute
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  const threeHoursAgo = Date.now() - (3 * 60 * 60 * 1000);
  
  for (const userId in aiChatCache) {
    aiChatCache[userId] = aiChatCache[userId].filter(ts => ts > oneHourAgo);
    if (aiChatCache[userId].length === 0) delete aiChatCache[userId];
  }
  for (const userId in twitterCmdCache) {
    twitterCmdCache[userId] = twitterCmdCache[userId].filter(ts => ts > threeHoursAgo);
    if (twitterCmdCache[userId].length === 0) delete twitterCmdCache[userId];
  }
}, 60 * 1000);

// ─── PREMIUM USERS ──────────────────────────────────

function loadPremiumUsers() {
  try {
    if (fs.existsSync(PREMIUM_FILE)) {
      return JSON.parse(fs.readFileSync(PREMIUM_FILE, 'utf-8'));
    }
  } catch(e) {
    console.error('Error loading premium users:', e.message);
  }
  return {};
}

function isPremium(userId) {
  const users = loadPremiumUsers();
  const user = users[userId];
  if (!user) return false;
  if (user.expires < Date.now()) return false;
  return true;
}

function getUserTier(userId) {
  return isPremium(userId) ? 'premium' : 'free';
}

// ─── AI CHAT RATE LIMIT (per hour) ──────────────────

function checkRateLimit(userId, limit) {
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);
  
  if (!aiChatCache[userId]) {
    aiChatCache[userId] = [];
  }
  
  aiChatCache[userId] = aiChatCache[userId].filter(ts => ts > oneHourAgo);
  
  if (aiChatCache[userId].length >= limit) {
    const oldestTs = Math.min(...aiChatCache[userId]);
    const resetMs = (oldestTs + 60 * 60 * 1000) - now;
    const resetIn = Math.ceil(resetMs / (60 * 1000));
    return { ok: false, resetIn: Math.max(1, resetIn) };
  }
  
  aiChatCache[userId].push(now);
  return { ok: true, remaining: limit - aiChatCache[userId].length };
}

// ─── TWITTER COMMAND RATE LIMIT (per 3 hours) ───────

function checkTwitterLimit(userId) {
  // Premium = unlimited Twitter commands
  if (isPremium(userId)) {
    return { ok: true, premium: true };
  }
  
  const limit = 10; // free tier: 10 per 3 hours
  const now = Date.now();
  const threeHoursAgo = now - (3 * 60 * 60 * 1000);
  
  if (!twitterCmdCache[userId]) {
    twitterCmdCache[userId] = [];
  }
  
  twitterCmdCache[userId] = twitterCmdCache[userId].filter(ts => ts > threeHoursAgo);
  
  if (twitterCmdCache[userId].length >= limit) {
    const oldestTs = Math.min(...twitterCmdCache[userId]);
    const resetMs = (oldestTs + 3 * 60 * 60 * 1000) - now;
    const resetMinutes = Math.ceil(resetMs / (60 * 1000));
    const hours = Math.floor(resetMinutes / 60);
    const mins = resetMinutes % 60;
    const resetText = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    return { ok: false, resetIn: resetText, used: limit, limit };
  }
  
  twitterCmdCache[userId].push(now);
  return { ok: true, remaining: limit - twitterCmdCache[userId].length, used: twitterCmdCache[userId].length, limit };
}

module.exports = {
  isPremium,
  getUserTier,
  checkRateLimit,
  checkTwitterLimit
};
