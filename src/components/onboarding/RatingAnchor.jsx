import { useState } from 'react';
import { motion } from 'framer-motion';

const FALLBACK =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="100%" height="100%" fill="#13131A"/></svg>`
  );

export default function RatingAnchor({ title, onDone }) {
  const [rating, setRating] = useState(4);

  return (
    <div className="mx-auto flex h-screen max-w-md flex-col items-center justify-center px-5 text-center">
      <h1 className="font-display text-2xl text-txt">How would you rate it?</h1>
      <p className="mt-1 text-sub">This anchors your whole rating scale.</p>

      <motion.img
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        src={title.poster || FALLBACK}
        alt={title.title}
        onError={(e) => (e.currentTarget.src = FALLBACK)}
        className="mt-6 max-h-[38vh] rounded-xl border border-border object-cover shadow-card"
      />
      <div className="mt-3 font-display text-xl text-txt">{title.title}</div>

      <div className="mt-6 font-display text-5xl text-accent">{rating}</div>
      <span className="text-sm text-sub">out of 5</span>

      <input
        type="range"
        min="1"
        max="5"
        step="1"
        value={rating}
        onChange={(e) => setRating(Number(e.target.value))}
        className="mt-4 w-full max-w-xs accent-accent"
      />

      <button
        onClick={() => onDone(rating)}
        className="mt-8 w-full max-w-xs rounded-xl bg-accent py-4 font-semibold text-white active:scale-95"
      >
        Continue →
      </button>
    </div>
  );
}
