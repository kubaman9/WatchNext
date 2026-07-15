import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { useTitles } from '../../hooks/useTitles';
import { useEscape } from '../../hooks/useEscape';
import GenreBadge from '../shared/GenreBadge';
import TypeBadge from '../shared/TypeBadge';
import Overlay from '../shared/Overlay';
import PostWatchRanking from '../ranking/PostWatchRanking';

const FALLBACK =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="100%" height="100%" fill="#13131A"/></svg>`
  );

export default function TitleDetail({ title, onClose }) {
  const { dispatch } = useApp();
  const { rankOf, ratingOf } = useTitles();
  const [reranking, setReranking] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  useEscape(reranking ? null : onClose);

  function remove() {
    dispatch({ type: 'REMOVE_TITLE', id: title.id });
    onClose();
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="max-h-[88vh] overflow-y-auto rounded-none border-t border-border bg-bg p-5"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex gap-4">
            <img
              src={title.poster || FALLBACK}
              alt={title.title}
              onError={(e) => (e.currentTarget.src = FALLBACK)}
              className="h-44 w-28 shrink-0 rounded-none object-cover"
            />
            <div className="min-w-0">
              <div className="font-display text-2xl text-txt">{title.title}</div>
              <div className="mt-1 text-sm text-sub">{title.year || '—'}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                <TypeBadge type={title.type} />
                {(title.genres || []).map((g) => (
                  <GenreBadge key={g}>{g}</GenreBadge>
                ))}
              </div>
              <div className="mt-3 flex gap-4 text-sm text-sub">
                <span>#{rankOf(title.id) || '—'}</span>
                <span className="font-semibold text-accent">
                  {ratingOf(title.id)?.toFixed(1) ?? '—'} / 5
                </span>
                <span>Elo {title.eloScore}</span>
                <span>
                  {title.wins || 0}W / {title.losses || 0}L
                </span>
              </div>
            </div>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-sub">{title.overview}</p>

          {title.watchedDate && (
            <p className="mt-2 text-xs text-neutral">
              Watched {new Date(title.watchedDate).toLocaleDateString()}
            </p>
          )}

          <div className="mt-5 flex gap-3">
            <button
              onClick={() => setReranking(true)}
              className="flex-1 rounded-none bg-accent py-3 font-semibold text-white active:scale-95"
            >
              Re-rank
            </button>
            <button
              onClick={() => setConfirmRemove(true)}
              className="rounded-none border border-border bg-surface px-5 py-3 text-sub hover:text-txt"
            >
              Remove
            </button>
          </div>

          {confirmRemove && (
            <div className="mt-3 rounded-none border border-border bg-surface p-3 text-sm">
              <p className="text-txt">Remove {title.title} from your list?</p>
              <div className="mt-2 flex gap-2">
                <button onClick={remove} className="rounded-none bg-red-600 px-3 py-1 text-white">
                  Remove
                </button>
                <button
                  onClick={() => setConfirmRemove(false)}
                  className="rounded-none border border-border px-3 py-1 text-sub"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </motion.div>

        {reranking && (
          <Overlay key="rerank">
            <PostWatchRanking title={title} onDone={() => setReranking(false)} thorough />
          </Overlay>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
