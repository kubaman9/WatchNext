import { useApp } from '../context/AppContext';
import { score, weightedPick } from '../utils/scoring';

const SUGGESTION_KEY = 'watchnext_suggestions'; // { ids: string[], ts } — the 5 picks
const WINDOW_MS = 10 * 60 * 1000; // one fresh batch of suggestions per 10 minutes
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

  function eligible(id) {
    return titles.find((t) => t.id === id && !t.watched && !t.disliked && !t.dismissed && inMode(t));
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

  // Rate-limited suggestions: one batch of five per 10-minute window. Re-taps
  // inside the window return the same five (minus any that became ineligible).
  function suggest({ force = false } = {}) {
    const now = Date.now();
    let cached = null;
    try {
      cached = JSON.parse(localStorage.getItem(SUGGESTION_KEY) || 'null');
    } catch {
      cached = null;
    }
    if (!force && cached && Array.isArray(cached.ids) && now - cached.ts < WINDOW_MS) {
      const still = cached.ids.map(eligible).filter(Boolean);
      if (still.length) return { titles: still, fresh: false, nextAt: cached.ts + WINDOW_MS };
    }
    const five = sampleFive();
    if (five.length) {
      localStorage.setItem(SUGGESTION_KEY, JSON.stringify({ ids: five.map((t) => t.id), ts: now }));
    }
    return { titles: five, fresh: true, nextAt: now + WINDOW_MS };
  }

  // Drop one title from the cached batch (e.g. after "not interested").
  function removeSuggestion(id) {
    try {
      const cached = JSON.parse(localStorage.getItem(SUGGESTION_KEY) || 'null');
      if (cached && Array.isArray(cached.ids)) {
        cached.ids = cached.ids.filter((x) => x !== id);
        localStorage.setItem(SUGGESTION_KEY, JSON.stringify(cached));
      }
    } catch {
      /* ignore */
    }
  }

  function topPoster() {
    const ranked = candidates();
    return ranked[0]?.poster || null;
  }

  // Milliseconds until a fresh suggestion unlocks (0 if ready now).
  function suggestionRemaining() {
    try {
      const cached = JSON.parse(localStorage.getItem(SUGGESTION_KEY) || 'null');
      if (!cached) return 0;
      return Math.max(0, cached.ts + WINDOW_MS - Date.now());
    } catch {
      return 0;
    }
  }

  return { pick, suggest, removeSuggestion, candidates, topPoster, suggestionRemaining };
}
