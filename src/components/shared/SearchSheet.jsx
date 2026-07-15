import { AnimatePresence, motion } from 'framer-motion';
import { useSearch } from '../../hooks/useTmdb';
import { useEscape } from '../../hooks/useEscape';
import PosterCard from './PosterCard';

// Bottom-sheet search. onSelect(title) called per pick.
// `selectedIds` highlights already-picked titles (used in onboarding multi-select).
export default function SearchSheet({
  open,
  onClose,
  onSelect,
  selectedIds = [],
  title = 'Search',
  subtitle,
}) {
  const { query, setQuery, results, loading } = useSearch();
  useEscape(open ? onClose : null);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="max-h-[85vh] overflow-hidden rounded-none border-t border-border bg-bg"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 pt-4">
              <div>
                <h3 className="font-display text-xl text-txt">{title}</h3>
                {subtitle && <p className="text-sm text-sub">{subtitle}</p>}
              </div>
              <button onClick={onClose} className="text-2xl text-sub hover:text-txt">
                ✕
              </button>
            </div>
            <div className="p-4">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search movies & shows…"
                className="w-full rounded-none border border-border bg-surface px-4 py-3 text-txt outline-none focus:border-accent"
              />
            </div>
            <div className="max-h-[55vh] overflow-y-auto px-4 pb-8">
              {loading && <p className="py-6 text-center text-sub">Searching…</p>}
              {!loading && query && !results.length && (
                <p className="py-6 text-center text-sub">No results.</p>
              )}
              <div className="grid grid-cols-3 gap-3">
                {results.map((t) => (
                  <PosterCard
                    key={t.id}
                    title={t}
                    selected={selectedIds.includes(t.id)}
                    onClick={() => onSelect(t)}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
