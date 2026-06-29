import { useState } from 'react';
import { motion } from 'framer-motion';
import { useProviders } from '../../hooks/useTmdb';
import GenreBadge from '../shared/GenreBadge';
import TypeBadge from '../shared/TypeBadge';

const FALLBACK =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="100%" height="100%" fill="#13131A"/></svg>`
  );

export default function RevealCard({ title, skipStreak, onWatch, onSkip, onClose, onRankNudge }) {
  const providers = useProviders(title.id, title.type);
  const [expanded, setExpanded] = useState(false);

  const synopsis = title.overview || 'No synopsis available.';
  const long = synopsis.length > 140;

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 220, damping: 28 }}
      className="fixed inset-0 z-50 overflow-y-auto bg-bg"
    >
      <div className="mx-auto flex min-h-full max-w-lg flex-col px-5 pb-8 pt-4">
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
          className="mt-2 overflow-hidden rounded-xl border border-border shadow-card"
        >
          <img
            src={title.poster || FALLBACK}
            alt={title.title}
            onError={(e) => (e.currentTarget.src = FALLBACK)}
            className="max-h-[55vh] w-full object-cover"
          />
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
          <button
            onClick={onWatch}
            className="flex-1 rounded-xl bg-win py-4 font-semibold text-white transition-transform active:scale-95"
          >
            ✓ Watch This
          </button>
          <button
            onClick={onSkip}
            className="rounded-xl border border-border bg-surface px-6 py-4 font-medium text-sub transition-transform active:scale-95 hover:text-txt"
          >
            Not Now →
          </button>
        </div>
      </div>
    </motion.div>
  );
}
