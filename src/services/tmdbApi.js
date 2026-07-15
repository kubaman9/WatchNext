import * as mock from './mockTmdbApi';

const IMG = 'https://image.tmdb.org/t/p/w500';
const BASE = 'https://api.themoviedb.org/3';
const cache = new Map();

// Public no-registration keys (rickylawson/freekeys). Fallback so the app has
// live data out of the box; users can override with their own in Settings/.env.
const FALLBACK_KEYS = [
  'fb7bb23f03b6994dafc674c074d01761',
  'e55425032d3d0f371fc776f302e7c09b',
  '8301a21598f8b45668d5711a814f01f6',
];

let MOVIE_GENRES = {};
let TV_GENRES = {};

function fallbackKey() {
  return FALLBACK_KEYS[Math.floor(Math.random() * FALLBACK_KEYS.length)];
}

export function getApiKey() {
  return (
    localStorage.getItem('watchnext_tmdb_key') ||
    import.meta.env.VITE_TMDB_API_KEY ||
    fallbackKey()
  );
}

// True only when the user/env supplied no key of their own.
export function usingFallbackKey() {
  return !(localStorage.getItem('watchnext_tmdb_key') || import.meta.env.VITE_TMDB_API_KEY);
}

export function setApiKey(key) {
  if (key) localStorage.setItem('watchnext_tmdb_key', key);
  else localStorage.removeItem('watchnext_tmdb_key');
}

export function isDemoMode() {
  return !getApiKey();
}

async function get(path, params = {}) {
  const key = getApiKey();
  const url = new URL(BASE + path);
  url.searchParams.set('api_key', key);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const cacheKey = url.toString();
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  const json = await res.json();
  cache.set(cacheKey, json);
  return json;
}

function poster(p) {
  return p ? IMG + p : null;
}

function genreNames(ids, type) {
  const map = type === 'tv' ? TV_GENRES : MOVIE_GENRES;
  return (ids || []).map((id) => map[id]).filter(Boolean);
}

function normalize(raw) {
  const type = raw.media_type === 'tv' || raw.first_air_date ? 'tv' : 'movie';
  const date = raw.release_date || raw.first_air_date || '';
  const genreIds = raw.genre_ids || (raw.genres || []).map((g) => g.id) || [];
  return {
    id: String(raw.id),
    title: raw.title || raw.name || 'Untitled',
    type,
    poster: poster(raw.poster_path),
    genres: raw.genres ? raw.genres.map((g) => g.name) : genreNames(genreIds, type),
    genreIds,
    year: date ? Number(date.slice(0, 4)) : 0,
    releaseDate: date,
    overview: raw.overview || '',
    rating: raw.vote_average || 0,
    voteCount: raw.vote_count || 0,
    eloScore: 1000,
    watched: false,
    wins: 0,
    losses: 0,
    skippedFromButton: 0,
  };
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Feed-quality gate: enough votes to not be obscure noise, and already released.
// Titles with no date at all only pass on vote count (a real audience implies
// it's out). Search results are deliberately NOT filtered — if you type it, you
// get it.
const MIN_VOTES = { movie: 200, tv: 100 };

function isQuality(t) {
  if ((t.voteCount || 0) < (MIN_VOTES[t.type] || 100)) return false;
  if (t.releaseDate && t.releaseDate > todayISO()) return false;
  return true;
}

export async function loadGenres() {
  if (isDemoMode()) return mock.loadGenres();
  try {
    const [m, t] = await Promise.all([
      get('/genre/movie/list'),
      get('/genre/tv/list'),
    ]);
    m.genres.forEach((g) => (MOVIE_GENRES[g.id] = g.name));
    t.genres.forEach((g) => (TV_GENRES[g.id] = g.name));
  } catch {
    /* ignore */
  }
}

export async function search(query) {
  if (isDemoMode()) return mock.search(query);
  if (!query.trim()) return [];
  const json = await get('/search/multi', { query, include_adult: 'false' });
  return json.results
    .filter((r) => (r.media_type === 'movie' || r.media_type === 'tv') && r.poster_path)
    .map(normalize);
}

export async function trending() {
  if (isDemoMode()) return mock.trending();
  const json = await get('/trending/all/week');
  return json.results.filter((r) => r.poster_path).map(normalize).filter(isQuality);
}

export async function popular(type = 'movie', page = 1) {
  if (isDemoMode()) return mock.popular(type, page);
  const json = await get(`/${type}/popular`, { page });
  return json.results
    .filter((r) => r.poster_path)
    .map((r) => normalize({ ...r, media_type: type }))
    .filter(isQuality);
}

// A ranked list from a given TMDB endpoint (popular / top_rated / trending).
async function fromSource(type, source, page) {
  const path = source === 'trending' ? `/trending/${type}/week` : `/${type}/${source}`;
  const json = await get(path, { page });
  return (json.results || [])
    .filter((r) => r.poster_path)
    .map((r) => normalize({ ...r, media_type: type }))
    .filter(isQuality);
}

// Titles matching ANY of the given genres (OR, via TMDB's `|` separator),
// sorted by popularity and filtered to a minimum vote count so obscure noise
// doesn't dominate. This is the "more of what you actually favor" lever.
export async function discoverByGenres(type, genreIds, page = 1) {
  if (isDemoMode()) return mock.discoverByGenres(type, genreIds, page);
  if (!genreIds.length) return popular(type, page);
  const dateKey = type === 'tv' ? 'first_air_date.lte' : 'primary_release_date.lte';
  try {
    const json = await get(`/discover/${type}`, {
      with_genres: genreIds.join('|'),
      sort_by: 'popularity.desc',
      'vote_count.gte': MIN_VOTES[type] || 100,
      [dateKey]: todayISO(),
      page,
    });
    return (json.results || [])
      .filter((r) => r.poster_path)
      .map((r) => normalize({ ...r, media_type: type }))
      .filter(isQuality);
  } catch {
    return [];
  }
}

// TMDB's own "similar titles" for a specific title the user rated highly — this
// is what actually captures "more like Inception/Interstellar" rather than a
// generic genre match, so a library full of one director's films surfaces more
// of that same vein instead of unrelated genre-only matches.
export async function similarTo(id, type) {
  if (isDemoMode()) return mock.similarTo(id, type);
  try {
    const json = await get(`/${type}/${id}/similar`);
    return (json.results || [])
      .filter((r) => r.poster_path)
      .map((r) => normalize({ ...r, media_type: type }))
      .filter(isQuality);
  } catch {
    return [];
  }
}

// Unreleased titles the user is likely to care about, for Home's "Coming soon"
// row. Deliberately the ONLY place future dates are allowed — everywhere else
// they're filtered out.
export async function upcoming(topGenreIds = []) {
  if (isDemoMode()) return mock.upcoming(topGenreIds);
  const today = todayISO();
  try {
    const [mv, tv] = await Promise.all([
      get('/movie/upcoming').catch(() => ({ results: [] })),
      get('/discover/tv', {
        'first_air_date.gte': today,
        sort_by: 'popularity.desc',
      }).catch(() => ({ results: [] })),
    ]);
    const all = [
      ...(mv.results || []).map((r) => normalize({ ...r, media_type: 'movie' })),
      ...(tv.results || []).map((r) => normalize({ ...r, media_type: 'tv' })),
    ].filter((t) => t.poster && t.releaseDate && t.releaseDate > today);
    // Prefer titles overlapping the user's favored genres, then by soonest.
    const overlap = (t) => t.genreIds.filter((g) => topGenreIds.includes(g)).length;
    all.sort((a, b) => overlap(b) - overlap(a) || a.releaseDate.localeCompare(b.releaseDate));
    const seen = new Set();
    return all.filter((t) => !seen.has(t.id) && seen.add(t.id)).slice(0, 12);
  } catch {
    return [];
  }
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// `page` lets onboarding's "show me different titles" pull a fresh batch;
// trending has no useful pages, so it only contributes to page 1.
export async function buildPool(size = 50, page = 1) {
  if (isDemoMode()) return mock.buildPool(size, page);
  const [tr, mp, tp] = await Promise.all([
    page === 1 ? trending() : Promise.resolve([]),
    popular('movie', page),
    popular('tv', page),
  ]);
  const seen = new Set();
  const out = [];
  for (const t of [...tr, ...mp, ...tp]) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
    if (out.length >= size) break;
  }
  return out;
}

// Rotate the source each page so the exploration slice of Discover isn't just
// the same popularity list — popular, then top-rated, then trending, repeat.
const FEED_SOURCES = ['popular', 'top_rated', 'trending'];

// Discover feed for Rank Mode's infinite swipe deck. `taste` (optional) is
// { topGenreIds, anchors } derived from the user's actual watched/high-ranked
// titles — when present, ~2/3 of each page is personalized (genre match +
// TMDB's own "similar to X" for top-ranked titles) and ~1/3 stays generic
// popular/top-rated/trending for exploration. With no taste signal yet (fresh
// account), it falls back to the old fully-generic rotation.
export async function feedPage(page = 1, mode = 'both', taste = null) {
  if (isDemoMode()) return mock.feedPage(page, mode, taste);
  const types = mode === 'tv' ? ['tv'] : mode === 'movie' ? ['movie'] : ['movie', 'tv'];

  const topGenreIds = taste?.topGenreIds || [];
  const anchors = (taste?.anchors || []).filter((a) => mode === 'both' || a.type === mode);

  const personalized = [];
  if (topGenreIds.length) {
    const genrePage = Math.max(1, Math.ceil(page / 2));
    const lists = await Promise.all(
      types.map((t) => discoverByGenres(t, topGenreIds, genrePage).catch(() => []))
    );
    personalized.push(...lists.flat());
  }
  if (anchors.length) {
    const anchor = anchors[(page - 1) % anchors.length];
    if (anchor) personalized.push(...(await similarTo(anchor.id, anchor.type).catch(() => [])));
  }

  const source = FEED_SOURCES[(page - 1) % FEED_SOURCES.length];
  const srcPage = Math.floor((page - 1) / FEED_SOURCES.length) + 1;
  const diverseLists = await Promise.all(
    types.map((t) => fromSource(t, source, srcPage).catch(() => []))
  );
  const diverse = diverseLists.flat();

  if (!personalized.length) return shuffle(diverse);

  // Interleave roughly 2 personalized : 1 diverse, de-duped, then light shuffle
  // within each tier so it isn't the exact same order every time.
  const p = shuffle(personalized);
  const d = shuffle(diverse);
  const seen = new Set();
  const out = [];
  let pi = 0,
    di = 0;
  while (pi < p.length || di < d.length) {
    for (let k = 0; k < 2 && pi < p.length; k++, pi++) {
      if (!seen.has(p[pi].id)) {
        seen.add(p[pi].id);
        out.push(p[pi]);
      }
    }
    if (di < d.length) {
      if (!seen.has(d[di].id)) {
        seen.add(d[di].id);
        out.push(d[di]);
      }
      di++;
    }
  }
  return out;
}

export async function watchProviders(id, type) {
  if (isDemoMode()) return mock.watchProviders(id, type);
  try {
    const json = await get(`/${type}/${id}/watch/providers`);
    const us = json.results?.US || {};
    const flat = us.flatrate || us.free || us.ads || [];
    return flat.map((p) => p.provider_name).slice(0, 4);
  } catch {
    return [];
  }
}
