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
    overview: raw.overview || '',
    rating: raw.vote_average || 0,
    eloScore: 1000,
    watched: false,
    wins: 0,
    losses: 0,
    skippedFromButton: 0,
  };
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
  return json.results.filter((r) => r.poster_path).map(normalize);
}

export async function popular(type = 'movie', page = 1) {
  if (isDemoMode()) return mock.popular(type, page);
  const json = await get(`/${type}/popular`, { page });
  return json.results
    .filter((r) => r.poster_path)
    .map((r) => normalize({ ...r, media_type: type }));
}

export async function buildPool(size = 50) {
  if (isDemoMode()) return mock.buildPool(size);
  const [tr, mp, tp] = await Promise.all([trending(), popular('movie'), popular('tv')]);
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

// Paginated feed for Rank Mode's infinite scroll. Interleaves movie + tv popular
// pages by `mode`. Returns [] when there are no more results (end of catalog).
export async function feedPage(page = 1, mode = 'both') {
  if (isDemoMode()) return mock.feedPage(page, mode);
  const types = mode === 'tv' ? ['tv'] : mode === 'movie' ? ['movie'] : ['movie', 'tv'];
  const lists = await Promise.all(types.map((t) => popular(t, page)));
  const max = Math.max(0, ...lists.map((l) => l.length));
  const out = [];
  for (let i = 0; i < max; i++) for (const l of lists) if (l[i]) out.push(l[i]);
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
