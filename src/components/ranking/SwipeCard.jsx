import { useEffect, useRef } from 'react';
import { motion, useAnimation, useMotionValue, useTransform } from 'framer-motion';
import GenreBadge from '../shared/GenreBadge';
import TypeBadge from '../shared/TypeBadge';

const FALLBACK =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="100%" height="100%" fill="#13131A"/></svg>`
  );

const THRESHOLD = 110;

// Tinder-style card: drag to swipe (right = onYes, up = onLater, left = onNo)
// with live rotation and directional hint labels. Buttons in the parent call
// onYes/onLater/onNo directly (a prior ref-based imperative trigger here proved
// unreliable, so drag is the only path into the fling animation).
// variant="watchLater" restyles it gold with SEEN / KEEP / REMOVE hints for
// resurfaced Watch Later titles.
export default function SwipeCard({ card, onYes, onLater, onNo, variant = 'discover' }) {
  const isWL = variant === 'watchLater';
  const hints = isWL
    ? { right: 'SEEN', up: 'KEEP', left: 'REMOVE' }
    : { right: 'SEEN', up: 'WATCH LATER', left: 'PASS' };
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-240, 240], [-14, 14]);
  const yesOp = useTransform(x, [40, 130], [0, 1]);
  const noOp = useTransform(x, [-130, -40], [1, 0]);
  const laterOp = useTransform(y, [-130, -40], [1, 0]);
  const controls = useAnimation();
  const gone = useRef(false);

  // Animate each new card in.
  useEffect(() => {
    gone.current = false;
    x.set(0);
    y.set(0);
    controls.set({ opacity: 0, scale: 0.94, y: 24 });
    controls.start({ opacity: 1, scale: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  async function fly(dir) {
    if (gone.current) return;
    // "Yes" opens the ranking overlay over this card — a small pop reads better
    // than flinging it away.
    if (dir === 'yes') {
      gone.current = true;
      await controls.start({ scale: 1.04, transition: { duration: 0.12 } });
      onYes();
      return;
    }
    gone.current = true;
    const target =
      dir === 'no'
        ? { x: -560, rotate: -22, opacity: 0 }
        : { y: -680, opacity: 0 };
    await controls.start({ ...target, transition: { duration: 0.32, ease: 'easeIn' } });
    (dir === 'no' ? onNo : onLater)();
  }

  function onDragEnd(_, info) {
    const { x: ox, y: oy } = info.offset;
    if (oy < -THRESHOLD) fly('later');
    else if (ox > THRESHOLD) fly('yes');
    else if (ox < -THRESHOLD) fly('no');
    else controls.start({ x: 0, y: 0, rotate: 0, transition: { type: 'spring', stiffness: 400, damping: 28 } });
  }

  return (
    <motion.div
      drag
      dragElastic={0.85}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      onDragEnd={onDragEnd}
      style={{ x, y, rotate }}
      animate={controls}
      // Card width is derived from the viewport HEIGHT budget (poster ≈ 40dvh at
      // 2:3), capped by available width — so the poster renders its full frame
      // on desktop (no vertical crop) and never overflows short mobile screens.
      className={`relative flex w-[calc(40dvh*2/3)] max-w-full cursor-grab touch-none select-none flex-col overflow-hidden rounded-2xl border bg-surface shadow-card active:cursor-grabbing ${
        isWL ? 'border-gold/70' : 'border-border'
      }`}
    >
      {isWL && (
        <span className="absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full bg-gold px-3 py-0.5 text-xs font-semibold text-black">
          🔖 Watch Later
        </span>
      )}
      <div className="relative aspect-[2/3] w-full">
        <img
          src={card.poster || FALLBACK}
          alt={card.title}
          draggable="false"
          onError={(e) => (e.currentTarget.src = FALLBACK)}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      </div>

      {/* directional hints */}
      <motion.div
        style={{ opacity: yesOp }}
        className="pointer-events-none absolute left-3 top-3 rotate-[-12deg] rounded-lg border-2 border-win px-3 py-1 font-display text-xl text-win"
      >
        {hints.right}
      </motion.div>
      <motion.div
        style={{ opacity: noOp }}
        className="pointer-events-none absolute right-3 top-3 rotate-[12deg] rounded-lg border-2 border-sub px-3 py-1 font-display text-xl text-sub"
      >
        {hints.left}
      </motion.div>
      <motion.div
        style={{ opacity: laterOp }}
        className={`pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit rounded-lg border-2 px-3 py-1 font-display text-xl ${
          isWL ? 'border-gold text-gold' : 'border-accent text-accent'
        }`}
      >
        {hints.up}
      </motion.div>

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
  );
}
