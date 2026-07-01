import { useApp } from '../context/AppContext';
import { genreMultiplier } from '../utils/scoring';
import { eloToDisplayRating } from '../utils/rating';

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

  // Rating out of 5 (one decimal). Top of your list lands at 5.0; the bottom is
  // dictated by your baseline (a higher baseline lifts the floor, so you rate
  // more generously). Updates live whenever the baseline changes in Settings.
  function ratingOf(id) {
    if (!watched.length) return null;
    const t = watched.find((x) => x.id === id);
    if (!t) return null;
    const elos = watched.map((x) => x.eloScore ?? 1000);
    return eloToDisplayRating(
      t.eloScore ?? 1000,
      Math.min(...elos),
      Math.max(...elos),
      taste.baseline || 1000
    );
  }

  // A title is "provisional" until it's been compared enough to trust its spot.
  function confidenceOf(id) {
    const t = watched.find((x) => x.id === id);
    return t ? t.comparisons || 0 : 0;
  }
  function isProvisional(id) {
    return confidenceOf(id) < 3;
  }

  return {
    titles,
    watched,
    rankOf,
    neighbors,
    seedElo,
    opponents,
    ratingOf,
    confidenceOf,
    isProvisional,
  };
}
