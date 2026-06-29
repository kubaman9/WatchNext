# WatchNext

One job: answer **"What should I watch next?"** Every screen feeds a single button.

## Stack

Vite + React · Tailwind · Framer Motion · TMDB API · localStorage (no backend).

## Setup

```bash
npm install
npm run dev
```

Open the printed localhost URL.

### TMDB API key

Works out of the box: ships with shared public no-registration keys
([rickylawson/freekeys](https://github.com/rickylawson/freekeys)) so live TMDB
data loads with zero setup.

These keys are shared/rate-limited — for reliable results use your own:

- create `.env` with `VITE_TMDB_API_KEY=your_key`, or
- paste a key in **Settings → TMDB API key**.

Get a free key at https://www.themoviedb.org/settings/api.
(An offline mock with 27 hardcoded titles remains as a code-level fallback.)

## How it works

`recommendationScore = eloScore × genreAffinity × skipPenalty`

- **Onboarding** (skippable): pick recently watched titles, then 15 taste battles seed Elo + genre weights.
- **The Button** scores every unwatched title, weighted-randoms the top 10, and reveals one.
- **Watch This** → 3 quick Elo battles place it in your ranked list.
- **Not Now** → minor skip penalty, next pick instantly.
- **Rank Mode** (drawer) → bulk-classify a feed: Seen / Pass / Add to list.
- **My List** → your ranked list; re-rank or remove any title.

All state persists to `localStorage` under `watchnext_state`.

## Accounts & cloud sync

Sign-in is backed by **MongoDB** via serverless API routes in [`/api`](api):

- `POST /api/auth/signup` · `POST /api/auth/login` · `GET /api/auth/me`
- `GET /api/state` · `PUT /api/state` — per-user WatchNext data

Passwords are hashed with bcrypt; sessions are JWTs stored in `localStorage`.
On sign-in your list/taste loads from MongoDB and syncs back on every change, so
your account follows you across devices.

## Deploy (Vercel)

This is a full-stack app (Vite frontend + serverless API). Deploy on Vercel:

1. Push to GitHub (already wired): `git push -u origin main`.
2. On [vercel.com](https://vercel.com) → **New Project** → import `kubaman9/WatchNext`.
3. Set **Environment Variables**:
   - `MONGODB_URI` — your MongoDB Atlas connection string
   - `JWT_SECRET` — any long random string
4. Deploy. Vercel auto-detects Vite and serves `/api/*` as functions.

> ⚠️ **Never commit `MONGODB_URI` or `JWT_SECRET`.** They live only in Vercel's
> env settings. If a connection string is ever exposed, rotate the DB password
> in Atlas immediately.

### Local full-stack dev

```bash
npm i -g vercel
vercel dev          # runs frontend + /api with your env vars
```

Plain `npm run dev` runs only the frontend (auth calls will fail without the API).

## Scripts

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run preview` — preview the build

## Structure

```
src/
  components/  onboarding · home · ranking · list · shared
  hooks/       useRecommendation · useTitles · useTmdb
  services/    tmdbApi · mockTmdbApi · storage
  utils/       elo · scoring
  context/     AppContext (reducer + persistence)
```
