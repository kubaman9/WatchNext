import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useTitles } from '../../hooks/useTitles';
import RerankDuel from './RerankDuel';

// Runs a short series of duels pitting each provisional (under-compared) title
// against a current neighbor, firming up the least-certain rankings. Neighbors
// are read live so each duel reflects the latest order.
export default function SharpenFlow({ onDone }) {
  const { watched, isProvisional } = useTitles();
  const queue = useRef(null);
  if (queue.current === null) {
    queue.current = watched.filter((t) => isProvisional(t.id)).map((t) => t.id);
  }
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);

  const total = queue.current.length;
  const currentId = queue.current[idx];
  const cur = watched.find((t) => t.id === currentId);
  const pos = cur ? watched.findIndex((t) => t.id === cur.id) : -1;
  const neighbor = pos >= 0 ? watched[pos - 1] || watched[pos + 1] || null : null;

  function next() {
    if (idx + 1 >= total) finish();
    else setIdx((n) => n + 1);
  }
  function finish() {
    setDone(true);
    setTimeout(onDone, 1400);
  }

  if (done || !total) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <p className="font-display text-2xl text-txt">Rankings sharpened.</p>
        <p className="mt-1 text-sub">{total} title{total === 1 ? '' : 's'} firmed up.</p>
      </motion.div>
    );
  }

  // Provisional title has no neighbor to compare (too few titles) — skip it.
  if (!cur || !neighbor) {
    next();
    return <p className="text-sub">Sharpening…</p>;
  }

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <p className="text-xs uppercase tracking-wider text-sub">
        Sharpening {idx + 1} of {total}
      </p>
      <RerankDuel a={cur} b={neighbor} onDone={next} />
    </div>
  );
}
