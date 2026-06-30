import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { useTitles } from '../../hooks/useTitles';
import { feedPage } from '../../services/tmdbApi';
import GenreBadge from '../shared/GenreBadge';
import TypeBadge from '../shared/TypeBadge';
import ModeToggle from '../shared/ModeToggle';
import Overlay from '../shared/Overlay';
import PostWatchRanking from './PostWatchRanking';
import RerankDuel from './RerankDuel';

const FALLBACK =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="100%" height="100%" fill="#13131A"/></svg>`
  );

const BUFFER = 5;
// Weave a re-rank of existing titles in more often as the library grows.
function rerankInterval(lib) {
  return Math.min(9, Math.max(5, 13 - Math.floor(lib / 8)));
}

export default function RankMode({ onExit }) {
  const { state, dispatch } = useApp();
  const { watched } = useTitles();
  const mode = state.settings.mode || 'both';

  const [feed, setFeed] = useState([]);
  const [i, setI] = useState(0);
  const [count, setCount] = useState(0);
  const [flow, setFlow] = useState(null); // { kind:'place', title } | { kind:'duel', a, b }
  const [loading, setLoading] = useState(true);

  const modeRef = useRef(mode);
  const knownIds = useRef(new Set());
  const page = useRef(0);
  const loadingMore = useRef(false);
  const exhausted = useRef(false);
  const sinceRerank = useRef(0);
  const started = useRef(false);

  const ensureBuffer = useCallback(async () => {
    if (loadingMore.current || exhausted.current) return;
    loadingMore.current = true;
    try {
      let added = 0;
      let empties = 0;
      while (added < 12 && empties < 2) {
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

  // After enough actions, weave in a re-rank of two existing ranked titles.
  function maybeRerank() {
    const lib = watched;
    if (lib.length < 4) return false;
    sinceRerank.current += 1;
    if (sinceRerank.current >= rerankInterval(lib.length)) {
      sinceRerank.current = 0;
      const idx = Math.floor(Math.random() * (lib.length - 1));
      setFlow({ kind: 'duel', a: lib[idx], b: lib[idx + 1] });
      return true;
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
    setCount((c) => c + 1);
    setI((n) => n + 1);
    maybeRerank();
  }

  // "No" — haven't seen it, add to Watch Later.
  function no() {
    if (!card || flow) return;
    ensureInState(card);
    dispatch({ type: 'ADD_WATCH_LATER', id: card.id });
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
      if (e.key === 'ArrowRight') yes();
      else if (e.key === 'ArrowLeft') notInterested();
      else if (e.key === 'ArrowUp') no();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, flow]);

  function onDragEnd(_, info) {
    if (flow) return;
    const { x, y } = info.offset;
    if (y < -100) no();
    else if (x > 100) yes();
    else if (x < -100) notInterested();
  }

  return (
    <div className="mx-auto flex h-screen max-w-md flex-col px-5 py-4">
      <div className="flex shrink-0 items-center justify-between">
        <button onClick={onExit} className="text-2xl text-sub hover:text-txt" aria-label="Back">
          ←
        </button>
        <span className="text-sm text-sub">
          {count > 0 ? `${count} this session` : 'Have you seen this?'}
        </span>
      </div>

      <ModeToggle
        value={mode}
        onChange={(m) => dispatch({ type: 'SET_SETTINGS', payload: { mode: m } })}
        className="mx-auto mt-3 shrink-0"
      />

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center py-3">
        {loading && <div className="h-full max-h-[46vh] w-full animate-pulse rounded-xl bg-surface" />}
        {!loading && !card && (
          <div className="text-center text-sub">
            <p className="font-display text-2xl text-txt">All caught up.</p>
            <p className="mt-1">{count} sorted this session.</p>
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
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex w-full cursor-grab flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-card active:cursor-grabbing"
            >
              <img
                src={card.poster || FALLBACK}
                alt={card.title}
                onError={(e) => (e.currentTarget.src = FALLBACK)}
                className="max-h-[42vh] w-full object-cover"
              />
              <div className="p-3">
                <div className="font-display text-xl leading-tight text-txt">{card.title}</div>
                <div className="mt-0.5 text-sm text-sub">
                  {card.year || '—'} · ★ {(card.rating || 0).toFixed(1)}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <TypeBadge type={card.type} />
                  {(card.genres || []).slice(0, 2).map((g) => (
                    <GenreBadge key={g}>{g}</GenreBadge>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {card && (
        <div className="shrink-0 space-y-2 pb-1">
          <p className="text-center text-sm text-sub">Have you seen this?</p>
          <div className="flex gap-2">
            <button
              onClick={yes}
              className="flex-1 rounded-xl bg-win py-3 font-semibold text-white active:scale-95"
            >
              Yes
            </button>
            <button
              onClick={no}
              className="flex-1 rounded-xl border border-accent bg-surface py-3 font-semibold text-accent active:scale-95"
            >
              No
            </button>
            <button
              onClick={notInterested}
              className="flex-1 rounded-xl border border-border bg-surface py-3 font-medium text-sub active:scale-95"
            >
              Not for me
            </button>
          </div>
          <p className="text-center text-[11px] text-neutral">
            Yes = rank it · No = Watch Later · Not for me = hide
          </p>
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
