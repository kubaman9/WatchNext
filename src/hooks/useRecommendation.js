import { useApp } from '../context/AppContext';
import { score, weightedPick } from '../utils/scoring';

export function useRecommendation() {
  const { state } = useApp();
  const { titles, taste, settings } = state;

  function candidates() {
    return titles
      .filter((t) => !t.watched && !t.disliked)
      .filter((t) => (t.type === 'movie' ? settings.includeMovies : settings.includeTv))
      .map((t) => ({ ...t, _score: score(t, taste) }))
      .sort((a, b) => b._score - a._score);
  }

  // Weighted pick over top 10; never returns watched titles.
  function pick() {
    const ranked = candidates();
    if (!ranked.length) return null;
    return weightedPick(ranked);
  }

  function topPoster() {
    const ranked = candidates();
    return ranked[0]?.poster || null;
  }

  return { pick, candidates, topPoster };
}
