import { useApp } from '../context/AppContext';
import { score, weightedPick } from '../utils/scoring';

const PICK_COUNT = 5;

export function useRecommendation() {
  const { state } = useApp();
  const { titles, taste, settings, watchLater } = state;

  const mode = settings.mode || 'both';

  function inMode(t) {
    return mode === 'both' || t.type === mode;
  }

  // Manual Watch Later order is a strong signal: titles the user placed near the
  // top of their own queue get boosted (up to +60%), decaying down the list.
  function watchLaterBoost(id) {
    const idx = (watchLater || []).indexOf(id);
    if (idx === -1) return 1;
    const n = watchLater.length || 1;
    return 1 + 0.6 * ((n - idx) / n);
  }

  function candidates() {
    return titles
      .filter((t) => !t.watched && !t.disliked && !t.dismissed)
      .filter(inMode)
      .map((t) => ({ ...t, _score: score(t, taste) * watchLaterBoost(t.id) }))
      .sort((a, b) => b._score - a._score);
  }

  // Weighted pick over top 10; never returns watched titles.
  function pick() {
    const ranked = candidates();
    if (!ranked.length) return null;
    return weightedPick(ranked);
  }

  // Weighted sample WITHOUT replacement from the top of the ranked candidates —
  // heavily favors the best matches but keeps the batch varied.
  function sampleFive() {
    const pool = candidates().slice(0, 12);
    const out = [];
    while (out.length < PICK_COUNT && pool.length) {
      const weights = pool.map((_, i) => pool.length - i);
      const total = weights.reduce((s, w) => s + w, 0);
      let r = Math.random() * total;
      let idx = 0;
      for (; idx < pool.length; idx++) {
        r -= weights[idx];
        if (r <= 0) break;
      }
      out.push(pool.splice(Math.min(idx, pool.length - 1), 1)[0]);
    }
    return out;
  }

  // Always a brand-new weighted batch of five — no cooldown, no reuse.
  function suggest() {
    return { titles: sampleFive() };
  }

  function topPoster() {
    const ranked = candidates();
    return ranked[0]?.poster || null;
  }

  return { pick, suggest, candidates, topPoster };
}
