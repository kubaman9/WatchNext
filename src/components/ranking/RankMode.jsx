import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { useTitles } from '../../hooks/useTitles';
import { feedPage } from '../../services/tmdbApi';
import ModeToggle from '../shared/ModeToggle';
import Overlay from '../shared/Overlay';
import PostWatchRanking from './PostWatchRanking';
import RerankDuel from './RerankDuel';
import SwipeCard from './SwipeCard';

const BUFFER = 5;
// Weave re-ranks in frequently — every 3-5 classifications, more often as the
// library grows and there's more to keep calibrated.
function rerankInterval(lib) {
  return Math.min(5, Math.max(3, 8 - Math.floor(lib / 6)));
}
// Resurface a Watch Later title in the deck every N classifications.
const WL_INTERVAL = 7;

// Stable key for a pair regardless of order.
function pairKey(a, b) {
  return [a.id, b.id].sort().join('|');
}

// Derive what to personalize Discover around: the genres the user has actually
// leaned toward (weight meaningfully above neutral) and their highest-ranked
// watched titles (used for TMDB's "similar to X" — this is what makes a Nolan-
// heavy library surface more Nolan-adjacent thrillers instead of random anime).
function buildTasteContext(state) {
  const weights = state.taste.genreWeights || {};
  const topGenreIds = Object.entries(weights)
    .filter(([, w]) => w > 1.06)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([id]) => Number(id));
  const anchors = state.titles
    .filter((t) => t.watched && !t.disliked)
    .sort((a, b) => (b.eloScore ?? 1000) - (a.eloScore ?? 1000))
    .slice(0, 5)
    .map((t) => ({ id: t.id, type: t.type }));
  return { topGenreIds, anchors };
}

export default function RankMode() {
  const { state, dispatch } = useApp();
  const { watched } = useTitles();
  const mode = state.settings.mode || 'both';

  const [feed, setFeed] = useState([]);
  const [i, setI] = useState(0);
  const [flow, setFlow] = useState(null); // { kind:'place', title, fromWL? } | { kind:'duel', a, b }
  const [wlCard, setWlCard] = useState(null); // Watch Later title resurfaced in the deck
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const modeRef = useRef(mode);
  const knownIds = useRef(new Set());
  const page = useRef(0);
  const loadingMore = useRef(false);
  const exhausted = useRef(false);
  const sinceRerank = useRef(0);
  const sinceWL = useRef(0);
  const shownWlIds = useRef(new Set()); // cycle through Watch Later without repeats
  const shownPairs = useRef(new Set()); // avoid repeating the same re-rank matchup
  const started = useRef(false);
  const tasteRef = useRef(buildTasteContext(state));

  // Keep the taste snapshot current as the library grows, without changing
  // ensureBuffer's identity (it reads the ref, not a dependency).
  useEffect(() => {
    tasteRef.current = buildTasteContext(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.taste.genreWeights, state.titles]);

  const ensureBuffer = useCallback(async () => {
    if (loadingMore.current || exhausted.current) return;
    loadingMore.current = true;
    setError(false);
    try {
      let added = 0;
      const startPage = page.current;
      // Keep paging past pages that are entirely already-classified — only a
      // literally empty TMDB response (end of catalog) means we're done. Cap the
      // pages scanned per call so we don't spin forever if truly exhausted.
      while (added < 12 && page.current - startPage < 12) {
        page.current += 1;
        const titles = await feedPage(page.current, modeRef.current, tasteRef.current);
        if (!titles.length) {
          exhausted.current = true;
          break;
        }
        const fresh = titles.filter(
          (t) =>
            !knownIds.current.has(t.id) &&
            (modeRef.current === 'both' || t.type === modeRef.current)
        );
        if (!fresh.length) continue; // whole page already seen — try the next
        fresh.forEach((t) => knownIds.current.add(t.id));
        setFeed((f) => [...f, ...fresh]);
        added += fresh.length;
      }
    } catch {
      // TMDB unreachable / rate-limited — allow a retry.
      page.current -= 1;
      setError(true);
    } finally {
      loadingMore.current = false;
    }
  }, []);

  function retry() {
    exhausted.current = false;
    setError(false);
    setLoading(true);
    ensureBuffer().then(() => setLoading(false));
  }

  // Initial load — seed known ids from anything already classified. Start on a
  // random source offset so each session doesn't open with the same titles.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    page.current = Math.floor(Math.random() * 3);
    state.titles
      .filter((t) => t.watched || t.disliked || t.watchLater || t.dismissed)
      .forEach((t) => knownIds.current.add(t.id));
    ensureBuffer().then(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild the feed when the Movie/TV/All mode changes.
  useEffect(() => {
    if (modeRef.current === mode) return;
    modeRef.current = mode;
    page.current = 0;
    exhausted.current = false;
    knownIds.current = new Set();
    state.titles
      .filter((t) => t.watched || t.disliked || t.watchLater || t.dismissed)
      .forEach((t) => knownIds.current.add(t.id));
    setFeed([]);
    setI(0);
    setLoading(true);
    ensureBuffer().then(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Keep the buffer topped up.
  useEffect(() => {
    if (!loading && i >= feed.length - BUFFER) ensureBuffer();
  }, [i, feed.length, loading, ensureBuffer]);

  const card = feed[i];

  // After enough actions, weave in a re-rank of two existing ranked titles —
  // preferring adjacent pairs (best for refining order) that haven't been shown
  // recently, so the user doesn't see the same matchup over and over.
  function pickDuel(lib) {
    const pairs = [];
    for (let i = 0; i < lib.length - 1; i++) pairs.push([lib[i], lib[i + 1]]);
    // a few close-but-not-adjacent pairs for variety
    for (let i = 0; i + 2 < lib.length; i += 2) pairs.push([lib[i], lib[i + 2]]);
    let avail = pairs.filter(([a, b]) => !shownPairs.current.has(pairKey(a, b)));
    if (!avail.length) {
      shownPairs.current.clear(); // cycle through again once exhausted
      avail = pairs;
    }
    if (!avail.length) return null;
    // Prefer matchups involving an under-compared (provisional) title so the
    // least-certain rankings get sharpened first.
    const provisional = avail.filter(
      ([a, b]) => (a.comparisons || 0) < 3 || (b.comparisons || 0) < 3
    );
    const pool = provisional.length ? provisional : avail;
    const pair = pool[Math.floor(Math.random() * pool.length)];
    shownPairs.current.add(pairKey(pair[0], pair[1]));
    return pair;
  }

  function maybeRerank() {
    const lib = watched;
    if (lib.length < 4) return false;
    sinceRerank.current += 1;
    if (sinceRerank.current >= rerankInterval(lib.length)) {
      sinceRerank.current = 0;
      const pair = pickDuel(lib);
      if (pair) {
        setFlow({ kind: 'duel', a: pair[0], b: pair[1] });
        return true;
      }
    }
    return false;
  }

  // Every WL_INTERVAL classifications, resurface a Watch Later title as a
  // special deck card ("seen it yet?") — cycling so the same one doesn't repeat.
  function maybeWatchLater() {
    const wlTitles = (state.watchLater || [])
      .map((id) => state.titles.find((t) => t.id === id))
      .filter((t) => t && !t.watched && !t.disliked);
    if (!wlTitles.length) return false;
    sinceWL.current += 1;
    if (sinceWL.current < WL_INTERVAL) return false;
    sinceWL.current = 0;
    let pick = wlTitles.find((t) => !shownWlIds.current.has(t.id));
    if (!pick) {
      shownWlIds.current.clear();
      pick = wlTitles[0];
    }
    shownWlIds.current.add(pick.id);
    setWlCard(pick);
    return true;
  }

  // Runs after every classification: Watch Later resurfacing wins over re-rank
  // duels when both are due (both counters keep ticking regardless).
  function afterClassify() {
    if (maybeWatchLater()) return;
    maybeRerank();
  }

  // ── Watch Later card actions ────────────────────────────────────────────────
  function wlWatched() {
    if (!wlCard) return;
    dispatch({ type: 'MARK_WATCHED', id: wlCard.id });
    setFlow({ kind: 'place', title: wlCard, fromWL: true });
  }
  function wlNotYet() {
    setWlCard(null);
  }
  function wlRemove() {
    if (!wlCard) return;
    dispatch({ type: 'REMOVE_WATCH_LATER', id: wlCard.id });
    setWlCard(null);
  }

  function ensureInState(t) {
    if (!state.titles.find((x) => x.id === t.id)) {
      dispatch({ type: 'ADD_TITLE', title: { ...t, watched: false } });
    }
  }

  // "Yes" — seen it, place it in the ranked list.
  function yes() {
    if (!card || flow || wlCard) return;
    ensureInState(card);
    dispatch({ type: 'MARK_WATCHED', id: card.id });
    setFlow({ kind: 'place', title: card });
  }

  // "Not Interested" — never recommend.
  function notInterested() {
    if (!card || flow || wlCard) return;
    ensureInState(card);
    dispatch({ type: 'DISLIKE_TITLE', id: card.id });
    setI((n) => n + 1);
    afterClassify();
  }

  // "No" — haven't seen it, add to Watch Later.
  function no() {
    if (!card || flow || wlCard) return;
    ensureInState(card);
    dispatch({ type: 'ADD_WATCH_LATER', id: card.id });
    setI((n) => n + 1);
    afterClassify();
  }

  function finishFlow() {
    const f = flow;
    setFlow(null);
    if (f?.kind === 'place') {
      if (f.fromWL) {
        setWlCard(null); // Watch Later card handled — deck position unchanged
        return;
      }
      setI((n) => n + 1);
      afterClassify();
    }
  }

  // Buttons and keys call the state handlers directly (not the card's ref-based
  // fly animation — that path proved unreliable, so drag is the only trigger for
  // the fling; buttons still get their own tap/hover feedback).
  useEffect(() => {
    function onKey(e) {
      if (flow) return;
      if (wlCard) {
        if (e.key === 'ArrowRight') wlWatched();
        else if (e.key === 'ArrowLeft') wlRemove();
        else if (e.key === 'ArrowUp') wlNotYet();
        return;
      }
      if (e.key === 'ArrowRight') yes();
      else if (e.key === 'ArrowLeft') notInterested();
      else if (e.key === 'ArrowUp') no();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, flow, wlCard]);

  return (
    <div className="mx-auto flex h-full max-w-md flex-col px-5 py-4">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex shrink-0 items-center justify-center"
      >
        <span className="font-display text-lg text-txt">Discover</span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mx-auto mt-3 shrink-0"
      >
        <ModeToggle value={mode} onChange={(m) => dispatch({ type: 'SET_SETTINGS', payload: { mode: m } })} />
      </motion.div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center py-3">
        {loading && (
          <div className="aspect-[2/3] w-[calc(40dvh*2/3)] max-w-full animate-pulse rounded-2xl bg-surface" />
        )}
        {!loading && error && !card && (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center text-sub">
            <p className="font-display text-xl text-txt">Couldn’t load titles.</p>
            <p className="mt-1 text-sm">Check your connection or TMDB key.</p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={retry}
              className="mt-4 rounded-xl bg-accent px-6 py-2.5 font-semibold text-white"
            >
              Retry
            </motion.button>
          </motion.div>
        )}
        {!loading && !error && !card && (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center text-sub">
            <p className="font-display text-2xl text-txt">That’s everything for now.</p>
            <p className="mt-1">Check back soon for more titles.</p>
          </motion.div>
        )}
        {wlCard ? (
          <SwipeCard
            key={`wl-${wlCard.id}`}
            card={wlCard}
            variant="watchLater"
            onYes={wlWatched}
            onLater={wlNotYet}
            onNo={wlRemove}
          />
        ) : (
          card && <SwipeCard key={card.id} card={card} onYes={yes} onLater={no} onNo={notInterested} />
        )}
      </div>

      {wlCard ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="shrink-0 space-y-2 pb-1"
        >
          <p className="text-center text-sm text-gold">🔖 On your Watch Later — seen it yet?</p>
          <motion.button
            whileTap={{ scale: 0.96 }}
            whileHover={{ scale: 1.01 }}
            onClick={wlWatched}
            className="w-full rounded-xl bg-win py-3 font-semibold text-white"
          >
            Watched it — rank it
          </motion.button>
          <div className="flex gap-2">
            <motion.button
              whileTap={{ scale: 0.96 }}
              whileHover={{ scale: 1.01 }}
              onClick={wlNotYet}
              className="flex-1 rounded-xl border border-gold/60 bg-surface py-3 font-semibold text-gold"
            >
              Not yet
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              whileHover={{ scale: 1.01 }}
              onClick={wlRemove}
              className="flex-1 rounded-xl border border-border bg-surface py-3 font-medium text-sub"
            >
              Remove
            </motion.button>
          </div>
        </motion.div>
      ) : (
        card && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="shrink-0 space-y-2 pb-1"
          >
            <p className="text-center text-sm text-sub">Have you seen this?</p>
            <motion.button
              whileTap={{ scale: 0.96 }}
              whileHover={{ scale: 1.01 }}
              onClick={yes}
              className="w-full rounded-xl bg-win py-3 font-semibold text-white"
            >
              Yes — rank it
            </motion.button>
            <div className="flex gap-2">
              <motion.button
                whileTap={{ scale: 0.96 }}
                whileHover={{ scale: 1.01 }}
                onClick={no}
                className="flex-1 rounded-xl border border-accent bg-surface py-3 font-semibold text-accent"
              >
                Add to Watch Later
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.96 }}
                whileHover={{ scale: 1.01 }}
                onClick={notInterested}
                className="flex-1 rounded-xl border border-border bg-surface py-3 font-medium text-sub"
              >
                Not Interested
              </motion.button>
            </div>
          </motion.div>
        )
      )}

      {/* No AnimatePresence here — its exit tracking has repeatedly hung on
          battle subtrees, leaving a dead overlay. Plain conditional render:
          fades in via Overlay's own initial/animate, unmounts instantly. */}
      {flow && (
        <Overlay key="rank-flow">
          {flow.kind === 'place' ? (
            <PostWatchRanking title={flow.title} onDone={finishFlow} />
          ) : (
            <RerankDuel a={flow.a} b={flow.b} onDone={finishFlow} />
          )}
        </Overlay>
      )}
    </div>
  );
}
