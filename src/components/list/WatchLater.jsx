import { useEffect, useRef, useState } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import TypeBadge from '../shared/TypeBadge';
import Overlay from '../shared/Overlay';
import SearchSheet from '../shared/SearchSheet';
import PostWatchRanking from '../ranking/PostWatchRanking';

const FALLBACK =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="120"><rect width="100%" height="100%" fill="#13131A"/></svg>`
  );

const EDGE = 90; // px from a container edge where auto-scroll kicks in

// One reorderable row. Dragging is gated to the ⋮⋮ handle so the list still
// scrolls normally by touch; while dragging, it reports the pointer position so
// the parent can auto-scroll when you reach the top/bottom of the screen.
function WatchLaterRow({ t, idx, onSeen, onRemove, onHandleDrag }) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={t}
      dragListener={false}
      dragControls={controls}
      onDrag={(e, info) => onHandleDrag(info.point.y)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      whileDrag={{ scale: 1.03, boxShadow: '0 12px 30px -8px rgba(0,0,0,0.7)' }}
      className="flex items-center gap-3 rounded-none border border-border bg-surface p-2"
    >
      <span
        onPointerDown={(e) => controls.start(e)}
        className="w-6 shrink-0 cursor-grab touch-none select-none text-center text-lg text-neutral active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        ⋮⋮
      </span>
      <span className="w-5 shrink-0 text-center font-display text-sub">{idx + 1}</span>
      <img
        src={t.poster || FALLBACK}
        alt={t.title}
        onError={(e) => (e.currentTarget.src = FALLBACK)}
        className="h-14 w-10 shrink-0 rounded-none object-cover"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-txt">{t.title}</span>
        <span className="mt-1 flex items-center gap-2 text-sm text-sub">
          <TypeBadge type={t.type} />
          <span className="truncate">{t.year || '—'}</span>
        </span>
      </span>
      <button
        onClick={onSeen}
        className="shrink-0 rounded-none bg-win px-3 py-1.5 text-sm font-semibold text-white active:scale-95"
      >
        Seen
      </button>
      <button
        onClick={onRemove}
        className="shrink-0 px-2 text-sub hover:text-txt"
        aria-label="Remove"
      >
        ✕
      </button>
    </Reorder.Item>
  );
}

export default function WatchLater() {
  const { state, dispatch } = useApp();
  const [ranking, setRanking] = useState(null);
  const [adding, setAdding] = useState(false);
  const scrollRef = useRef(null);
  const velRef = useRef(0);

  function addTitle(t) {
    if (!state.titles.find((x) => x.id === t.id)) {
      dispatch({ type: 'ADD_TITLE', title: { ...t, watched: false } });
    }
    dispatch({ type: 'ADD_WATCH_LATER', id: t.id });
  }

  // Continuous auto-scroll loop — runs cheaply, only scrolls when velocity is set
  // (i.e. while a row is being dragged near an edge).
  useEffect(() => {
    let raf;
    const tick = () => {
      const el = scrollRef.current;
      if (el && velRef.current) el.scrollTop += velRef.current;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const stop = () => (velRef.current = 0);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, []);

  function onHandleDrag(pointerY) {
    const el = scrollRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (pointerY < r.top + EDGE) velRef.current = -Math.ceil((r.top + EDGE - pointerY) / 5) - 2;
    else if (pointerY > r.bottom - EDGE) velRef.current = Math.ceil((pointerY - (r.bottom - EDGE)) / 5) + 2;
    else velRef.current = 0;
  }

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

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col px-5 py-5">
      <div className="flex shrink-0 items-center gap-3">
        <h1 className="font-display text-2xl text-txt">Watch Later</h1>
        <button
          onClick={() => setAdding(true)}
          className="ml-auto rounded-none border border-accent px-3 py-1 text-sm font-medium text-accent active:scale-95"
        >
          + Add a title
        </button>
      </div>
      <p className="mt-1 shrink-0 text-sm text-sub">
        Drag the ⋮⋮ handle to reorder — titles near the top get suggested more.
      </p>

      <div ref={scrollRef} className="mt-4 min-h-0 flex-1 overflow-y-auto">
        {!items.length && (
          <p className="mt-10 text-center text-sub">
            Nothing here yet. Add titles from Discover by tapping “Add to Watch Later”.
          </p>
        )}

        <Reorder.Group axis="y" values={items} onReorder={reorder} layoutScroll className="space-y-2">
          {items.map((t, idx) => (
            <WatchLaterRow
              key={t.id}
              t={t}
              idx={idx}
              onSeen={() => seen(t)}
              onRemove={() => dispatch({ type: 'REMOVE_WATCH_LATER', id: t.id })}
              onHandleDrag={onHandleDrag}
            />
          ))}
        </Reorder.Group>
      </div>

      {/* No AnimatePresence — battle-subtree exits hang (see RankMode). */}
      {ranking && (
        <Overlay key="wl-rank">
          <PostWatchRanking title={ranking} onDone={() => setRanking(null)} />
        </Overlay>
      )}

      <SearchSheet
        open={adding}
        onClose={() => setAdding(false)}
        onSelect={addTitle}
        selectedIds={(state.watchLater || [])}
        title="Add to Watch Later"
        subtitle="Tap a title to add it — add as many as you like."
      />
    </div>
  );
}
