import { useState } from 'react';
import { useSearch } from '../../hooks/useTmdb';
import PosterCard from '../shared/PosterCard';

export default function RecentlyWatched({ onContinue, onSkip }) {
  const { query, setQuery, results, loading } = useSearch();
  const [selected, setSelected] = useState([]);

  function toggle(t) {
    setSelected((cur) =>
      cur.some((x) => x.id === t.id) ? cur.filter((x) => x.id !== t.id) : [...cur, t]
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-5 py-8">
      <div className="relative">
        <h1 className="font-display text-3xl text-txt">What have you watched recently?</h1>
        <p className="mt-1 text-sub">This gives us a starting point.</p>
        {selected.length > 0 && (
          <span className="absolute right-0 top-1 rounded-full bg-accent px-3 py-1 text-sm text-white">
            {selected.length} selected
          </span>
        )}
      </div>

      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search movies & shows…"
        className="mt-5 w-full rounded-lg border border-border bg-surface px-4 py-3 text-txt outline-none focus:border-accent"
      />

      <div className="mt-5 flex-1 overflow-y-auto">
        {loading && <p className="py-6 text-center text-sub">Searching…</p>}
        {!loading && !query && (
          <p className="py-10 text-center text-sub">Start typing to find titles.</p>
        )}
        <div className="grid grid-cols-3 gap-3">
          {results.map((t) => (
            <PosterCard
              key={t.id}
              title={t}
              selected={selected.some((x) => x.id === t.id)}
              onClick={() => toggle(t)}
            />
          ))}
        </div>
      </div>

      <div className="sticky bottom-0 mt-4 flex flex-col items-center gap-3 bg-bg pt-3">
        <button
          disabled={!selected.length}
          onClick={() => onContinue(selected)}
          className="w-full max-w-sm rounded-xl bg-accent py-4 font-semibold text-white disabled:opacity-40"
        >
          Continue →
        </button>
        <button onClick={onSkip} className="text-sm text-neutral hover:text-sub">
          Skip this step →
        </button>
      </div>
    </div>
  );
}
