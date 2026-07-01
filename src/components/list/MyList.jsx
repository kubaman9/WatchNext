import { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { useTitles } from '../../hooks/useTitles';
import TitleDetail from './TitleDetail';
import TypeBadge from '../shared/TypeBadge';
import ModeToggle from '../shared/ModeToggle';
import Overlay from '../shared/Overlay';
import SharpenFlow from '../ranking/SharpenFlow';

const FALLBACK =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="120"><rect width="100%" height="100%" fill="#13131A"/></svg>`
  );

const SORTS = {
  rank: 'Rank',
  recent: 'Recently Watched',
  az: 'A–Z',
};

export default function MyList({ onExit }) {
  const { state, dispatch } = useApp();
  const { watched, rankOf, ratingOf, isProvisional } = useTitles();
  const [sort, setSort] = useState('rank');
  const mode = state.settings.mode || 'both';
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState(null);
  const [sharpen, setSharpen] = useState(false);
  const provisionalCount = watched.filter((t) => isProvisional(t.id)).length;

  const inScope = watched.filter((t) => mode === 'both' || t.type === mode);
  const stats = useMemo(() => {
    if (!inScope.length) return null;
    const ratings = inScope.map((t) => ratingOf(t.id)).filter((r) => r != null);
    const avg = ratings.reduce((s, r) => s + r, 0) / (ratings.length || 1);
    return {
      count: inScope.length,
      avg: avg.toFixed(1),
      movies: inScope.filter((t) => t.type === 'movie').length,
      tv: inScope.filter((t) => t.type === 'tv').length,
    };
  }, [inScope, ratingOf]);

  const rows = useMemo(() => {
    let list = watched
      .filter((t) => mode === 'both' || t.type === mode)
      .filter((t) => t.title.toLowerCase().includes(q.toLowerCase()));
    if (sort === 'recent')
      list = [...list].sort((a, b) => (b.watchedDate || '').localeCompare(a.watchedDate || ''));
    else if (sort === 'az') list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }, [watched, sort, mode, q]);

  return (
    <div className="mx-auto flex h-screen max-w-2xl flex-col px-5 py-5">
      <div className="flex shrink-0 items-center gap-3">
        <button onClick={onExit} className="text-2xl text-sub hover:text-txt" aria-label="Back">
          ←
        </button>
        <h1 className="font-display text-2xl text-txt">My List</h1>
        {stats && (
          <span className="ml-auto text-right text-xs text-sub">
            {stats.count} ranked · avg <span className="text-accent">{stats.avg}</span> · 🎬{stats.movies} 📺{stats.tv}
          </span>
        )}
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search your list…"
        className="mt-4 w-full shrink-0 rounded-lg border border-border bg-surface px-4 py-2.5 text-txt outline-none focus:border-accent"
      />

      <div className="mt-3 flex shrink-0 flex-wrap items-center gap-2">
        {Object.entries(SORTS).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setSort(k)}
            className={`rounded-full px-3 py-1 text-sm ${
              sort === k ? 'bg-accent text-white' : 'border border-border text-sub'
            }`}
          >
            {label}
          </button>
        ))}
        <ModeToggle
          value={mode}
          onChange={(m) => dispatch({ type: 'SET_SETTINGS', payload: { mode: m } })}
          className="ml-auto"
        />
      </div>

      {provisionalCount > 0 && (
        <button
          onClick={() => setSharpen(true)}
          className="mt-3 shrink-0 rounded-lg border border-gold/50 bg-surface py-2 text-sm font-medium text-gold active:scale-95"
        >
          ◇ Sharpen {provisionalCount} uncertain ranking{provisionalCount === 1 ? '' : 's'}
        </button>
      )}

      {!rows.length && <p className="mt-10 text-center text-sub">Nothing ranked yet.</p>}

      <ul className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto">
        {rows.map((t) => (
          <li key={t.id}>
            <button
              onClick={() => setDetail(t)}
              className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface p-2 text-left hover:border-accent"
            >
              <span className="w-8 shrink-0 text-center font-display text-lg text-sub">
                #{rankOf(t.id)}
              </span>
              <img
                src={t.poster || FALLBACK}
                alt={t.title}
                onError={(e) => (e.currentTarget.src = FALLBACK)}
                className="h-16 w-11 shrink-0 rounded object-cover"
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-txt">{t.title}</span>
                  {isProvisional(t.id) && (
                    <span
                      title="Needs more comparisons to be sure"
                      className="shrink-0 rounded-full border border-gold/50 px-1.5 text-[10px] uppercase tracking-wide text-gold"
                    >
                      ◇ provisional
                    </span>
                  )}
                </span>
                <span className="mt-1 flex items-center gap-2 text-sm text-sub">
                  <TypeBadge type={t.type} />
                  <span className="truncate">
                    {t.year || '—'} · {(t.genres || []).slice(0, 2).join(', ')}
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-display text-lg text-accent">
                  {ratingOf(t.id)?.toFixed(1) ?? '—'}
                </span>
                <span className="block text-[10px] uppercase tracking-wide text-neutral">/ 5</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {detail && <TitleDetail title={detail} onClose={() => setDetail(null)} />}

      <AnimatePresence>
        {sharpen && (
          <Overlay key="sharpen" onClose={() => setSharpen(false)}>
            <SharpenFlow onDone={() => setSharpen(false)} />
          </Overlay>
        )}
      </AnimatePresence>
    </div>
  );
}
