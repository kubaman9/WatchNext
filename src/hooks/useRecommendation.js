import { useApp } from '../context/AppContext';
import { score, weightedPick } from '../utils/scoring';

const SUGGESTION_KEY = 'watchnext_suggestion';
const WINDOW_MS = 10 * 60 * 1000; // one fresh suggestion per 10 minutes

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
      .filter((t) => !t.watched && !t.disliked)
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

  // Rate-limited suggestion: returns the cached pick if one was made within the
  // last 10 minutes (and it's still valid for the current mode), else a fresh one.
  function suggest({ force = false } = {}) {
    const now = Date.now();
    let cached = null;
    try {
      cached = JSON.parse(localStorage.getItem(SUGGESTION_KEY) || 'null');
    } catch {
      cached = null;
    }
    if (!force && cached && now - cached.ts < WINDOW_MS) {
      const still = titles.find(
        (t) => t.id === cached.id && !t.watched && !t.disliked && inMode(t)
      );
      if (still) return { title: still, fresh: false, nextAt: cached.ts + WINDOW_MS };
    }
    const next = pick();
    if (next) {
      localStorage.setItem(SUGGESTION_KEY, JSON.stringify({ id: next.id, ts: now }));
    }
    return { title: next, fresh: true, nextAt: now + WINDOW_MS };
  }

  function topPoster() {
    const ranked = candidates();
    return ranked[0]?.poster || null;
  }

  return { pick, suggest, candidates, topPoster };
}
