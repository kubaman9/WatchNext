import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { usePool } from '../../hooks/useTmdb';
import { genreMultiplier } from '../../utils/scoring';
import { TASTE_VERSION } from '../../utils/rating';
import BattleArena from '../shared/BattleArena';

const DEFAULT_ROUNDS = 20;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function allPairs(n) {
  const pairs = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j]);
  return shuffle(pairs);
}

function twoDistinct(arr, biasFn) {
  if (arr.length < 2) return null;
  const score = (t) => (biasFn ? biasFn(t) : 1) * (0.5 + Math.random());
  const sorted = [...arr].sort((a, b) => score(b) - score(a));
  const a = sorted[0];
  const b = sorted.find((t) => t.id !== a.id);
  return b ? [a, b] : null;
}

// Runs the full taste-calibration battle: picks vs picks, then picks vs pool,
// then pool vs pool weighted by emerging genre taste. Replaces the old manual
// baseline rating entirely — the baseline is now derived from real results.
// `rounds` is shorter for a rebase of an existing account (they already have
// taste signal) than for fresh onboarding (starting from nothing).
export default function TasteBattles({ recentlyWatched = [], onComplete, rounds = DEFAULT_ROUNDS }) {
  const { state, dispatch } = useApp();
  const buildPool = usePool();
  const [pool, setPool] = useState([]);
  const [round, setRound] = useState(0);
  const [ready, setReady] = useState(false);
  const seeded = useRef(false);
  const pickPairQueue = useRef(null);
  const ROUNDS = rounds;
  // First chunk of rounds is a mini-tournament among the picks themselves (this
  // is what replaces the old manual 1–5 baseline rating — real head-to-head
  // results instead of a single guessed number). The rest calibrates genre taste
  // against a wider pool, occasionally re-grounding against a pick.
  const PICKS_ROUNDS = Math.min(8, Math.max(3, Math.ceil(ROUNDS / 2)));

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    buildPool(50).then((titles) => {
      const fresh = titles.filter((t) => !state.titles.some((x) => x.id === t.id));
      if (fresh.length) dispatch({ type: 'ADD_TITLES', titles: fresh });
      setPool(titles);
      setReady(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (pickPairQueue.current === null && recentlyWatched.length >= 2) {
    pickPairQueue.current = allPairs(recentlyWatched.length);
  }

  const inPicksPhase = round < PICKS_ROUNDS && recentlyWatched.length >= 2;

  const biasFn = useMemo(() => {
    if (round < PICKS_ROUNDS + 3) return null;
    return (t) => genreMultiplier(t, state.taste.genreWeights || {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  const pair = useMemo(() => {
    if (!ready || !pool.length) return null;

    if (inPicksPhase) {
      const queue = pickPairQueue.current || [];
      if (queue.length) {
        const [ai, bi] = queue[round % queue.length];
        return [recentlyWatched[ai], recentlyWatched[bi]];
      }
      // Ran out of unique pick-vs-pick pairs — ground a pick against fresh pool.
      const a = recentlyWatched[round % recentlyWatched.length];
      const b = twoDistinct(pool.filter((t) => t.id !== a.id));
      if (a && b) return [a, b[0]];
    }

    // Post-picks phase: occasionally re-ground against a pick, otherwise pool battles.
    if (round % 4 === 0 && recentlyWatched.length) {
      const a = recentlyWatched[round % recentlyWatched.length];
      const b = twoDistinct(pool.filter((t) => t.id !== a.id), biasFn);
      if (a && b) return [a, b[0]];
    }
    return twoDistinct(pool, biasFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, round]);

  // Baseline is now derived, not typed in: average final Elo of the 5 picks.
  function finishAndSetBaseline() {
    const ids = new Set(recentlyWatched.map((t) => t.id));
    const finals = state.titles.filter((t) => ids.has(t.id));
    const avg = finals.length
      ? Math.round(finals.reduce((s, t) => s + (t.eloScore ?? 1000), 0) / finals.length)
      : 1000;
    dispatch({ type: 'SET_TASTE', payload: { baseline: avg, tasteVersion: TASTE_VERSION } });
    onComplete();
  }

  function advance() {
    if (round + 1 >= ROUNDS) finishAndSetBaseline();
    else setRound((r) => r + 1);
  }

  function handlePick(winner, loser) {
    dispatch({ type: 'RECORD_BATTLE', winnerId: winner.id, loserId: loser.id });
    advance();
  }

  if (!ready)
    return (
      <div className="flex min-h-screen items-center justify-center text-sub">
        Building battles…
      </div>
    );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-5 py-8">
      <motion.p
        key={inPicksPhase ? 'picks' : 'pool'}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-sub"
      >
        {inPicksPhase ? 'How do your picks compare to each other?' : "Don't overthink it."}
      </motion.p>
      {pair && (
        <BattleArena
          left={pair[0]}
          right={pair[1]}
          prompt={inPicksPhase ? 'Which do you like more?' : 'Pick what you’d rather watch.'}
          neitherLabel="Haven’t seen either"
          progress={(round + 1) / ROUNDS}
          onPick={handlePick}
          onNeither={advance}
        />
      )}
      <p className="mt-2 text-xs text-neutral">
        Round {round + 1} of {ROUNDS}
      </p>
    </div>
  );
}
