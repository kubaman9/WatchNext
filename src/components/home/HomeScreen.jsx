import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { useRecommendation } from '../../hooks/useRecommendation';
import { useTitles } from '../../hooks/useTitles';
import { upcoming } from '../../services/tmdbApi';
import PostWatchRanking from '../ranking/PostWatchRanking';
import RevealCard from './RevealCard';
import Overlay from '../shared/Overlay';
import SearchSheet from '../shared/SearchSheet';
import PosterCard from '../shared/PosterCard';
import ModeToggle from '../shared/ModeToggle';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning.';
  if (h < 18) return 'Good afternoon.';
  return 'Good evening.';
}

// Horizontal poster row used for Watch Later / Coming Soon / Recently Watched.
function PosterRow({ heading, items, onTap, badge }) {
  if (!items.length) return null;
  return (
    <section className="shrink-0 px-5 pb-4">
      <h2 className="mb-3 text-sm uppercase tracking-wider text-sub">{heading}</h2>
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
        {items.map((t) => (
          <div key={t.id} className="relative w-24 shrink-0">
            <PosterCard title={t} rank={badge ? badge(t) : undefined} onClick={() => onTap(t)} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function HomeScreen({ onNavigate, onToast }) {
  const { state, dispatch } = useApp();
  const { suggest, removeSuggestion, topPoster, suggestionRemaining } = useRecommendation();
  const { watched, rankOf } = useTitles();
  const mode = state.settings.mode || 'both';

  const [picker, setPicker] = useState(null); // the 5 suggested titles
  const [reveal, setReveal] = useState(null);
  const [comingSoonReveal, setComingSoonReveal] = useState(null);
  const [ranking, setRanking] = useState(null);
  const [quickAdd, setQuickAdd] = useState(false);
  const [comingSoon, setComingSoon] = useState([]);
  const [bg] = useState(() => topPoster());
  const [, tick] = useState(0);
  const fetchedUpcoming = useRef(false);

  // Live countdown re-render.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // "Coming soon for you" — fetched once, biased toward the user's top genres.
  useEffect(() => {
    if (fetchedUpcoming.current) return;
    fetchedUpcoming.current = true;
    const weights = state.taste.genreWeights || {};
    const topGenres = Object.entries(weights)
      .filter(([, w]) => w > 1.06)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id]) => Number(id));
    upcoming(topGenres).then(setComingSoon).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remaining = suggestionRemaining();
  const countdown =
    remaining > 0
      ? `Fresh picks in ${Math.floor(remaining / 60000)}:${String(
          Math.floor((remaining % 60000) / 1000)
        ).padStart(2, '0')}`
      : null;

  function inMode(t) {
    return mode === 'both' || t.type === mode;
  }

  // One batch of five per 10 minutes — re-taps reopen the same five.
  function fire() {
    const { titles, fresh } = suggest();
    if (!titles.length) {
      onToast('Add some titles to your list first.');
      return;
    }
    setPicker(titles);
    if (!fresh) onToast('Same five for now — a fresh batch unlocks soon.');
  }

  function handleWatch() {
    const t = reveal;
    if (!state.titles.find((x) => x.id === t.id)) {
      dispatch({ type: 'ADD_TITLE', title: { ...t, watched: false } });
    }
    dispatch({ type: 'MARK_WATCHED', id: t.id });
    setReveal(null);
    setPicker(null);
    setRanking(t);
  }

  function handleDislike() {
    const t = reveal;
    if (!state.titles.find((x) => x.id === t.id)) {
      dispatch({ type: 'ADD_TITLE', title: { ...t, watched: false } });
    }
    dispatch({ type: 'DISLIKE_TITLE', id: t.id });
    removeSuggestion(t.id);
    setReveal(null);
    setPicker((p) => {
      const next = (p || []).filter((x) => x.id !== t.id);
      return next.length ? next : null;
    });
    onToast(`Won’t suggest ${t.title} again.`);
  }

  function addComingSoonToWL() {
    const t = comingSoonReveal;
    if (!state.titles.find((x) => x.id === t.id)) {
      dispatch({ type: 'ADD_TITLE', title: { ...t, watched: false } });
    }
    dispatch({ type: 'ADD_WATCH_LATER', id: t.id });
    setComingSoonReveal(null);
    onToast(`${t.title} added to Watch Later.`);
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

  const recent = watched
    .filter(inMode)
    .slice()
    .sort((a, b) => (b.watchedDate || '').localeCompare(a.watchedDate || ''))
    .slice(0, 8);

  const watchLaterRow = (state.watchLater || [])
    .map((id) => state.titles.find((t) => t.id === id))
    .filter((t) => t && !t.watched && !t.disliked && inMode(t))
    .slice(0, 8);

  const comingSoonRow = comingSoon.filter(inMode).slice(0, 8);

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {bg && (
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-20 blur-2xl"
          style={{ backgroundImage: `url(${bg})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-bg/60 via-bg/80 to-bg" />

      <div className="relative z-10 flex h-full flex-col">
        <header className="flex shrink-0 items-center justify-between px-5 py-4">
          <span className="font-display text-xl text-txt">WatchNext</span>
          <button
            onClick={() => onNavigate('settings')}
            className="rounded-lg p-2 text-xl text-sub hover:bg-surface hover:text-txt"
            aria-label="Settings"
          >
            ⚙️
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <motion.main
            className="flex min-h-[52dvh] flex-col items-center justify-center px-5 text-center"
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } }}
          >
            <motion.p
              variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
              className="mb-5 font-display text-2xl text-sub"
            >
              {greeting()}
            </motion.p>
            <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="mb-6">
              <ModeToggle
                value={mode}
                onChange={(m) => dispatch({ type: 'SET_SETTINGS', payload: { mode: m } })}
              />
            </motion.div>
            <motion.button
              variants={{ hidden: { opacity: 0, y: 12, scale: 0.96 }, show: { opacity: 1, y: 0, scale: 1 } }}
              onClick={fire}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              className="animate-glow min-h-[64px] w-full max-w-[400px] rounded-2xl bg-accent px-8 py-5 font-display text-2xl text-white"
            >
              🎬 What Should I Watch?
            </motion.button>
            <motion.p
              variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
              className="mt-3 h-4 text-xs text-neutral"
            >
              {countdown || 'Five fresh picks are ready'}
            </motion.p>
          </motion.main>

          <PosterRow
            heading="🔖 From your Watch Later"
            items={watchLaterRow}
            onTap={(t) => setReveal(t)}
          />
          <PosterRow
            heading="✨ Coming soon for you"
            items={comingSoonRow}
            onTap={(t) => setComingSoonReveal(t)}
          />
          <PosterRow
            heading="Recently watched"
            items={recent}
            onTap={() => onNavigate('list')}
            badge={(t) => rankOf(t.id)}
          />

          <div className="shrink-0 pb-6 text-center">
            <button onClick={() => setQuickAdd(true)} className="text-sm text-sub hover:text-txt">
              + I just watched something
            </button>
          </div>
        </div>
      </div>

      {/* Five-pick chooser — plain conditional render (AnimatePresence exit
          tracking hangs on complex subtrees; see RankMode). */}
      {picker && !reveal && (
        <Overlay key="picker" onClose={() => setPicker(null)}>
            <motion.div
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
              className="w-full max-w-md"
            >
              <motion.h2
                variants={{ hidden: { opacity: 0, y: -8 }, show: { opacity: 1, y: 0 } }}
                className="mb-4 text-center font-display text-2xl text-txt"
              >
                Tonight’s five
              </motion.h2>
              <div className="grid grid-cols-3 justify-items-center gap-3">
                {picker.map((t) => (
                  <motion.div
                    key={t.id}
                    variants={{ hidden: { opacity: 0, y: 14, scale: 0.92 }, show: { opacity: 1, y: 0, scale: 1 } }}
                    className="w-full"
                  >
                    <PosterCard title={t} onClick={() => setReveal(t)} />
                    <p className="mt-1 truncate text-center text-xs text-sub">{t.title}</p>
                  </motion.div>
                ))}
              </div>
              <motion.p
                variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
                className="mt-4 text-center text-xs text-neutral"
              >
                Tap one to see why it fits.
              </motion.p>
            </motion.div>
        </Overlay>
      )}

      <AnimatePresence>
        {reveal && (
          <RevealCard
            key="reveal"
            title={reveal}
            onWatch={handleWatch}
            onSkip={() => setReveal(null)}
            onDislike={handleDislike}
            onClose={() => setReveal(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {comingSoonReveal && (
          <RevealCard
            key="coming-soon"
            title={comingSoonReveal}
            onWatchLater={addComingSoonToWL}
            onSkip={() => setComingSoonReveal(null)}
            onClose={() => setComingSoonReveal(null)}
          />
        )}
      </AnimatePresence>

      {/* Battle overlays render without AnimatePresence — exit tracking hangs
          on battle subtrees (see RankMode). */}
      {ranking && (
        <Overlay key="ranking">
          <PostWatchRanking title={ranking} onDone={finishRanking} />
        </Overlay>
      )}

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
