import { genreMultiplier } from './scoring';

export const RATING_MAX = 5;

// Bump this whenever the taste-calibration method changes meaningfully (e.g.
// switching from a manual baseline rating to a pick-5-and-battle system).
// Accounts onboarded under an older version get a one-time prompt to rebase.
export const TASTE_VERSION = 2;

// The rating scale anchors here for everyone. Tuning history: 5 rated
// everything too high, 4 too low — 4.25 reads right. Not user-configurable
// and not derived from battles; battles calibrate ORDER, this anchors SCALE.
export const DEFAULT_BASELINE_RATING = 4.25;
export const DEFAULT_BASELINE_ELO = Math.round(350 + DEFAULT_BASELINE_RATING * 210); // 1243

// ── Baseline <-> rating mapping (out of 5) ────────────────────────────────────
// A 1–5 personal baseline maps onto the Elo scale. 5 → 1400, 3 → 980, 1 → 560.
export function ratingToElo(rating) {
  return Math.round(350 + rating * 210);
}
export function eloToRating(elo) {
  return Math.min(5, Math.max(1, Math.round((elo - 350) / 210)));
}

// The baseline dictates the floor of your personal rating scale: your lowest
// title never sinks far below your center. Higher baseline = more generous rater.
export function ratingFloor(baselineElo = 1000) {
  const base = (baselineElo - 350) / 210; // ~1..5 (unclamped)
  return Math.min(4, Math.max(0.5, base - 1.5));
}

// Map a title's Elo to a display rating in [floor, 5], given the watched-list
// Elo range and the baseline-derived floor.
export function eloToDisplayRating(elo, minElo, maxElo, baselineElo) {
  const floor = ratingFloor(baselineElo);
  if (maxElo === minElo) return Math.round(((floor + RATING_MAX) / 2) * 10) / 10;
  const norm = ((elo ?? 1000) - minElo) / (maxElo - minElo);
  return Math.round((floor + norm * (RATING_MAX - floor)) * 10) / 10;
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
