import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { useRecommendation } from '../../hooks/useRecommendation';
import { useTitles } from '../../hooks/useTitles';
import RevealCard from './RevealCard';
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
  const { state, dispatch } = useApp();
  const { pick, topPoster } = useRecommendation();
  const { watched, rankOf } = useTitles();

  const [reveal, setReveal] = useState(null);
  const [skipStreak, setSkipStreak] = useState(0);
  const [ranking, setRanking] = useState(null);
  const [quickAdd, setQuickAdd] = useState(false);
  const [bg] = useState(() => topPoster());
  const autoFired = useRef(false);

  // Fire the button automatically on first load after onboarding.
  useEffect(() => {
    if (autoFired.current) return;
    autoFired.current = true;
    if (state.taste.onboardingComplete && sessionStorage.getItem('wn_fired') !== '1') {
      sessionStorage.setItem('wn_fired', '1');
      const t = pick();
      if (t) setReveal(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fire() {
    const t = pick();
    setSkipStreak(0);
    if (t) setReveal(t);
    else onToast('Nothing left to recommend — add some titles!');
  }

  function handleSkip() {
    dispatch({ type: 'SKIP_RECOMMENDATION', id: reveal.id });
    setSkipStreak((s) => s + 1);
    const t = pick();
    setReveal(t || null);
    if (!t) onToast('Out of fresh picks for now.');
  }

  function handleWatch() {
    const t = reveal;
    dispatch({ type: 'MARK_WATCHED', id: t.id });
    setReveal(null);
    setRanking(t);
  }

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
          <p className="mb-8 font-display text-2xl text-sub">{greeting()}</p>
          <motion.button
            onClick={fire}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="min-h-[64px] w-full max-w-[400px] rounded-2xl bg-accent px-8 py-5 font-display text-2xl text-white shadow-glow transition-shadow hover:shadow-[0_0_60px_-6px_rgba(109,40,217,0.8)]"
          >
            🎬 What Should I Watch?
          </motion.button>
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
        {reveal && (
          <RevealCard
            key="reveal"
            title={reveal}
            skipStreak={skipStreak}
            onWatch={handleWatch}
            onSkip={handleSkip}
            onClose={() => setReveal(null)}
            onRankNudge={() => {
              setReveal(null);
              onNavigate('rank');
            }}
          />
        )}
      </AnimatePresence>

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
