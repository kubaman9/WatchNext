import { useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { useRecommendation } from '../../hooks/useRecommendation';
import { useTitles } from '../../hooks/useTitles';
import PostWatchRanking from '../ranking/PostWatchRanking';
import Overlay from '../shared/Overlay';
import SearchSheet from '../shared/SearchSheet';
import PosterCard from '../shared/PosterCard';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning.';
  if (h < 18) return 'Good afternoon.';
  return 'Good evening.';
}

export default function HomeScreen({ onOpenDrawer, onNavigate, onToast }) {
  const { dispatch } = useApp();
  const { topPoster } = useRecommendation();
  const { watched, rankOf } = useTitles();

  const [ranking, setRanking] = useState(null);
  const [quickAdd, setQuickAdd] = useState(false);
  const [bg] = useState(() => topPoster());
  const autoFired = useRef(false);

  function quickAddSelect(title) {
    dispatch({ type: 'ADD_TITLE', title: { ...title, watched: false } });
    dispatch({ type: 'MARK_WATCHED', id: title.id });
    setQuickAdd(false);
    setRanking(title);
  }

  function finishRanking() {
    const t = ranking;
    setRanking(null);
    const rank = rankOf(t.id);
    onToast(`${t.title} ranked ${rank ? `#${rank}` : ''} in your list.`);
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {bg && (
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-20 blur-2xl"
          style={{ backgroundImage: `url(${bg})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-bg/60 via-bg/80 to-bg" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex items-center justify-between p-5">
          <span className="font-display text-xl text-txt">WatchNext</span>
          <button
            onClick={onOpenDrawer}
            className="rounded-lg p-2 text-2xl text-txt hover:bg-surface"
            aria-label="Menu"
          >
            ≡
          </button>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center px-5 text-center">
          <p className="mb-5 font-display text-2xl text-sub">{greeting()}</p>
          <button
            onClick={() => onNavigate('rank')}
            className="min-h-[64px] w-full max-w-[400px] rounded-2xl bg-accent px-8 py-5 font-display text-2xl text-white shadow-glow transition-shadow hover:shadow-[0_0_60px_-6px_rgba(109,40,217,0.8)] active:scale-[0.98]"
          >
            🎬 What Should I Watch?
          </button>
          <p className="mt-3 text-sm text-sub">Browse and rank your Watch Later list</p>
        </main>

        {watched.length > 0 && (
          <section className="relative z-10 px-5 pb-8">
            <h2 className="mb-3 text-sm uppercase tracking-wider text-sub">Recently Watched</h2>
            <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
              {watched
                .slice()
                .sort((a, b) => (b.watchedDate || '').localeCompare(a.watchedDate || ''))
                .slice(0, 5)
                .map((t) => (
                  <div key={t.id} className="w-28 shrink-0">
                    <PosterCard
                      title={t}
                      rank={rankOf(t.id)}
                      onClick={() => onNavigate('list')}
                    />
                  </div>
                ))}
            </div>
          </section>
        )}

        <div className="relative z-10 pb-8 text-center">
          <button
            onClick={() => setQuickAdd(true)}
            className="text-sm text-sub hover:text-txt"
          >
            + I just watched something
          </button>
        </div>
      </div>

      <AnimatePresence>
        {ranking && (
          <Overlay key="ranking">
            <PostWatchRanking title={ranking} onDone={finishRanking} />
          </Overlay>
        )}
      </AnimatePresence>

      <SearchSheet
        open={quickAdd}
        onClose={() => setQuickAdd(false)}
        onSelect={quickAddSelect}
        title="I just watched…"
        subtitle="Find it, then rank it."
      />
    </div>
  );
}
