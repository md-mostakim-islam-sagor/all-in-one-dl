# MOSTAKIM Video Downloader (media-downloader)

All-in-One Video & Audio Downloader — **POWERED BY MOSTAKIM LAB'S**.
Plain HTML/CSS/JS frontend + one Vercel serverless function that calls the RapidAPI *Social Download All In One* API. The API key never reaches the browser.

```
media-downloader/
├── src/ (index.html, style.css, setting.js)
├── resources/mostakim.png   <- add your logo here (required)
├── index.js  config.js  package.json  vercel.json  .gitignore  .env.example
```

## 1. Add the logo
Place your logo at `resources/mostakim.png` (used as header logo, footer icon and favicon).

## 2. Install
Requires Node.js 18+. There are no npm dependencies, so `npm install` is optional.

## 3. Configure the key
Subscribe to **Social Download All In One** on RapidAPI Hub, then open `config.js` and replace:
```js
const RAPIDAPI_KEY = 'YOUR_RAPIDAPI_KEY';
```
with your real key. The key stays on the server and is never sent to the browser.
**Keep your GitHub repository private** when the real key is written in `config.js`.
(Optional: an environment variable `RAPIDAPI_KEY`, in `.env` or Vercel settings, overrides the value in `config.js`.)

## 4. Run locally
```
npm start
```
Open http://localhost:3000. The local server serves `src/`, `/resources/*` and `POST /api/download` (the same handler Vercel runs).

## 5. Push to GitHub
```
git init
git add .
git commit -m "MOSTAKIM Video Downloader"
git branch -M main
git remote add origin https://github.com/YOUR_USER/media-downloader.git
git push -u origin main
```

## 6. Deploy on Vercel
1. Vercel Dashboard → **Add New → Project** → import the repository.
2. Leave Framework Preset as **Other**; no build command or output directory needed.
3. Make sure the key is set in `config.js` (or add `RAPIDAPI_KEY` under **Settings → Environment Variables**).
4. Click **Deploy** (redeploy after changing env vars).

`vercel.json` routes `/api/download` → `index.js` (serverless function) and serves `src/` as the site root and `resources/` at `/resources/`.

## 7. Test the live site
Open your `*.vercel.app` URL, paste a public video link, press **Download**. Or:
```
curl -X POST https://YOUR-APP.vercel.app/api/download -H "Content-Type: application/json" -d '{"url":"https://example.com/video"}'
```

## 8. Logs & troubleshooting
Vercel Dashboard → your project → **Logs** (or `vercel logs <deployment-url>`).

| Symptom | Likely cause |
|---|---|
| 500 "Server is not configured" | Key not set in `config.js` (or env var); add it and redeploy |
| 502 "authorization failed" | Wrong key or not subscribed to the API |
| 429 rate limit | RapidAPI plan quota reached |
| 504 timeout | Upstream slow; retry (timeout via `REQUEST_TIMEOUT_MS`, default 20000) |
| 404 "No downloadable media" | Link unsupported/private |
| Download opens a new tab | Source CDN blocks cross-origin downloads; use the browser's Save option |

## Notes
- Only the formats returned by the API are shown; no conversion, watermark removal or quality enhancement is claimed.
- Only download content you have the right to download.
