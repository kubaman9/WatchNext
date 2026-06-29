import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { usePool } from '../../hooks/useTmdb';
import GenreBadge from '../shared/GenreBadge';
import Overlay from '../shared/Overlay';
import PostWatchRanking from './PostWatchRanking';

const FALLBACK =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="100%" height="100%" fill="#13131A"/></svg>`
  );

export default function RankMode({ onExit }) {
  const { state, dispatch } = useApp();
  const buildPool = usePool();
  const [feed, setFeed] = useState([]);
  const [i, setI] = useState(0);
  const [count, setCount] = useState(0);
  const [ranking, setRanking] = useState(null);
  const [loading, setLoading] = useState(true);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    buildPool(40).then((titles) => {
      const classified = new Set(
        state.titles.filter((t) => t.watched || t.disliked).map((t) => t.id)
      );
      setFeed(titles.filter((t) => !classified.has(t.id)));
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const card = feed[i];

  function advance() {
    setI((n) => n + 1);
  }

  function seen() {
    if (!card) return;
    dispatch({ type: 'ADD_TITLE', title: { ...card, watched: false } });
    dispatch({ type: 'MARK_WATCHED', id: card.id });
    setRanking(card);
  }

  function pass() {
    if (!card) return;
    dispatch({ type: 'ADD_TITLE', title: card });
    dispatch({ type: 'DISLIKE_TITLE', id: card.id });
    setCount((c) => c + 1);
    advance();
  }

  function addToList() {
    if (!card) return;
    dispatch({ type: 'ADD_TITLE', title: card });
    setCount((c) => c + 1);
    advance();
  }

  function finishRanking() {
    setRanking(null);
    setCount((c) => c + 1);
    advance();
  }

  useEffect(() => {
    function onKey(e) {
      if (ranking) return;
      if (e.key === 'ArrowRight') seen();
      else if (e.key === 'ArrowLeft') pass();
      else if (e.key === 'ArrowUp') addToList();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, ranking]);

  function onDragEnd(_, info) {
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
                  {card.year || '—'} · {card.type === 'tv' ? 'TV' : 'Movie'} · ★{' '}
                  {(card.rating || 0).toFixed(1)}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
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
        {ranking && (
          <Overlay key="rank-battle">
            <PostWatchRanking title={ranking} onDone={finishRanking} />
          </Overlay>
        )}
      </AnimatePresence>
    </div>
  );
}
