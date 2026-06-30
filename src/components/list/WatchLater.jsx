import { useState } from 'react';
import { AnimatePresence, Reorder } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import TypeBadge from '../shared/TypeBadge';
import Overlay from '../shared/Overlay';
import PostWatchRanking from '../ranking/PostWatchRanking';

const FALLBACK =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="120"><rect width="100%" height="100%" fill="#13131A"/></svg>`
  );

export default function WatchLater({ onExit }) {
  const { state, dispatch } = useApp();
  const [ranking, setRanking] = useState(null);

  // Resolve the manual order into live title objects.
  const items = (state.watchLater || [])
    .map((id) => state.titles.find((t) => t.id === id))
    .filter((t) => t && !t.watched && !t.disliked);

  function reorder(newItems) {
    dispatch({ type: 'REORDER_WATCH_LATER', order: newItems.map((t) => t.id) });
  }

  function seen(t) {
    dispatch({ type: 'MARK_WATCHED', id: t.id });
    setRanking(t);
  }

  function finishRanking() {
    setRanking(null);
  }

  return (
    <div className="mx-auto flex h-screen max-w-2xl flex-col px-5 py-5">
      <div className="flex shrink-0 items-center gap-3">
        <button onClick={onExit} className="text-2xl text-sub hover:text-txt" aria-label="Back">
          ←
        </button>
        <h1 className="font-display text-2xl text-txt">Watch Later</h1>
      </div>
      <p className="mt-1 shrink-0 text-sm text-sub">
        Drag to reorder — titles near the top get suggested more.
      </p>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
        {!items.length && (
          <p className="mt-10 text-center text-sub">
            Nothing here yet. Add titles from Rank Mode by tapping “No”.
          </p>
        )}

        <Reorder.Group axis="y" values={items} onReorder={reorder} className="space-y-2">
          {items.map((t, idx) => (
            <Reorder.Item
              key={t.id}
              value={t}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface p-2"
            >
              <span className="w-6 shrink-0 cursor-grab text-center text-neutral active:cursor-grabbing">
                ⋮⋮
              </span>
              <span className="w-5 shrink-0 text-center font-display text-sub">{idx + 1}</span>
              <img
                src={t.poster || FALLBACK}
                alt={t.title}
                onError={(e) => (e.currentTarget.src = FALLBACK)}
                className="h-14 w-10 shrink-0 rounded object-cover"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-txt">{t.title}</span>
                <span className="mt-1 flex items-center gap-2 text-sm text-sub">
                  <TypeBadge type={t.type} />
                  <span className="truncate">{t.year || '—'}</span>
                </span>
              </span>
              <button
                onClick={() => seen(t)}
                className="shrink-0 rounded-lg bg-win px-3 py-1.5 text-sm font-semibold text-white active:scale-95"
              >
                Seen
              </button>
              <button
                onClick={() => dispatch({ type: 'REMOVE_WATCH_LATER', id: t.id })}
                className="shrink-0 px-2 text-sub hover:text-txt"
                aria-label="Remove"
              >
                ✕
              </button>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      </div>

      <AnimatePresence>
        {ranking && (
          <Overlay key="wl-rank">
            <PostWatchRanking title={ranking} onDone={finishRanking} />
          </Overlay>
        )}
      </AnimatePresence>
    </div>
  );
}
