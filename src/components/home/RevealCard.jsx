import { useEffect, useRef, useState } from 'react';
import { motion, useDragControls, useMotionValue, useTransform, animate } from 'framer-motion';
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

const TAP = { type: 'spring', stiffness: 420, damping: 26 };

// A horizontal "slide to confirm" control — drag the tab all the way across
// the track to add the title to the top of Watch Later. Releasing short of
// the end snaps back. Replaces a plain tap button so the commitment feels
// deliberate instead of a single accidental tap.
function SlideToWatchLater({ onConfirm }) {
  const trackRef = useRef(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const x = useMotionValue(0);
  const tabSize = 44;
  const maxX = Math.max(trackWidth - tabSize, 1);

  useEffect(() => {
    if (trackRef.current) setTrackWidth(trackRef.current.offsetWidth);
  }, []);

  const fillWidth = useTransform(x, (v) => v + tabSize);
  const labelOpacity = useTransform(x, [0, maxX * 0.55], [1, 0]);

  function handleDragEnd() {
    if (x.get() / maxX > 0.72) {
      animate(x, maxX, TAP);
      setConfirmed(true);
      onConfirm();
    } else {
      animate(x, 0, TAP);
    }
  }

  if (confirmed) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex h-14 flex-1 items-center justify-center gap-1.5 rounded-none border border-gold bg-gold/15 text-sm font-semibold text-gold"
      >
        ✓ Added to top of Watch Later
      </motion.div>
    );
  }

  return (
    <div
      ref={trackRef}
      className="relative h-14 flex-1 touch-none overflow-hidden rounded-none border border-gold/50 bg-surface"
    >
      <motion.div className="absolute inset-y-0 left-0 bg-gold/20" style={{ width: fillWidth }} />
      <motion.p
        style={{ opacity: labelOpacity }}
        className="pointer-events-none absolute inset-0 flex items-center justify-center truncate px-12 text-[11px] font-medium text-gold"
      >
        🔖 Slide to add to top of Watch Later
      </motion.p>
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: maxX }}
        dragElastic={0}
        dragMomentum={false}
        style={{ x }}
        onDragEnd={handleDragEnd}
        onPointerDown={(e) => e.stopPropagation()}
        whileTap={{ scale: 1.12 }}
        transition={TAP}
        className="absolute left-0 top-0 flex h-14 w-11 cursor-grab items-center justify-center bg-gold text-lg text-black active:cursor-grabbing"
      >
        🔖
      </motion.div>
    </div>
  );
}

// `onWatchLater` (optional) switches the card into coming-soon mode: the primary
// action becomes "Add to Watch Later" instead of "Watch This", and there's no
// "Not Interested" / "Already Watched" (nothing to judge on an unreleased title).
// `onAddToWatchLater` (optional) adds a secondary slide-to-confirm Watch Later
// control next to "Watch This" in the normal (already-released) flow.
// `onAlreadyWatched` (optional) quietly logs it as watched without implying
// you're about to watch it right now — for when a "fresh" suggestion turns out
// to be something you'd already seen.
export default function RevealCard({
  title,
  skipStreak,
  onWatch,
  onAddToWatchLater,
  onAlreadyWatched,
  onDislike,
  onClose,
  onRankNudge,
  onWatchLater,
}) {
  const providers = useProviders(title.id, title.type);
  const [expanded, setExpanded] = useState(false);
  const dragControls = useDragControls();
  const closeTimer = useRef();
  useEscape(onClose);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const synopsis = title.overview || 'No synopsis available.';
  const long = synopsis.length > 140;

  // Confirming Watch Later dispatches immediately but leaves the card open
  // just long enough to show the ✓, then closes (which also refreshes the
  // five-pick grid underneath — see HomeScreen's closeReveal).
  function confirmWatchLater() {
    onAddToWatchLater();
    closeTimer.current = setTimeout(() => onClose(), 900);
  }

  // Holographic tilt-card effect on the poster: it leans away from wherever
  // the pointer is, with a light sheen sweeping across — a "cool" tactile
  // detail that's purely cosmetic (no drag-to-decide to fight with the
  // handle's drag-to-dismiss, and nothing to misfire on a scroll or tap).
  const tiltX = useMotionValue(0); // -0.5 .. 0.5 across the poster's width
  const tiltY = useMotionValue(0);
  const rotateX = useTransform(tiltY, [-0.5, 0.5], [9, -9]);
  const rotateY = useTransform(tiltX, [-0.5, 0.5], [-9, 9]);
  const sheenX = useTransform(tiltX, [-0.5, 0.5], ['-30%', '130%']);

  function handlePosterPointerMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    tiltX.set((e.clientX - rect.left) / rect.width - 0.5);
    tiltY.set((e.clientY - rect.top) / rect.height - 0.5);
  }
  function resetTilt() {
    animate(tiltX, 0, TAP);
    animate(tiltY, 0, TAP);
  }

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

        <div
          style={{ perspective: 900 }}
          className="mx-auto mt-2 w-[calc(42dvh*2/3)] max-w-full"
        >
          <motion.div
            key={title.id}
            onPointerMove={handlePosterPointerMove}
            onPointerLeave={resetTilt}
            onPointerUp={resetTilt}
            style={{ rotateX, rotateY }}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            // Width derived from height budget keeps the poster an exact 2:3 —
            // never cropped on desktop, never oversized on mobile.
            className="relative overflow-hidden rounded-none border border-border shadow-card"
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
              <motion.div
                style={{ left: sheenX }}
                className="pointer-events-none absolute inset-y-0 w-1/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              />
            </div>
          </motion.div>
        </div>

        <h1 className="mt-3 font-display text-3xl leading-tight text-txt">{title.title}</h1>
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
            <motion.button
              onClick={onWatchLater}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              transition={TAP}
              className="flex-1 rounded-none bg-gold py-4 font-semibold text-black shadow-card"
            >
              🔖 Add to Watch Later
            </motion.button>
          ) : (
            <motion.button
              onClick={onWatch}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              transition={TAP}
              className="flex-1 rounded-none bg-win py-4 font-semibold text-white shadow-card"
            >
              ✓ Watch This
            </motion.button>
          )}
          {onWatchLater ? (
            <motion.button
              onClick={onClose}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              transition={TAP}
              className="rounded-none border border-border bg-surface px-6 py-4 font-medium text-sub hover:text-txt"
            >
              Close
            </motion.button>
          ) : (
            onAddToWatchLater &&
            !title.watchLater && <SlideToWatchLater onConfirm={confirmWatchLater} />
          )}
        </div>

        {!onWatchLater && (onAlreadyWatched || onDislike) && (
          <div className="mt-3 flex items-center justify-center gap-3 text-sm">
            {onAlreadyWatched && (
              <motion.button
                onClick={onAlreadyWatched}
                whileTap={{ scale: 0.94 }}
                className="text-neutral hover:text-txt"
              >
                👀 Already watched this
              </motion.button>
            )}
            {onAlreadyWatched && onDislike && <span className="text-border">·</span>}
            {onDislike && (
              <motion.button
                onClick={onDislike}
                whileTap={{ scale: 0.94 }}
                className="text-neutral hover:text-sub"
              >
                Not Interested
              </motion.button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
