'use strict';
const fs = require('fs');
const path = require('path');

// Minimal .env loader for local development (Vercel injects env vars itself).
try {
  const file = path.join(__dirname, '.env');
  if (fs.existsSync(file)) {
    fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
      }
    });
  }
} catch (_) { /* ignore */ }

// ============================================================
// PASTE YOUR RAPIDAPI KEY HERE (server-side only, never sent to the browser)
// Keep your GitHub repository PRIVATE if the real key is written in this file.
// ============================================================
const RAPIDAPI_KEY = 'YOUR_RAPIDAPI_KEY';

module.exports = {
  apiHost: 'social-download-all-in-one.p.rapidapi.com',
  apiUrl: 'https://social-download-all-in-one.p.rapidapi.com/v1/social/autolink',
  // An environment variable (if set) overrides the key written above.
  apiKey: (process.env.RAPIDAPI_KEY || RAPIDAPI_KEY || '').trim() === 'YOUR_RAPIDAPI_KEY' ? '' : (process.env.RAPIDAPI_KEY || RAPIDAPI_KEY).trim(),
  timeoutMs: Number(process.env.REQUEST_TIMEOUT_MS) || 20000,
  maxUrlLength: 2048,
  port: Number(process.env.PORT) || 3000
};
