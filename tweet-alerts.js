/**
 * Tweet Alerts System
 * Polls @6x6satan timeline every 30s
 * Notifies all premium subscribers when new tweet detected
 */

const fs = require('fs');
const { getAllPremiumUsers, getAlertStatus, getTrackedUsers } = require('./subscription');

const SATAN_USERNAME = '6x6satan';
const POLL_INTERVAL = 30 * 1000; // 30 seconds
const LAST_TWEET_FILE = require('path').join(process.env.DATA_DIR || __dirname, 'last-satan-tweet.json');

let satanUserId = null; // Twitter user ID, fetched once

// ─── HELPER ────────────────────────────────────────

function loadLastTweet() {
  try {
    return JSON.parse(fs.readFileSync(LAST_TWEET_FILE, 'utf-8'));
  } catch(e) {
    return { lastId: null, satanLastId: null, trackedUsers: {} };
  }
}

function saveLastTweet(data) {
  try {
    fs.writeFileSync(LAST_TWEET_FILE, JSON.stringify(data, null, 2));
  } catch(e) {
    console.error('Failed to save last tweet:', e.message);
  }
}

// ─── START ─────────────────────────────────────────

function startTweetAlerts(bot, twitter) {
  console.log(`🐦 Tweet alerts: monitoring @${SATAN_USERNAME} every ${POLL_INTERVAL/1000}s`);
  
  // Get Satan's Twitter ID first
  twitter.v2.userByUsername(SATAN_USERNAME).then(user => {
    if (user.data) {
      satanUserId = user.data.id;
      console.log(`✅ @${SATAN_USERNAME} ID: ${satanUserId}`);
      
      // Initialize last tweet ID if not exists
      const data = loadLastTweet();
      if (!data.satanLastId) {
        // Get latest tweet to seed (don't notify for old tweets)
        twitter.v2.userTimeline(satanUserId, {
          max_results: 5,
          exclude: ['retweets', 'replies']
        }).then(result => {
          const tweets = result.data?.data || [];
          if (tweets.length > 0) {
            data.satanLastId = tweets[0].id;
            saveLastTweet(data);
            console.log(`🌱 Seeded last tweet ID: ${tweets[0].id}`);
          }
        }).catch(e => console.error('Seed error:', e.message));
      }
    } else {
      console.error(`❌ Could not find @${SATAN_USERNAME} on Twitter`);
    }
  }).catch(e => {
    console.error('Twitter user lookup error:', e.message);
  });
  
  // Start polling
  setInterval(() => checkSatanTweets(bot, twitter), POLL_INTERVAL);
}

// ─── CHECK SATAN TWEETS ────────────────────────────

async function checkSatanTweets(bot, twitter) {
  if (!satanUserId) return; // wait for ID lookup
  
  try {
    const data = loadLastTweet();
    
    const result = await twitter.v2.userTimeline(satanUserId, {
      max_results: 5,
      'tweet.fields': ['public_metrics', 'created_at', 'attachments'],
      'media.fields': ['url', 'preview_image_url'],
      expansions: ['attachments.media_keys'],
      exclude: ['retweets', 'replies'],
      since_id: data.satanLastId || undefined
    });
    
    const tweets = result.data?.data || [];
    if (tweets.length === 0) return;
    
    console.log(`🆕 Found ${tweets.length} new Satan tweet(s)`);
    
    // Process oldest first (so notification order is chronological)
    const newTweets = tweets.reverse();
    
    for (const tweet of newTweets) {
      await notifyPremiumUsers(bot, tweet);
    }
    
    // Update last tweet ID (use newest = first in original order)
    data.satanLastId = tweets[tweets.length - 1].id; // last after reverse = newest
    saveLastTweet(data);
    
  } catch(e) {
    if (e.code !== 429) { // rate limit, expected sometimes
      console.error('Satan tweets check error:', e.message);
    }
  }
}

// ─── NOTIFY PREMIUM USERS ──────────────────────────

async function notifyPremiumUsers(bot, tweet) {
  const premiumUsers = getAllPremiumUsers();
  if (premiumUsers.length === 0) {
    console.log('No premium users to notify');
    return;
  }
  
  const tweetText = tweet.text || '';
  const tweetId = tweet.id;
  const url = `https://x.com/${SATAN_USERNAME}/status/${tweetId}`;
  
  // Truncate long tweets for preview
  const preview = tweetText.length > 250 
    ? tweetText.substring(0, 250) + '...' 
    : tweetText;
  
  const message = 
    `🚨 *SATAN TWEETED — PREMIUM ALERT*\n\n` +
    `😈 _${preview}_\n\n` +
    `🐦 [View tweet](${url})\n` +
    `🔄 RT first to boost reach!\n\n` +
    `⏰ Posted just now\n` +
    `🎯 You're among the FIRST to see this\n\n` +
    `_Disable: /alerts off_`;
  
  let sent = 0;
  let failed = 0;
  
  for (const userId of premiumUsers) {
    // Check if user has alerts enabled
    if (!getAlertStatus(userId)) continue;
    
    try {
      await bot.sendMessage(userId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: false
      });
      sent++;
      
      // Telegram rate limit: max 30 msg/sec to same bot
      // Sleep 50ms between sends = max 20/sec, safe
      await new Promise(r => setTimeout(r, 50));
    } catch(e) {
      failed++;
      // User might have blocked bot, that's OK
    }
  }
  
  console.log(`📨 Tweet ${tweetId.substring(0, 16)}... notified ${sent}/${premiumUsers.length} premium users (${failed} failed)`);
}

module.exports = {
  startTweetAlerts
};
