import { useState } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { useProviders } from '../../hooks/useTmdb';
import { useEscape } from '../../hooks/useEscape';
import GenreBadge from '../shared/GenreBadge';
import TypeBadge from '../shared/TypeBadge';

const FALLBACK =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="100%" height="100%" fill="#13131A"/></svg>`
  );

// Drag-down-to-dismiss thresholds — whichever trips first closes the card.
const DISMISS_OFFSET = 140;
const DISMISS_VELOCITY = 550;

// `onWatchLater` (optional) switches the card into coming-soon mode: the primary
// action becomes "Add to Watch Later" instead of "Watch This", and there's no
// "Not Interested" (you can't dislike something you haven't seen yet).
// `onAddToWatchLater` (optional) adds a secondary "Watch Later" button next to
// "Watch This" in the normal (already-released) flow, without replacing it.
export default function RevealCard({
  title,
  skipStreak,
  onWatch,
  onAddToWatchLater,
  onDislike,
  onClose,
  onRankNudge,
  onWatchLater,
}) {
  const providers = useProviders(title.id, title.type);
  const [expanded, setExpanded] = useState(false);
  const dragControls = useDragControls();
  useEscape(onClose);

  const synopsis = title.overview || 'No synopsis available.';
  const long = synopsis.length > 140;

  return (
    <motion.div
      drag="y"
      dragControls={dragControls}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.65 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) onClose();
      }}
      initial={{ y: '-100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      className="fixed inset-0 z-50 overflow-y-auto bg-bg"
    >
      <div className="mx-auto flex min-h-full max-w-lg flex-col px-5 pb-8 pt-1">
        <div
          onPointerDown={(e) => dragControls.start(e)}
          className="-mx-5 flex shrink-0 cursor-grab touch-none justify-center py-2.5 active:cursor-grabbing"
          aria-hidden="true"
        >
          <span className="h-1.5 w-10 rounded-full bg-border" />
        </div>

        <button
          onClick={onClose}
          className="self-start text-3xl text-sub hover:text-txt"
          aria-label="Close"
        >
          ✕
        </button>

        <motion.div
          key={title.id}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          // Width derived from height budget keeps the poster an exact 2:3 —
          // never cropped on desktop, never oversized on mobile.
          className="mx-auto mt-2 w-[calc(42dvh*2/3)] max-w-full overflow-hidden rounded-none border border-border shadow-card"
        >
          <div className="relative aspect-[2/3] w-full">
            <img
              src={title.poster || FALLBACK}
              alt={title.title}
              onError={(e) => (e.currentTarget.src = FALLBACK)}
              className="absolute inset-0 h-full w-full object-cover"
            />
            {onWatchLater && title.releaseDate && (
              <span className="absolute left-2 top-2 rounded-none bg-gold px-2.5 py-0.5 text-xs font-semibold text-black">
                {title.releaseDate}
              </span>
            )}
          </div>
        </motion.div>

        <h1 className="mt-4 font-display text-3xl leading-tight text-txt">{title.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <TypeBadge type={title.type} />
          <span className="text-sm text-sub">
            {title.year || '—'}
            {title.genres?.length ? ` · ${title.genres.slice(0, 3).join(', ')}` : ''}
          </span>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-sub">
          {expanded || !long ? synopsis : synopsis.slice(0, 140).trimEnd() + '… '}
          {long && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-accent hover:underline"
            >
              {expanded ? 'less' : 'more'}
            </button>
          )}
        </p>

        {providers.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-sub">📺 Available on:</span>
            {providers.map((p) => (
              <GenreBadge key={p}>{p}</GenreBadge>
            ))}
          </div>
        )}

        {skipStreak >= 5 && (
          <button
            onClick={onRankNudge}
            className="mt-4 text-sm text-accent hover:underline"
          >
            Your rankings could use a refresh — Rank Titles →
          </button>
        )}

        <div className="mt-6 flex gap-3">
          {onWatchLater ? (
            <button
              onClick={onWatchLater}
              className="flex-1 rounded-none bg-gold py-4 font-semibold text-black transition-transform active:scale-95"
            >
              🔖 Add to Watch Later
            </button>
          ) : (
            <button
              onClick={onWatch}
              className="flex-1 rounded-none bg-win py-4 font-semibold text-white transition-transform active:scale-95"
            >
              ✓ Watch This
            </button>
          )}
          {onWatchLater ? (
            <button
              onClick={onClose}
              className="rounded-none border border-border bg-surface px-6 py-4 font-medium text-sub transition-transform active:scale-95 hover:text-txt"
            >
              Close
            </button>
          ) : (
            onAddToWatchLater && !title.watchLater && (
              <button
                onClick={onAddToWatchLater}
                className="rounded-none border border-gold/50 bg-surface px-5 py-4 font-medium text-gold transition-transform active:scale-95 hover:bg-gold/10"
              >
                🔖 Watch Later
              </button>
            )
          )}
        </div>
        {onDislike && !onWatchLater && (
          <button
            onClick={onDislike}
            className="mt-3 self-center text-sm text-neutral hover:text-sub"
          >
            Not Interested
          </button>
        )}
      </div>
    </motion.div>
  );
}
