'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

function isAllowedUrl(value) {
  if (typeof value !== 'string' || !value || value.length > config.maxUrlLength) return false;
  let u;
  try { u = new URL(value); } catch (_) { return false; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return false;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return false;
  if (h === '::1' || h.startsWith('[')) return false;
  return true;
}

function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
    try { return Promise.resolve(JSON.parse(String(req.body))); } catch (e) { return Promise.reject(e); }
  }
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 10000) { reject(new Error('too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));

function normalize(data) {
  if (!data || typeof data !== 'object') return null;
  const list = Array.isArray(data.medias) ? data.medias : [];
  const medias = list
    .filter((m) => m && typeof m.url === 'string' && /^https?:\/\//i.test(m.url))
    .map((m) => ({
      url: m.url,
      quality: str(m.quality),
      extension: str(m.extension).replace(/^\./, '').toLowerCase(),
      type: str(m.type).toLowerCase(),
      size: m.data_size != null ? m.data_size : null
    }));
  return {
    title: str(data.title),
    author: str(data.author),
    source: str(data.source),
    thumbnail: /^https?:\/\//i.test(str(data.thumbnail)) ? data.thumbnail : '',
    duration: data.duration != null ? data.duration : null,
    medias
  };
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method not allowed. Use POST.' });
  }
  if (!config.apiKey) {
    console.error('RAPIDAPI_KEY is not configured.');
    return send(res, 500, { error: 'Server is not configured. Please contact the site owner.' });
  }
  let body;
  try { body = await readBody(req); } catch (_) {
    return send(res, 400, { error: 'Invalid JSON request body.' });
  }
  const url = body && typeof body.url === 'string' ? body.url.trim() : '';
  if (!isAllowedUrl(url)) return send(res, 400, { error: 'Please provide a valid http or https URL.' });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), config.timeoutMs);
  try {
    const upstream = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-host': config.apiHost,
        'x-rapidapi-key': config.apiKey
      },
      body: JSON.stringify({ url }),
      signal: ctrl.signal
    });
    const text = await upstream.text();
    let json;
    try { json = JSON.parse(text); } catch (_) {
      return send(res, 502, { error: 'The download service returned an invalid response.' });
    }
    if (upstream.status === 429) return send(res, 429, { error: 'Rate limit reached. Please try again later.' });
    if (upstream.status === 401 || upstream.status === 403) {
      console.error('Upstream auth error', upstream.status);
      return send(res, 502, { error: 'Download service authorization failed.' });
    }
    if (!upstream.ok || json.error) {
      const msg = typeof json.error === 'string' && json.error ? json.error : (typeof json.message === 'string' ? json.message : '');
      return send(res, upstream.ok ? 422 : 502, { error: msg || 'Could not fetch this link.' });
    }
    const result = normalize(json);
    if (!result || result.medias.length === 0) {
      return send(res, 404, { error: 'No downloadable media was found for this link.' });
    }
    return send(res, 200, result);
  } catch (err) {
    if (err && err.name === 'AbortError') return send(res, 504, { error: 'The request timed out. Please try again.' });
    console.error('Upstream request failed:', err && err.message);
    return send(res, 502, { error: 'Could not reach the download service.' });
  } finally {
    clearTimeout(timer);
  }
}

module.exports = handler;

// ---- Local development server (not used on Vercel) ----
if (require.main === module) {
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.ico': 'image/png' };
  http.createServer((req, res) => {
    const p = decodeURIComponent((req.url || '/').split('?')[0]);
    if (p === '/api/download') return handler(req, res);
    let file;
    if (p.startsWith('/resources/')) file = path.join(__dirname, p);
    else file = path.join(__dirname, 'src', p === '/' ? 'index.html' : p);
    if (!file.startsWith(__dirname)) { res.statusCode = 403; return res.end('Forbidden'); }
    fs.readFile(file, (err, buf) => {
      if (err) { res.statusCode = 404; return res.end('Not found'); }
      res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
      res.end(buf);
    });
  }).listen(config.port, () => console.log('MOSTAKIM Video Downloader running at http://localhost:' + config.port));
}
