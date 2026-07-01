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

// Tinder-style card: drag to swipe (right = Yes, up = Watch Later, left = Not
// Interested) with live rotation and directional hint labels. Buttons in the
// parent call the same onYes/onLater/onNo directly.
export default function SwipeCard({ card, onYes, onLater, onNo }) {
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
      className="relative flex w-full cursor-grab touch-none select-none flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card active:cursor-grabbing"
    >
      <img
        src={card.poster || FALLBACK}
        alt={card.title}
        draggable="false"
        onError={(e) => (e.currentTarget.src = FALLBACK)}
        className="pointer-events-none max-h-[42vh] w-full object-cover"
      />

      {/* directional hints */}
      <motion.div
        style={{ opacity: yesOp }}
        className="pointer-events-none absolute left-3 top-3 rotate-[-12deg] rounded-lg border-2 border-win px-3 py-1 font-display text-xl text-win"
      >
        SEEN
      </motion.div>
      <motion.div
        style={{ opacity: noOp }}
        className="pointer-events-none absolute right-3 top-3 rotate-[12deg] rounded-lg border-2 border-sub px-3 py-1 font-display text-xl text-sub"
      >
        PASS
      </motion.div>
      <motion.div
        style={{ opacity: laterOp }}
        className="pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit rounded-lg border-2 border-accent px-3 py-1 font-display text-xl text-accent"
      >
        WATCH LATER
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
