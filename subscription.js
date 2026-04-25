/**
 * Subscription System
 * - Auto-detect SOL payments via Helius RPC
 * - Premium activation
 * - User tracking & alerts settings
 */

const fs = require('fs');
const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');

const PREMIUM_FILE = require('path').join(process.env.DATA_DIR || __dirname, 'premium-users.json');
const TRACKED_FILE = require('path').join(process.env.DATA_DIR || __dirname, 'tracked-users.json');
const ALERTS_FILE = require('path').join(process.env.DATA_DIR || __dirname, 'alert-settings.json');
const PROCESSED_FILE = require('path').join(process.env.DATA_DIR || __dirname, 'processed-tx.json');

const SUBSCRIPTION_PRICE = 0.6; // SOL
const SUBSCRIPTION_DAYS = 30;
const SUBSCRIPTION_WALLET = process.env.SUBSCRIPTION_WALLET;
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;

let connection = null;

// ─── INIT ──────────────────────────────────────────

function initSubscription() {
  // Create files if not exist
  for (const file of [PREMIUM_FILE, TRACKED_FILE, ALERTS_FILE, PROCESSED_FILE]) {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, '{}');
    }
  }
  console.log('💎 Subscription system initialized');
}

// ─── DATA HELPERS ──────────────────────────────────

function loadJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch(e) {
    return {};
  }
}

function saveJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch(e) {
    console.error(`Failed to save ${file}:`, e.message);
  }
}

// ─── PREMIUM USERS ──────────────────────────────────

function activatePremium(userId, txSignature) {
  const users = loadJSON(PREMIUM_FILE);
  const now = Date.now();
  const expires = now + (SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000);
  
  if (users[userId] && users[userId].expires > now) {
    // Extend existing subscription
    users[userId].expires = users[userId].expires + (SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000);
    users[userId].txHistory = users[userId].txHistory || [];
    users[userId].txHistory.push({ tx: txSignature, time: now });
  } else {
    // New subscription
    users[userId] = {
      activated: now,
      expires: expires,
      txHistory: [{ tx: txSignature, time: now }]
    };
  }
  
  saveJSON(PREMIUM_FILE, users);
  return users[userId].expires;
}

function getPremiumExpiry(userId) {
  const users = loadJSON(PREMIUM_FILE);
  return users[userId]?.expires || 0;
}

function getAllPremiumUsers() {
  const users = loadJSON(PREMIUM_FILE);
  const now = Date.now();
  return Object.entries(users)
    .filter(([_, data]) => data.expires > now)
    .map(([userId, _]) => parseInt(userId));
}

// ─── TWEET ALERT SETTINGS ──────────────────────────

function getAlertStatus(userId) {
  const settings = loadJSON(ALERTS_FILE);
  // Default: ON for premium users
  return settings[userId] !== false;
}

function setAlertStatus(userId, status) {
  const settings = loadJSON(ALERTS_FILE);
  settings[userId] = status;
  saveJSON(ALERTS_FILE, settings);
}

// ─── TRACKED USERS (Premium feature) ───────────────

function getTrackedUsers(userId) {
  const tracked = loadJSON(TRACKED_FILE);
  return tracked[userId] || [];
}

function addTrackedUser(userId, twitterUsername) {
  const tracked = loadJSON(TRACKED_FILE);
  if (!tracked[userId]) tracked[userId] = [];
  if (!tracked[userId].includes(twitterUsername)) {
    tracked[userId].push(twitterUsername);
    saveJSON(TRACKED_FILE, tracked);
  }
}

function removeTrackedUser(userId, twitterUsername) {
  const tracked = loadJSON(TRACKED_FILE);
  if (tracked[userId]) {
    tracked[userId] = tracked[userId].filter(u => u !== twitterUsername);
    saveJSON(TRACKED_FILE, tracked);
  }
}

// ─── PAYMENT MONITOR ───────────────────────────────

async function startPaymentMonitor(bot) {
  if (!connection) {
    connection = new Connection(HELIUS_RPC, 'confirmed');
  }
  
  console.log(`💰 Monitoring wallet: ${SUBSCRIPTION_WALLET}`);
  console.log(`💎 Subscription: ${SUBSCRIPTION_PRICE} SOL = ${SUBSCRIPTION_DAYS} days`);
  
  // Check for new payments every 30 seconds
  setInterval(() => checkNewPayments(bot), 30000);
  
  // Initial check
  checkNewPayments(bot);
}

async function checkNewPayments(bot) {
  try {
    const walletPubkey = new PublicKey(SUBSCRIPTION_WALLET);
    
    // Get recent signatures (last 25 transactions)
    const signatures = await connection.getSignaturesForAddress(walletPubkey, { limit: 25 });
    
    const processed = loadJSON(PROCESSED_FILE);
    const newProcessed = { ...processed };
    
    for (const sigInfo of signatures) {
      const sig = sigInfo.signature;
      
      // Skip already processed
      if (processed[sig]) continue;
      
      // Mark as processed (even if not subscription, to skip next time)
      newProcessed[sig] = Date.now();
      
      try {
        const tx = await connection.getParsedTransaction(sig, { maxSupportedTransactionVersion: 0 });
        if (!tx || !tx.meta || tx.meta.err) continue;
        
        // Find SOL transfer to our wallet
        const accountKeys = tx.transaction.message.accountKeys.map(k => k.pubkey?.toString() || k.toString());
        const ourIdx = accountKeys.indexOf(SUBSCRIPTION_WALLET);
        if (ourIdx < 0) continue;
        
        // Calculate received amount
        const received = (tx.meta.postBalances[ourIdx] - tx.meta.preBalances[ourIdx]) / LAMPORTS_PER_SOL;
        if (received <= 0) continue;
        
        // Check exact amount (0.6 SOL)
        if (Math.abs(received - SUBSCRIPTION_PRICE) > 0.01) {
          console.log(`⚠ Payment ${received} SOL doesn't match subscription price ${SUBSCRIPTION_PRICE} SOL (sig: ${sig.substring(0, 16)}...)`);
          continue;
        }
        
        // Look for memo with user ID
        let userId = null;
        const memos = tx.transaction.message.instructions
          .filter(i => i.programId?.toString() === 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr' || 
                       i.program === 'spl-memo')
          .map(i => i.parsed || i.data);
        
        for (const memo of memos) {
          const memoStr = typeof memo === 'string' ? memo : (memo?.memo || JSON.stringify(memo));
          const match = memoStr.match(/user-(\d+)/);
          if (match) {
            userId = parseInt(match[1]);
            break;
          }
        }
        
        if (!userId) {
          console.log(`⚠ Payment without valid memo, sig: ${sig.substring(0, 16)}...`);
          continue;
        }
        
        // Activate premium!
        const expires = activatePremium(userId, sig);
        const expiryDate = new Date(expires).toLocaleDateString('en-US', { 
          year: 'numeric', month: 'long', day: 'numeric' 
        });
        
        console.log(`✅ Premium activated for user ${userId} (tx: ${sig.substring(0, 16)}...)`);
        
        // Notify user
        try {
          await bot.sendMessage(userId,
            `💎 *PREMIUM ACTIVATED!*\n\n` +
            `Welcome to the dark side, mortal. 😈⚡\n\n` +
            `✅ Payment received: ${received.toFixed(2)} SOL\n` +
            `✅ Premium active until: *${expiryDate}*\n` +
            `✅ Rate limit: 66 messages/hour\n` +
            `✅ Tweet alerts: ENABLED\n\n` +
            `🔗 Tx: \`${sig.substring(0, 32)}...\`\n\n` +
            `🎁 *What's unlocked:*\n` +
            `• Real-time @6x6satan tweet alerts\n` +
            `• /portfolio /airdrop access\n` +
            `• /track Twitter accounts\n` +
            `• Priority response queue\n\n` +
            `Type /help to see all premium features.\n` +
            `Type /alerts to manage notifications.\n\n` +
            `Welcome aboard. The dark age awaits. 🦇`,
            { parse_mode: 'Markdown' }
          );
        } catch(notifyErr) {
          console.error(`Failed to notify user ${userId}:`, notifyErr.message);
        }
      } catch(txErr) {
        // Skip parsing errors silently
      }
    }
    
    // Save processed signatures
    saveJSON(PROCESSED_FILE, newProcessed);
    
  } catch(e) {
    console.error('Payment monitor error:', e.message);
  }
}

module.exports = {
  initSubscription,
  startPaymentMonitor,
  activatePremium,
  getPremiumExpiry,
  getAllPremiumUsers,
  getAlertStatus,
  setAlertStatus,
  getTrackedUsers,
  addTrackedUser,
  removeTrackedUser
};
