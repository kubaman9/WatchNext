import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { feedPage } from '../../services/tmdbApi';
import GenreBadge from '../shared/GenreBadge';
import TypeBadge from '../shared/TypeBadge';
import Overlay from '../shared/Overlay';
import PostWatchRanking from './PostWatchRanking';

const FALLBACK =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="100%" height="100%" fill="#13131A"/></svg>`
  );

const BUFFER = 5; // fetch more when this close to the end
// Re-rank an existing title roughly every N classifications, more often as the
// library grows (so big lists stay calibrated). Clamped to a sane range.
function rerankInterval(libraryCount) {
  return Math.min(8, Math.max(4, 12 - Math.floor(libraryCount / 8)));
}

export default function RankMode({ onExit }) {
  const { state, dispatch } = useApp();
  const [feed, setFeed] = useState([]);
  const [i, setI] = useState(0);
  const [count, setCount] = useState(0);
  const [flow, setFlow] = useState(null); // { title, kind: 'place' | 'rerank' }
  const [loading, setLoading] = useState(true);
  const [exhausted, setExhausted] = useState(false);

  const mode = useRef(state.settings.mode || 'both');
  const knownIds = useRef(new Set());
  const page = useRef(0);
  const loadingMore = useRef(false);
  const exhaustedRef = useRef(false);
  const sinceRerank = useRef(0);
  const started = useRef(false);

  // Pull the next page(s) of fresh titles, skipping anything already shown or
  // already classified. Keeps the feed effectively infinite on live TMDB.
  const ensureBuffer = useCallback(async () => {
    if (loadingMore.current || exhaustedRef.current) return;
    loadingMore.current = true;
    try {
      let added = 0;
      let empties = 0;
      while (added < 12 && empties < 2) {
        page.current += 1;
        const titles = await feedPage(page.current, mode.current);
        if (!titles.length) {
          exhaustedRef.current = true;
          setExhausted(true);
          break;
        }
        const fresh = titles.filter(
          (t) =>
            !knownIds.current.has(t.id) &&
            (mode.current === 'both' || t.type === mode.current)
        );
        if (!fresh.length) {
          empties += 1;
          continue;
        }
        fresh.forEach((t) => knownIds.current.add(t.id));
        setFeed((f) => [...f, ...fresh]);
        added += fresh.length;
      }
    } finally {
      loadingMore.current = false;
    }
  }, []);

  // Initial load: seed known ids from already-classified titles, then fill.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    state.titles
      .filter((t) => t.watched || t.disliked)
      .forEach((t) => knownIds.current.add(t.id));
    ensureBuffer().then(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Top up the buffer as the user nears the end.
  useEffect(() => {
    if (!loading && i >= feed.length - BUFFER) ensureBuffer();
  }, [i, feed.length, loading, ensureBuffer]);

  const card = feed[i];

  function maybeRerank() {
    const lib = state.titles.filter((t) => t.watched && !t.disliked);
    if (lib.length < 4) return false;
    sinceRerank.current += 1;
    if (sinceRerank.current >= rerankInterval(lib.length)) {
      sinceRerank.current = 0;
      const pick = lib[Math.floor(Math.random() * lib.length)];
      setFlow({ title: pick, kind: 'rerank' });
      return true;
    }
    return false;
  }

  function seen() {
    if (!card || flow) return;
    dispatch({ type: 'ADD_TITLE', title: { ...card, watched: false } });
    dispatch({ type: 'MARK_WATCHED', id: card.id });
    setFlow({ title: card, kind: 'place' });
  }

  function pass() {
    if (!card || flow) return;
    dispatch({ type: 'ADD_TITLE', title: card });
    dispatch({ type: 'DISLIKE_TITLE', id: card.id });
    setCount((c) => c + 1);
    setI((n) => n + 1);
    maybeRerank();
  }

  function addToList() {
    if (!card || flow) return;
    dispatch({ type: 'ADD_TITLE', title: card });
    setCount((c) => c + 1);
    setI((n) => n + 1);
    maybeRerank();
  }

  function finishFlow() {
    const f = flow;
    setFlow(null);
    if (f?.kind === 'place') {
      setCount((c) => c + 1);
      setI((n) => n + 1);
      maybeRerank();
    }
  }

  useEffect(() => {
    function onKey(e) {
      if (flow) return;
      if (e.key === 'ArrowRight') seen();
      else if (e.key === 'ArrowLeft') pass();
      else if (e.key === 'ArrowUp') addToList();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, flow]);

  function onDragEnd(_, info) {
    if (flow) return;
    const { x, y } = info.offset;
    if (y < -120) addToList();
    else if (x > 120) seen();
    else if (x < -120) pass();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-5">
      <div className="flex items-center justify-between">
        <button onClick={onExit} className="text-2xl text-sub hover:text-txt" aria-label="Back">
          ←
        </button>
        <span className="text-sm text-sub">
          {count > 0 ? `${count} ranked this session` : 'Rank Titles'}
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center">
        {loading && <div className="h-[60vh] w-full animate-pulse rounded-xl bg-surface" />}
        {!loading && !card && (
          <div className="text-center text-sub">
            <p className="font-display text-2xl text-txt">All caught up.</p>
            <p className="mt-1">{count} ranked this session — recommendations sharpened.</p>
          </div>
        )}
        <AnimatePresence mode="wait">
          {card && (
            <motion.div
              key={card.id}
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              dragElastic={0.6}
              onDragEnd={onDragEnd}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full cursor-grab overflow-hidden rounded-xl border border-border bg-surface shadow-card active:cursor-grabbing"
            >
              <img
                src={card.poster || FALLBACK}
                alt={card.title}
                onError={(e) => (e.currentTarget.src = FALLBACK)}
                className="max-h-[55vh] w-full object-cover"
              />
              <div className="p-4">
                <div className="font-display text-2xl text-txt">{card.title}</div>
                <div className="mt-1 text-sm text-sub">
                  {card.year || '—'} · ★ {(card.rating || 0).toFixed(1)}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <TypeBadge type={card.type} />
                  {(card.genres || []).slice(0, 3).map((g) => (
                    <GenreBadge key={g}>{g}</GenreBadge>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {card && (
        <div className="flex flex-col gap-3 pb-2">
          <div className="flex gap-3">
            <button
              onClick={seen}
              className="flex-1 rounded-xl bg-win py-3 font-semibold text-white active:scale-95"
            >
              ✓ Seen
            </button>
            <button
              onClick={pass}
              className="flex-1 rounded-xl border border-border bg-surface py-3 font-medium text-sub active:scale-95"
            >
              ✕ Pass
            </button>
          </div>
          <button onClick={addToList} className="text-sm text-sub hover:text-txt">
            ↑ Haven’t seen, add to list
          </button>
        </div>
      )}

      <AnimatePresence>
        {flow && (
          <Overlay key="rank-flow">
            {flow.kind === 'rerank' && (
              <p className="mb-4 text-sm uppercase tracking-wider text-gold">Quick re-rank</p>
            )}
            <PostWatchRanking title={flow.title} onDone={finishFlow} />
          </Overlay>
        )}
      </AnimatePresence>

      {!loading && exhausted && card && (
        <p className="pb-1 text-center text-xs text-neutral">End of the catalog is near.</p>
      )}
    </div>
  );
}
