# PahadLink

Himalayan products store - React + Express + MongoDB (`Pahadi_link_DB`).

## Quick start (local)

```bash
npm install
npm run seed:admin
npm run seed:crm
npm start
```

- Website: http://localhost:5173  
- Admin: http://localhost:5173/admin/login  
- API: http://localhost:5000/api/health  
- DB: `mongodb://127.0.0.1:27017/Pahadi_link_DB`  
- Test account (only one): `admin` / `admin123`

URLs are clean path-based (no `/#/…`). Example: `/admin`, `/shop`, `/login`.

## Deploy targets

| Layer | Host | Repo |
|-------|------|------|
| Frontend | **Vercel** (recommended) or GitHub Pages | [`pahadlink-harvest`](https://github.com/1mukeshr/pahadlink-harvest) |
| API | Render (`render.yaml`) | same repo |
| DB | MongoDB Atlas | `Pahadi_link_DB` |

Push frontend + API source to **`pahadlink-harvest`** (`harvest` remote):

```bash
git push harvest main
```

### Vercel (frontend)

**Live site:** https://pahadlink-harvest.vercel.app  
(also: https://pahadlink.vercel.app)

**Import from GitHub (harvest repo):**  
https://vercel.com/new/import?s=https%3A%2F%2Fgithub.com%2F1mukeshr%2Fpahadlink-harvest

1. Open the import link (or Dashboard → Add New → Project → `pahadlink-harvest`)
2. Framework: **Vite** · Root `/` · Build uses `npm run build` (Vercel sets `VERCEL=1` → base `/`)
3. Env: `VITE_API_URL=https://pahadlink-api.onrender.com/api`
4. Firebase → Authorized domains → add `pahadlink-harvest.vercel.app` (and `pahadlink.vercel.app`)
5. Render → `FRONTEND_URL` → append `,https://pahadlink-harvest.vercel.app,https://pahadlink.vercel.app`

### GitHub Pages (optional alternate)

Live site: https://1mukeshr.github.io/pahadlink-harvest/

```bash
npm run deploy
```

Or push `main` and let `.github/workflows/deploy-pages.yml` run.

## GitHub Pages / Vercel + real backend (required for login/register online)

Static hosts cannot run Express or MongoDB. You need a hosted API.

### 1) MongoDB Atlas

1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Database user + Network Access → allow `0.0.0.0/0` (or Render IPs)
3. Connection string, DB name **`Pahadi_link_DB`**:
   `mongodb+srv://USER:PASS@CLUSTER.mongodb.net/Pahadi_link_DB?retryWrites=true&w=majority`

### 2) Deploy API on Render (no Atlas required)

1. Open [render.com/deploy?repo=https://github.com/1mukeshr/pahadlink-harvest](https://render.com/deploy?repo=https://github.com/1mukeshr/pahadlink-harvest)  
   or Render → **New** → **Blueprint** → this repo (`render.yaml`)
2. Set `ADMIN_PASSWORD` (and optionally `MONGODB_URI` for Atlas).  
   Default blueprint uses **file DB fallback** so auth works without MongoDB Atlas.
3. Deploy, then open: `https://YOUR-SERVICE.onrender.com/api/health`  
   Expect: `{ "ok": true, ... }`

### 3) Point the frontend at the API

1. Keep `public/runtime-config.json` → `{ "apiUrl": "https://pahadlink-api.onrender.com/api" }`
2. Or set Vercel / GitHub Actions env `VITE_API_URL` to the same value
3. Push to `main` on `pahadlink-harvest`

Auth smoke test:

```bash
npm run test:auth
npm run test:auth -- https://YOUR-SERVICE.onrender.com/api
```

## Folder structure

```
pahadlink/
├── src/          # Frontend only (React / Vite / browser)
├── server/       # Backend only (Express / Mongo / JWT / SMTP)
├── shared/       # Domain rules used by BOTH (coupons, prices, roles)
├── public/       # Static assets + runtime-config.json
├── scripts/      # Deploy / tooling scripts (not app runtime)
├── vercel.json   # Vercel SPA frontend
├── render.yaml   # Render Blueprint for hosted API
└── .github/workflows/deploy-pages.yml
```

### Separation of concerns

| Layer | May import | Must not import |
|-------|------------|-----------------|
| `src/` | `shared/`, browser libs | `server/` |
| `server/` | `shared/`, Node libs | `src/` |
| `shared/` | nothing from src/server | React, Express, DOM |

Frontend talks to backend **only over HTTP** (`/api` …). Never import server modules into React.

## Where to edit what

| Task | File |
|------|------|
| New page route | `src/routes/AppRoutes.jsx` + `src/config` |
| Login / register UI | `src/pages/auth/` |
| Header / footer | `src/components/layout/` |
| API helpers (HTTP client) | `src/services/` |
| Product images / tags / copy | `src/data/siteData.js` |
| Prices / sizes / coupons / qty limits | `shared/` |
| Mongo models | `server/models/` |
| API endpoints | `server/routes/` |
| Live inventory store | `server/services/inventory.js` |
