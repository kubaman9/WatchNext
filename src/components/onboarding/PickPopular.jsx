import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useSearch } from '../../hooks/useTmdb';
import { usePool } from '../../hooks/useTmdb';
import PosterCard from '../shared/PosterCard';

const PICK_COUNT = 5;

// Onboarding step 1: pick 5 popular movies/shows you've actually seen. Grid-first
// (browse, don't type) so it feels like flipping through a shelf, with a search
// fallback for anything not on the first page of popular titles.
export default function PickPopular({ onContinue, onSkip }) {
  const buildPool = usePool();
  const [pool, setPool] = useState([]);
  const [poolPage, setPoolPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [searching, setSearching] = useState(false);
  const { query, setQuery, results, loading: searchLoading } = useSearch();

  useEffect(() => {
    setLoading(true);
    buildPool(30, poolPage).then((titles) => {
      // Empty deeper page (finite demo data) — wrap back to page 1.
      if (!titles.length && poolPage > 1) {
        setPoolPage(1);
        return;
      }
      setPool(titles);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolPage]);

  function toggle(t) {
    setSelected((cur) => {
      if (cur.some((x) => x.id === t.id)) return cur.filter((x) => x.id !== t.id);
      if (cur.length >= PICK_COUNT) return cur; // full — ignore extra taps
      return [...cur, t];
    });
  }

  const grid = searching && query.trim() ? results : pool;
  const gridLoading = searching ? searchLoading : loading;
  const done = selected.length >= PICK_COUNT;

  return (
    <div className="mx-auto flex h-dvh max-w-2xl flex-col px-5 py-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative shrink-0"
      >
        <h1 className="font-display text-3xl text-txt">Pick 5 you've watched.</h1>
        <p className="mt-1 text-sub">This is the seed for everything else.</p>
        <motion.span
          key={selected.length}
          initial={{ scale: 1.3 }}
          animate={{ scale: 1 }}
          className={`absolute right-0 top-1 rounded-none px-3 py-1 text-sm font-semibold ${
            done ? 'bg-win text-white' : 'bg-accent text-white'
          }`}
        >
          {selected.length} / {PICK_COUNT}
        </motion.span>
      </motion.div>

      <div className="mt-4 flex shrink-0 items-center gap-2">
        <button
          onClick={() => setSearching(false)}
          className={`rounded-none px-3 py-1.5 text-sm font-medium transition-colors ${
            !searching ? 'bg-accent text-white' : 'border border-border text-sub'
          }`}
        >
          Popular
        </button>
        <button
          onClick={() => setSearching(true)}
          className={`rounded-none px-3 py-1.5 text-sm font-medium transition-colors ${
            searching ? 'bg-accent text-white' : 'border border-border text-sub'
          }`}
        >
          Search instead
        </button>
        {!searching && (
          <button
            onClick={() => setPoolPage((p) => p + 1)}
            className="ml-auto rounded-none border border-border px-3 py-1.5 text-sm text-sub hover:text-txt active:scale-95"
          >
            ↻ Different titles
          </button>
        )}
      </div>

      {searching && (
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search movies & shows…"
          className="mt-3 w-full shrink-0 rounded-none border border-border bg-surface px-4 py-3 text-txt outline-none focus:border-accent"
        />
      )}

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
        {gridLoading && <p className="py-10 text-center text-sub">Loading titles…</p>}
        {!gridLoading && searching && !query.trim() && (
          <p className="py-10 text-center text-sub">Start typing to find titles.</p>
        )}
        {!gridLoading && searching && query.trim() && !results.length && (
          <p className="py-10 text-center text-sub">No results.</p>
        )}
        <motion.div
          className="grid grid-cols-3 gap-3"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.03 } } }}
        >
          {grid.map((t) => (
            <motion.div key={t.id} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}>
              <PosterCard title={t} selected={selected.some((x) => x.id === t.id)} onClick={() => toggle(t)} />
            </motion.div>
          ))}
        </motion.div>
      </div>

      <div className="sticky bottom-0 mt-4 flex shrink-0 flex-col items-center gap-3 bg-bg pt-3">
        <motion.button
          disabled={!done}
          onClick={() => onContinue(selected)}
          whileTap={done ? { scale: 0.96 } : {}}
          animate={done ? { scale: [1, 1.03, 1] } : { scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-sm rounded-none bg-accent py-4 font-semibold text-white disabled:opacity-40"
        >
          {done ? 'Continue →' : `Pick ${PICK_COUNT - selected.length} more`}
        </motion.button>
        <button onClick={onSkip} className="text-sm text-neutral hover:text-sub">
          Skip this step →
        </button>
      </div>
    </div>
  );
}
