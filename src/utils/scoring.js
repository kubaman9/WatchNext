const WEIGHT_UP = 0.08;
const WEIGHT_DOWN = 0.04;
const WEIGHT_MIN = 0.2;
const WEIGHT_MAX = 2.0;

function avg(arr) {
  if (!arr.length) return 1.0;
  return arr.reduce((s, n) => s + n, 0) / arr.length;
}

export function genreMultiplier(title, genreWeights) {
  return avg((title.genreIds || []).map((id) => genreWeights[id] ?? 1.0));
}

export function score(title, taste) {
  const genreMult = genreMultiplier(title, taste.genreWeights || {});
  const skipPenalty = Math.max(0.5, 1 - (title.skippedFromButton || 0) * 0.1);
  return title.eloScore * genreMult * skipPenalty;
}

// Adjust genre weights after a battle. Mutates a copy, returns new weights map.
export function bumpGenreWeights(weights, winnerGenreIds, loserGenreIds) {
  const next = { ...weights };
  const clamp = (n) => Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, n));
  (winnerGenreIds || []).forEach((id) => {
    next[id] = clamp((next[id] ?? 1.0) + WEIGHT_UP);
  });
  (loserGenreIds || []).forEach((id) => {
    next[id] = clamp((next[id] ?? 1.0) - WEIGHT_DOWN);
  });
  return next;
}

// Weighted random over top candidates: rank 1 weight = n, rank 2 = n-1, ...
export function weightedPick(sorted) {
  const pool = sorted.slice(0, 10);
  if (!pool.length) return null;
  const weights = pool.map((_, i) => pool.length - i);
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[0];
}
