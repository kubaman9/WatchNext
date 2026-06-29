import { useApp } from '../context/AppContext';
import { genreMultiplier } from '../utils/scoring';

export function useTitles() {
  const { state } = useApp();
  const { titles, taste } = state;

  const watched = titles
    .filter((t) => t.watched)
    .sort((a, b) => b.eloScore - a.eloScore);

  function rankOf(id) {
    const i = watched.findIndex((t) => t.id === id);
    return i === -1 ? null : i + 1;
  }

  function neighbors(id) {
    const i = watched.findIndex((t) => t.id === id);
    if (i === -1) return { above: null, below: null };
    return { above: watched[i - 1] || null, below: watched[i + 1] || null };
  }

  // Seed estimate for a brand-new watched title using genre affinity.
  function seedElo(title) {
    return Math.round(1000 * genreMultiplier(title, taste.genreWeights || {}));
  }

  // Opponents within ±150 Elo, excluding given ids, for post-watch battles.
  function opponents(newTitle, excludeIds = []) {
    const target = newTitle.eloScore || seedElo(newTitle);
    return watched
      .filter((t) => t.id !== newTitle.id && !excludeIds.includes(t.id))
      .map((t) => ({ t, d: Math.abs(t.eloScore - target) }))
      .sort((a, b) => a.d - b.d)
      .map((x) => x.t);
  }

  // Rating out of 5 (one decimal), min-max normalized off Elo across the whole
  // watched list — top of your list lands at 5.0, bottom at 1.0. Rank number
  // (not this rounded value) is the real tiebreaker when two titles round the same.
  function ratingOf(id) {
    if (!watched.length) return null;
    const t = watched.find((x) => x.id === id);
    if (!t) return null;
    const elos = watched.map((x) => x.eloScore ?? 1000);
    const min = Math.min(...elos);
    const max = Math.max(...elos);
    if (max === min) return 5.0;
    const norm = ((t.eloScore ?? 1000) - min) / (max - min);
    return Math.round((1 + norm * 4) * 10) / 10;
  }

  return { titles, watched, rankOf, neighbors, seedElo, opponents, ratingOf };
}
