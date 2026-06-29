import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import GenreBadge from '../shared/GenreBadge';
import TypeBadge from '../shared/TypeBadge';
import Overlay from '../shared/Overlay';
import PostWatchRanking from './PostWatchRanking';

const FALLBACK =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="100%" height="100%" fill="#13131A"/></svg>`
  );

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Trigger a re-rank of an existing watched title more often as library grows.
function rerankInterval(libraryCount) {
  return Math.min(8, Math.max(4, 12 - Math.floor(libraryCount / 8)));
}

export default function RankMode({ onExit }) {
  const { state, dispatch } = useApp();

  // Build a randomized queue from Watch Later on mount — never sorted the same way twice.
  const queueRef = useRef(null);
  const [queueIdx, setQueueIdx] = useState(0);
  const [flow, setFlow] = useState(null); // { title, kind: 'place' | 'rerank' }
  const [count, setCount] = useState(0);
  const sinceRerank = useRef(0);

  if (queueRef.current === null) {
    const watchLater = state.titles.filter((t) => !t.watched && !t.disliked);
    queueRef.current = shuffle(watchLater);
  }

  const queue = queueRef.current;

  // Resolve current card against live state so changes (watched/disliked elsewhere) are reflected.
  const rawCard = queue[queueIdx] ?? null;
  const liveCard = rawCard ? (state.titles.find((t) => t.id === rawCard.id) ?? rawCard) : null;
  const card = liveCard && !liveCard.watched && !liveCard.disliked ? liveCard : null;

  // Skip cards that became stale (watched/disliked outside this screen).
  useEffect(() => {
    if (rawCard && !card && !flow) {
      setQueueIdx((n) => n + 1);
    }
  }, [rawCard, card, flow]);

  // When the queue runs out, reshuffle any remaining Watch Later items for a continuous feed.
  useEffect(() => {
    if (queueIdx >= queue.length && !flow) {
      const remaining = state.titles.filter((t) => !t.watched && !t.disliked);
      if (remaining.length > 0) {
        queueRef.current = shuffle(remaining);
        setQueueIdx(0);
      }
    }
  }, [queueIdx, flow, queue.length, state.titles]);

  const watchLaterCount = state.titles.filter((t) => !t.watched && !t.disliked).length;
  const exhausted = queueIdx >= queue.length && watchLaterCount === 0;

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

  function triggerRerank() {
    const lib = state.titles.filter((t) => t.watched && !t.disliked);
    if (!lib.length) return;
    const pick = lib[Math.floor(Math.random() * lib.length)];
    setFlow({ title: pick, kind: 'rerank' });
  }

  function advance() {
    setCount((c) => c + 1);
    setQueueIdx((n) => n + 1);
  }

  function seenIt() {
    if (!card || flow) return;
    if (!state.titles.find((t) => t.id === card.id)) {
      dispatch({ type: 'ADD_TITLE', title: { ...card, watched: false } });
    }
    dispatch({ type: 'MARK_WATCHED', id: card.id });
    setFlow({ title: card, kind: 'place' });
  }

  function haventSeen() {
    // Item stays on Watch Later; advance without any state change.
    if (!card || flow) return;
    if (!state.titles.find((t) => t.id === card.id)) {
      dispatch({ type: 'ADD_TITLE', title: card });
    }
    advance();
    maybeRerank();
  }

  function pass() {
    // Not interested — mark disliked and remove from Watch Later.
    if (!card || flow) return;
    dispatch({ type: 'DISLIKE_TITLE', id: card.id });
    advance();
    maybeRerank();
  }

  function finishFlow() {
    const f = flow;
    setFlow(null);
    if (f?.kind === 'place') {
      advance();
      maybeRerank();
    }
  }

  useEffect(() => {
    function onKey(e) {
      if (flow) return;
      if (e.key === 'ArrowRight') seenIt();
      else if (e.key === 'ArrowLeft') pass();
      else if (e.key === 'ArrowUp') haventSeen();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, flow]);

  function onDragEnd(_, info) {
    if (flow) return;
    const { x, y } = info.offset;
    if (y < -120) haventSeen();
    else if (x > 120) seenIt();
    else if (x < -120) pass();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-5">
      <div className="flex items-center justify-between">
        <button onClick={onExit} className="text-2xl text-sub hover:text-txt" aria-label="Back">
          ←
        </button>
        <span className="text-sm text-sub">
          {count > 0 ? `${count} ranked this session` : 'Your Watch List'}
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center">
        {!card && !exhausted && (
          <div className="h-[60vh] w-full animate-pulse rounded-xl bg-surface" />
        )}
        {exhausted && (
          <div className="text-center">
            <p className="font-display text-2xl text-txt">Watch Later is empty.</p>
            <p className="mt-1 text-sub">
              {count > 0 ? `${count} ranked this session. ` : ''}
              Add more titles, or keep calibrating your rankings.
            </p>
            {state.titles.filter((t) => t.watched && !t.disliked).length >= 4 && (
              <button
                onClick={triggerRerank}
                className="mt-5 rounded-xl bg-accent px-6 py-3 font-semibold text-white active:scale-95"
              >
                Re-rank Existing Titles
              </button>
            )}
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
          <button
            onClick={haventSeen}
            className="w-full rounded-xl border border-accent bg-surface py-4 font-semibold text-accent active:scale-95"
          >
            Haven't Seen It — Keep on Watch Later
          </button>
          <div className="flex gap-3">
            <button
              onClick={seenIt}
              className="flex-1 rounded-xl bg-win py-3 font-semibold text-white active:scale-95"
            >
              Just Watched It
            </button>
            <button
              onClick={pass}
              className="flex-1 rounded-xl border border-border bg-surface py-3 font-medium text-sub active:scale-95"
            >
              Pass
            </button>
          </div>
          <p className="text-center text-xs text-neutral">
            Ranking your list · not a recommendations feed
          </p>
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
    </div>
  );
}
