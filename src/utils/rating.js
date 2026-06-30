import { genreMultiplier } from './scoring';

// ── Baseline <-> rating mapping ───────────────────────────────────────────────
// A 1–10 personal baseline maps onto the Elo scale. 10 → 1450, ~6 → 1010, 1 → 460.
export function ratingToElo(rating) {
  return Math.round(350 + rating * 110);
}
export function eloToRating(elo) {
  return Math.min(10, Math.max(1, Math.round((elo - 350) / 110)));
}

// ── Multi-factor seed ─────────────────────────────────────────────────────────
// Where to start a placement, blending: personal baseline (scale center),
// genre affinity (do you like this kind of thing), and TMDB popularity.
export function seedElo(title, { taste = {}, baseline = 1000 } = {}) {
  const genre = genreMultiplier(title, taste.genreWeights || {}); // ~0.2..2.0
  const tmdb = Math.max(0, Math.min(1, (title.rating || 0) / 10)); // 0..1
  let est = baseline * (0.6 + 0.4 * genre); // pull toward genres you favor
  est *= 0.9 + 0.2 * tmdb; // small popularity nudge
  return Math.round(est);
}

// Index where `elo` slots into a descending-by-Elo ranked list.
export function estimateIndex(elo, ranked) {
  let i = 0;
  while (i < ranked.length && (ranked[i].eloScore ?? 1000) > elo) i++;
  return i;
}

// Elo to assign for an insertion index in a descending ranked list, so the title
// sits strictly between its two neighbors (or just past the end).
export function eloForIndex(index, ranked) {
  if (!ranked.length) return 1000;
  const above = ranked[index - 1];
  const below = ranked[index];
  if (above && below) return Math.round(((above.eloScore ?? 1000) + (below.eloScore ?? 1000)) / 2);
  if (above) return (above.eloScore ?? 1000) - 30; // bottom of list
  return (below.eloScore ?? 1000) + 30; // top of list
}

// Rotating prompts keep each rating session feeling fresh.
export const PROMPTS = [
  'Which would you rather watch?',
  'Which one hits harder?',
  'Better pick of the two?',
  'Which wins?',
  'Rather rewatch which?',
  'Which is more your speed?',
  'Pick the stronger one.',
];

export function randomPrompt() {
  return PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
}
