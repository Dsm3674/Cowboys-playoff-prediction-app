# Frontend — Converted to Vite

Your `frontend/` folder has been converted from the old globals-style script pattern
to a real Vite + React 18 project that you can build and deploy.

## What changed

- `package.json` — added (declares React 18, Vite, Chart.js)
- `vite.config.js` — added (with dev proxy to your :3001 backend)
- `index.html` — added (Vite entry point at the root of `frontend/`)
- `src/api.js` — IIFE wrapper removed; now exports `{ api, BASE_URL }`
- `src/main.jsx` — `getGlobalComponent` helper removed; uses real ES imports
- `src/components/*.jsx` — all 29 files updated:
  - `const { useX } = React;`  →  `import React, { useX } from "react";`
  - Added `export default ComponentName` at the end
  - `window.api` → `api` (with import)
  - `window.Chart` → `Chart` (with `import Chart from "chart.js/auto";`)
- `src/styles/global.css` — **NEW placeholder stylesheet**. Your repo did
  not include a top-level CSS file — only `EventsAdmin.css` and `Timeline.css`.
  This file gives you a usable dark theme with the class names referenced in
  the JSX (`.card`, `.live-ticker-wrap`, `.text-muted`, etc.). Customize it
  to match your original design.

## Run locally

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Make sure your backend is running on http://localhost:3001 — `vite.config.js`
proxies API routes (`/cowboys`, `/teams`, `/players`, etc.) to it.

## Build for production

```bash
npm run build        # outputs to frontend/dist
```

## Deploy to Vercel

1. Push the updated repo to GitHub
2. https://vercel.com → **New Project** → import your repo
3. **Root Directory:** `frontend`
4. **Framework preset:** Vite (auto-detected)
5. **Environment Variables:** none required — `api.js` auto-detects the host
6. Deploy

Once deployed, your frontend at e.g. `https://cowboys-app.vercel.app` will hit your
Railway backend at the **same hostname** — which means you'll need to either:

- **Option A**: Update `src/api.js` to point at your Railway URL explicitly:
  ```js
  const BASE = window.location.hostname === "localhost"
    ? "http://localhost:3001"
    : "https://your-backend.up.railway.app";   // <-- change this
  ```
- **Option B**: Use a custom domain that proxies `/api/*` to Railway.

Option A is simpler. Just remember to also enable CORS for your Vercel
domain in the backend's `FRONTEND_URL` env var on Railway.

## Things to know / watch for

1. **Placeholder CSS** — the global stylesheet I generated is functional but
   is not a copy of your original. Your live site will look different until
   you replace `src/styles/global.css` with your real styles.

2. **Component file extensions in imports** — Vite is configured to resolve
   `.jsx` automatically, so `import X from "./components/X"` works.

3. **Chart.js** — `import Chart from "chart.js/auto"` is what registers all
   chart types. If you see "X is not a registered controller" errors, this
   is the import that fixes them.

4. **No more silent fallbacks** — the old `getGlobalComponent` helper would
   show an "X is unavailable" card at runtime. Now if a component is missing,
   you'll get a build error instead. This is good — you'll catch issues earlier.
