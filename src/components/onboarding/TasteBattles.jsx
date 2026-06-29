import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { usePool } from '../../hooks/useTmdb';
import { genreMultiplier } from '../../utils/scoring';
import BattleArena from '../shared/BattleArena';

const ROUNDS = 15;

function twoDistinct(arr, biasFn) {
  if (arr.length < 2) return null;
  const score = (t) => (biasFn ? biasFn(t) : 1) * (0.5 + Math.random());
  const sorted = [...arr].sort((a, b) => score(b) - score(a));
  const a = sorted[0];
  const b = sorted.find((t) => t.id !== a.id);
  return b ? [a, b] : null;
}

export default function TasteBattles({ recentlyWatched = [], onComplete }) {
  const { state, dispatch } = useApp();
  const buildPool = usePool();
  const [pool, setPool] = useState([]);
  const [round, setRound] = useState(0);
  const [ready, setReady] = useState(false);
  const seeded = useRef(false);

  // Fetch the battle pool once and seed it into state as unwatched titles.
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

  const biasFn = useMemo(() => {
    if (round < 5) return null;
    return (t) => genreMultiplier(t, state.taste.genreWeights || {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  const pair = useMemo(() => {
    if (!ready || !pool.length) return null;
    // After round 8, bias one side toward the user's own recently-watched picks.
    if (round >= 8 && recentlyWatched.length) {
      const a = recentlyWatched[round % recentlyWatched.length];
      const b = twoDistinct(
        pool.filter((t) => t.id !== a.id),
        biasFn
      );
      if (a && b) return [a, b[0]];
    }
    return twoDistinct(pool, biasFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, round]);

  function advance() {
    if (round + 1 >= ROUNDS) onComplete();
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
      <p className="text-sub">Don’t overthink it.</p>
      {pair && (
        <BattleArena
          left={pair[0]}
          right={pair[1]}
          prompt="Pick what you’d rather watch."
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
