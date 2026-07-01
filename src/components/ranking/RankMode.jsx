import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { useTitles } from '../../hooks/useTitles';
import { feedPage } from '../../services/tmdbApi';
import ModeToggle from '../shared/ModeToggle';
import Overlay from '../shared/Overlay';
import PostWatchRanking from './PostWatchRanking';
import RerankDuel from './RerankDuel';
import SwipeCard from './SwipeCard';

const BUFFER = 5;
// Weave re-ranks in frequently — every 3-5 classifications, more often as the
// library grows and there's more to keep calibrated.
function rerankInterval(lib) {
  return Math.min(5, Math.max(3, 8 - Math.floor(lib / 6)));
}

// Stable key for a pair regardless of order.
function pairKey(a, b) {
  return [a.id, b.id].sort().join('|');
}

export default function RankMode({ onExit }) {
  const { state, dispatch } = useApp();
  const { watched } = useTitles();
  const mode = state.settings.mode || 'both';

  const [feed, setFeed] = useState([]);
  const [i, setI] = useState(0);
  const [flow, setFlow] = useState(null); // { kind:'place', title } | { kind:'duel', a, b }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const modeRef = useRef(mode);
  const knownIds = useRef(new Set());
  const page = useRef(0);
  const loadingMore = useRef(false);
  const exhausted = useRef(false);
  const sinceRerank = useRef(0);
  const shownPairs = useRef(new Set()); // avoid repeating the same re-rank matchup
  const started = useRef(false);

  const ensureBuffer = useCallback(async () => {
    if (loadingMore.current || exhausted.current) return;
    loadingMore.current = true;
    setError(false);
    try {
      let added = 0;
      const startPage = page.current;
      // Keep paging past pages that are entirely already-classified — only a
      // literally empty TMDB response (end of catalog) means we're done. Cap the
      // pages scanned per call so we don't spin forever if truly exhausted.
      while (added < 12 && page.current - startPage < 12) {
        page.current += 1;
        const titles = await feedPage(page.current, modeRef.current);
        if (!titles.length) {
          exhausted.current = true;
          break;
        }
        const fresh = titles.filter(
          (t) =>
            !knownIds.current.has(t.id) &&
            (modeRef.current === 'both' || t.type === modeRef.current)
        );
        if (!fresh.length) continue; // whole page already seen — try the next
        fresh.forEach((t) => knownIds.current.add(t.id));
        setFeed((f) => [...f, ...fresh]);
        added += fresh.length;
      }
    } catch {
      // TMDB unreachable / rate-limited — allow a retry.
      page.current -= 1;
      setError(true);
    } finally {
      loadingMore.current = false;
    }
  }, []);

  function retry() {
    exhausted.current = false;
    setError(false);
    setLoading(true);
    ensureBuffer().then(() => setLoading(false));
  }

  // Initial load — seed known ids from anything already classified.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    state.titles
      .filter((t) => t.watched || t.disliked || t.watchLater)
      .forEach((t) => knownIds.current.add(t.id));
    ensureBuffer().then(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild the feed when the Movie/TV/All mode changes.
  useEffect(() => {
    if (modeRef.current === mode) return;
    modeRef.current = mode;
    page.current = 0;
    exhausted.current = false;
    knownIds.current = new Set();
    state.titles
      .filter((t) => t.watched || t.disliked || t.watchLater)
      .forEach((t) => knownIds.current.add(t.id));
    setFeed([]);
    setI(0);
    setLoading(true);
    ensureBuffer().then(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Keep the buffer topped up.
  useEffect(() => {
    if (!loading && i >= feed.length - BUFFER) ensureBuffer();
  }, [i, feed.length, loading, ensureBuffer]);

  const card = feed[i];

  // After enough actions, weave in a re-rank of two existing ranked titles —
  // preferring adjacent pairs (best for refining order) that haven't been shown
  // recently, so the user doesn't see the same matchup over and over.
  function pickDuel(lib) {
    const pairs = [];
    for (let i = 0; i < lib.length - 1; i++) pairs.push([lib[i], lib[i + 1]]);
    // a few close-but-not-adjacent pairs for variety
    for (let i = 0; i + 2 < lib.length; i += 2) pairs.push([lib[i], lib[i + 2]]);
    let avail = pairs.filter(([a, b]) => !shownPairs.current.has(pairKey(a, b)));
    if (!avail.length) {
      shownPairs.current.clear(); // cycle through again once exhausted
      avail = pairs;
    }
    if (!avail.length) return null;
    // Prefer matchups involving an under-compared (provisional) title so the
    // least-certain rankings get sharpened first.
    const provisional = avail.filter(
      ([a, b]) => (a.comparisons || 0) < 3 || (b.comparisons || 0) < 3
    );
    const pool = provisional.length ? provisional : avail;
    const pair = pool[Math.floor(Math.random() * pool.length)];
    shownPairs.current.add(pairKey(pair[0], pair[1]));
    return pair;
  }

  function maybeRerank() {
    const lib = watched;
    if (lib.length < 4) return false;
    sinceRerank.current += 1;
    if (sinceRerank.current >= rerankInterval(lib.length)) {
      sinceRerank.current = 0;
      const pair = pickDuel(lib);
      if (pair) {
        setFlow({ kind: 'duel', a: pair[0], b: pair[1] });
        return true;
      }
    }
    return false;
  }

  function ensureInState(t) {
    if (!state.titles.find((x) => x.id === t.id)) {
      dispatch({ type: 'ADD_TITLE', title: { ...t, watched: false } });
    }
  }

  // "Yes" — seen it, place it in the ranked list.
  function yes() {
    if (!card || flow) return;
    ensureInState(card);
    dispatch({ type: 'MARK_WATCHED', id: card.id });
    setFlow({ kind: 'place', title: card });
  }

  // "Not Interested" — never recommend.
  function notInterested() {
    if (!card || flow) return;
    ensureInState(card);
    dispatch({ type: 'DISLIKE_TITLE', id: card.id });
    setI((n) => n + 1);
    maybeRerank();
  }

  // "No" — haven't seen it, add to Watch Later.
  function no() {
    if (!card || flow) return;
    ensureInState(card);
    dispatch({ type: 'ADD_WATCH_LATER', id: card.id });
    setI((n) => n + 1);
    maybeRerank();
  }

  function finishFlow() {
    const f = flow;
    setFlow(null);
    if (f?.kind === 'place') {
      setI((n) => n + 1);
      maybeRerank();
    }
  }

  useEffect(() => {
    function onKey(e) {
      if (flow) return;
      if (e.key === 'ArrowRight') yes();
      else if (e.key === 'ArrowLeft') notInterested();
      else if (e.key === 'ArrowUp') no();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, flow]);

  return (
    <div className="mx-auto flex h-screen max-w-md flex-col px-5 py-4">
      <div className="flex shrink-0 items-center justify-between">
        <button onClick={onExit} className="text-2xl text-sub hover:text-txt" aria-label="Back">
          ←
        </button>
        <span className="font-display text-lg text-txt">Discover</span>
        <span className="w-6" />
      </div>

      <ModeToggle
        value={mode}
        onChange={(m) => dispatch({ type: 'SET_SETTINGS', payload: { mode: m } })}
        className="mx-auto mt-3 shrink-0"
      />

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center py-3">
        {loading && <div className="h-full max-h-[46vh] w-full animate-pulse rounded-2xl bg-surface" />}
        {!loading && error && !card && (
          <div className="text-center text-sub">
            <p className="font-display text-xl text-txt">Couldn’t load titles.</p>
            <p className="mt-1 text-sm">Check your connection or TMDB key.</p>
            <button
              onClick={retry}
              className="mt-4 rounded-xl bg-accent px-6 py-2.5 font-semibold text-white active:scale-95"
            >
              Retry
            </button>
          </div>
        )}
        {!loading && !error && !card && (
          <div className="text-center text-sub">
            <p className="font-display text-2xl text-txt">That’s everything for now.</p>
            <p className="mt-1">Check back soon for more titles.</p>
          </div>
        )}
        {card && (
          <SwipeCard key={card.id} card={card} onYes={yes} onLater={no} onNo={notInterested} />
        )}
      </div>

      {card && (
        <div className="shrink-0 space-y-2 pb-1">
          <p className="text-center text-sm text-sub">Have you seen this?</p>
          <button
            onClick={yes}
            className="w-full rounded-xl bg-win py-3 font-semibold text-white transition-transform active:scale-95"
          >
            Yes — rank it
          </button>
          <div className="flex gap-2">
            <button
              onClick={no}
              className="flex-1 rounded-xl border border-accent bg-surface py-3 font-semibold text-accent transition-transform active:scale-95"
            >
              Add to Watch Later
            </button>
            <button
              onClick={notInterested}
              className="flex-1 rounded-xl border border-border bg-surface py-3 font-medium text-sub transition-transform active:scale-95"
            >
              Not Interested
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {flow && (
          <Overlay key="rank-flow">
            {flow.kind === 'place' ? (
              <PostWatchRanking title={flow.title} onDone={finishFlow} />
            ) : (
              <RerankDuel a={flow.a} b={flow.b} onDone={finishFlow} />
            )}
          </Overlay>
        )}
      </AnimatePresence>
    </div>
  );
}
