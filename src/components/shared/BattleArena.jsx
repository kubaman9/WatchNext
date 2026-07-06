import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import GenreBadge from './GenreBadge';
import TypeBadge from './TypeBadge';

const FALLBACK =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450"><rect width="100%" height="100%" fill="#13131A"/></svg>`
  );

const SPARKLES = ['✦', '★', '✧'];

function WinBurst() {
  // Compute each sparkle's target ONCE per mount (useMemo, not inline in render).
  // Recomputing random targets on every re-render would hand Framer Motion a new
  // `animate` object each time, restarting the tween indefinitely — which can
  // stall the parent AnimatePresence exit transition and freeze the whole card.
  const sparkles = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        const dist = 60 + Math.random() * 30;
        return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist - 20 };
      }),
    []
  );
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-visible">
      {sparkles.map((s, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 1, scale: 0.4, x: 0, y: 0 }}
          animate={{ opacity: 0, scale: 1.1, x: s.x, y: s.y }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="absolute left-1/2 top-1/2 text-lg text-gold"
        >
          {SPARKLES[i % SPARKLES.length]}
        </motion.span>
      ))}
    </div>
  );
}

function Card({ title, side, highlighted, winner, loser, onPick }) {
  return (
    <motion.button
      type="button"
      onClick={onPick}
      whileHover={!winner && !loser ? { y: -3 } : {}}
      whileTap={!winner && !loser ? { scale: 0.97 } : {}}
      animate={
        winner ? { scale: 1.05 } : loser ? { opacity: 0.3, scale: 0.95 } : { scale: 1 }
      }
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className={`relative flex w-full flex-1 flex-col overflow-hidden rounded-xl border bg-surface text-left shadow-card ${
        highlighted ? 'border-accent ring-2 ring-accent shadow-glow' : 'border-border'
      }`}
      aria-label={`Pick ${title.title} (${side})`}
    >
      {winner && <WinBurst />}
      <div className="aspect-[2/3] w-full">
        <img
          src={title.poster || FALLBACK}
          alt={title.title}
          onError={(e) => (e.currentTarget.src = FALLBACK)}
          className="h-full max-h-[44vh] w-full object-cover"
        />
      </div>
      <div className="p-2.5">
        <div className="font-display text-base leading-tight text-txt">{title.title}</div>
        <div className="mt-0.5 text-xs text-sub">{title.year || '—'}</div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          <TypeBadge type={title.type} />
          {(title.genres || []).slice(0, 1).map((g) => (
            <GenreBadge key={g}>{g}</GenreBadge>
          ))}
        </div>
      </div>
    </motion.button>
  );
}

export default function BattleArena({
  left,
  right,
  prompt,
  neitherLabel = 'Haven’t seen either',
  onPick,
  onNeither,
  onMega,
  megaLabel = '🔥 Mega prefer',
  progress,
}) {
  const [picked, setPicked] = useState(null); // 'left' | 'right'
  const [hover, setHover] = useState(null);

  useEffect(() => {
    setPicked(null);
    setHover(null);
  }, [left?.id, right?.id]);

  function choose(side) {
    if (picked) return;
    setPicked(side);
    const winner = side === 'left' ? left : right;
    const loser = side === 'left' ? right : left;
    setTimeout(() => onPick(winner, loser, side), 280);
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowLeft') setHover('left');
      else if (e.key === 'ArrowRight') setHover('right');
      else if (e.key === 'Enter') {
        if (hover) choose(hover);
      } else if (e.key === ' ') {
        e.preventDefault();
        onNeither?.();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hover, picked, left?.id, right?.id]);

  if (!left || !right) return null;

  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-4">
      {progress != null && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-border">
          <motion.div
            className="h-full bg-accent"
            initial={false}
            animate={{ width: `${progress * 100}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 30 }}
          />
        </div>
      )}
      {prompt && (
        <h2 className="text-center font-display text-xl text-txt sm:text-3xl">{prompt}</h2>
      )}
      {/* Plain keyed remount (no AnimatePresence) for the pair swap — the old
          pair disappears instantly and the new one fades/slides in via its own
          `initial`/`animate`. We deliberately don't wait for an exit animation
          here: an AnimatePresence `mode="wait"` exit that depends on nested
          animating children settling can stall indefinitely and freeze the
          whole battle on a round transition — not worth the trade for a
          same-instant swap that's already fast and readable. */}
      <motion.div
        key={`${left.id}-${right.id}`}
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25 }}
        className="flex w-full flex-row items-stretch gap-3"
      >
        <Card
          title={left}
          side="left"
          highlighted={hover === 'left'}
          winner={picked === 'left'}
          loser={picked === 'right'}
          onPick={() => choose('left')}
        />
        <Card
          title={right}
          side="right"
          highlighted={hover === 'right'}
          winner={picked === 'right'}
          loser={picked === 'left'}
          onPick={() => choose('right')}
        />
      </motion.div>
      {onMega && (
        <motion.button
          type="button"
          onClick={onMega}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.95 }}
          animate={{ opacity: [0.85, 1, 0.85] }}
          transition={{ opacity: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } }}
          className="w-full max-w-xs rounded-full bg-gradient-to-r from-accent-deep via-accent to-gold py-2.5 text-sm font-semibold text-white shadow-glow"
        >
          {megaLabel}
        </motion.button>
      )}
      {onNeither && (
        <motion.button
          type="button"
          onClick={onNeither}
          whileTap={{ scale: 0.95 }}
          className="text-sm text-neutral transition-colors hover:text-sub"
        >
          {neitherLabel}
        </motion.button>
      )}
    </div>
  );
}
