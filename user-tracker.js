/**
 * Satan6x6 Public Bot — User Stats Tracker
 * 
 * Lightweight tracking system that records:
 * - Every user who interacts with the bot
 * - Total message count per user
 * - Last seen timestamp
 * - First seen timestamp
 * 
 * Designed to be future-proof — easy to upgrade to admin dashboard
 * (Opsi A or B) by just adding more queries on this same data.
 */

const fs = require('fs');
const path = require('path');

// Data directory — defaults to current dir; override via DATA_DIR env var
const DATA_DIR = process.env.DATA_DIR || __dirname;
const STATS_FILE = path.join(DATA_DIR, 'users-stats.json');
const COMMANDS_FILE = path.join(DATA_DIR, 'commands-stats.json');

// ─── INIT FILES ─────────────────────────────────────
function initFile(file, defaultValue = {}) {
  if (!fs.existsSync(file)) {
    try {
      fs.writeFileSync(file, JSON.stringify(defaultValue, null, 2));
      console.log(`✓ Created stats file: ${file}`);
    } catch (e) {
      console.error(`Failed to init stats file ${file}:`, e.message);
    }
  }
}

initFile(STATS_FILE, {});
initFile(COMMANDS_FILE, {});

// ─── HELPERS ────────────────────────────────────────
function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (e) {
    console.error(`Failed to read ${file}:`, e.message);
    return {};
  }
}

function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error(`Failed to write ${file}:`, e.message);
    return false;
  }
}

// ─── CORE TRACKING FUNCTIONS ────────────────────────

/**
 * Track a user interaction
 * Called automatically on every message
 */
function trackUser(msg) {
  if (!msg || !msg.from) return;
  
  const userId = String(msg.from.id);
  const now = Date.now();
  
  const stats = readJSON(STATS_FILE);
  
  if (!stats[userId]) {
    // First time seeing this user
    stats[userId] = {
      id: userId,
      username: msg.from.username || null,
      first_name: msg.from.first_name || null,
      last_name: msg.from.last_name || null,
      language_code: msg.from.language_code || null,
      first_seen: now,
      last_seen: now,
      message_count: 1
    };
  } else {
    // Update existing
    stats[userId].last_seen = now;
    stats[userId].message_count = (stats[userId].message_count || 0) + 1;
    
    // Refresh username/name if changed (users can update these in Telegram)
    if (msg.from.username) stats[userId].username = msg.from.username;
    if (msg.from.first_name) stats[userId].first_name = msg.from.first_name;
  }
  
  writeJSON(STATS_FILE, stats);
}

/**
 * Track a command usage
 * Called when a user runs /command
 */
function trackCommand(commandName) {
  if (!commandName) return;
  
  const cmd = commandName.replace(/^\//, '').toLowerCase();
  const cmdStats = readJSON(COMMANDS_FILE);
  
  cmdStats[cmd] = (cmdStats[cmd] || 0) + 1;
  
  writeJSON(COMMANDS_FILE, cmdStats);
}

// ─── STATS QUERY FUNCTIONS ──────────────────────────

/**
 * Get summary stats for /stats admin command
 */
function getStats() {
  const users = readJSON(STATS_FILE);
  const commands = readJSON(COMMANDS_FILE);
  const userIds = Object.keys(users);
  
  const totalUsers = userIds.length;
  let totalMessages = 0;
  let activeToday = 0;    // active in last 24 hours
  let activeWeek = 0;     // active in last 7 days
  let newToday = 0;       // first_seen in last 24 hours
  
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const week = 7 * day;
  
  for (const userId of userIds) {
    const u = users[userId];
    totalMessages += u.message_count || 0;
    
    if (now - u.last_seen < day) activeToday++;
    if (now - u.last_seen < week) activeWeek++;
    if (now - u.first_seen < day) newToday++;
  }
  
  // Sort commands by usage (top 5)
  const topCommands = Object.entries(commands)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  // Sort users by message count (top 5)
  const topUsers = userIds
    .map(id => users[id])
    .sort((a, b) => (b.message_count || 0) - (a.message_count || 0))
    .slice(0, 5);
  
  return {
    totalUsers,
    totalMessages,
    activeToday,
    activeWeek,
    newToday,
    topCommands,
    topUsers
  };
}

/**
 * Format stats as human-readable text for Telegram
 */
function formatStatsMessage() {
  const s = getStats();
  
  let msg = '📊 *SATAN6X6 BOT STATS*\n';
  msg += '━━━━━━━━━━━━━━━━━━━━━━\n\n';
  
  msg += '*👥 USERS*\n';
  msg += `• Total users: *${s.totalUsers}*\n`;
  msg += `• Active today (24h): *${s.activeToday}*\n`;
  msg += `• Active this week: *${s.activeWeek}*\n`;
  msg += `• New today: *${s.newToday}*\n\n`;
  
  msg += '*💬 MESSAGES*\n';
  msg += `• Total messages: *${s.totalMessages.toLocaleString()}*\n`;
  
  const avg = s.totalUsers > 0 ? Math.round(s.totalMessages / s.totalUsers) : 0;
  msg += `• Avg per user: *${avg}*\n\n`;
  
  if (s.topCommands.length > 0) {
    msg += '*🔥 TOP COMMANDS*\n';
    s.topCommands.forEach(([cmd, count], i) => {
      const medal = ['🥇', '🥈', '🥉', '🏅', '🏅'][i];
      msg += `${medal} /${cmd} — ${count}x\n`;
    });
    msg += '\n';
  }
  
  if (s.topUsers.length > 0) {
    msg += '*⭐ TOP USERS*\n';
    s.topUsers.forEach((u, i) => {
      const medal = ['🥇', '🥈', '🥉', '🏅', '🏅'][i];
      const name = u.username ? `@${u.username}` : (u.first_name || `User ${u.id.slice(0, 6)}`);
      msg += `${medal} ${name} — ${u.message_count} msg\n`;
    });
    msg += '\n';
  }
  
  msg += `_Updated: ${new Date().toLocaleString('en-US', { timeZone: 'UTC' })} UTC_`;
  
  return msg;
}

// ─── EXPORTS ────────────────────────────────────────
module.exports = {
  trackUser,
  trackCommand,
  getStats,
  formatStatsMessage
};
