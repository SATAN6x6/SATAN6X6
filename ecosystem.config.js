/**
 * PM2 Ecosystem Config — Satan6x6 Public Bot
 * 
 * Usage: pm2 start ecosystem.config.js
 *        pm2 logs satan6x6-public
 *        pm2 restart satan6x6-public
 * 
 * Logs are written to ./logs/ (relative to working directory).
 * Override via DATA_DIR environment variable if needed.
 */

const path = require('path');
const dataDir = process.env.DATA_DIR || __dirname;

module.exports = {
  apps: [
    {
      name: 'satan6x6-public',
      script: 'master-public.js',
      cwd: dataDir,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: path.join(dataDir, 'logs/error-public.log'),
      out_file: path.join(dataDir, 'logs/out-public.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
