import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { useTitles } from '../../hooks/useTitles';
import BattleArena from '../shared/BattleArena';

// Dynamic round count based on library size and genre signal strength.
// thorough=true (from MyList re-rank) runs a longer, scaled set.
function roundsFor(title, listedCount, taste, thorough) {
  const base = Math.min(7, Math.max(3, Math.ceil(Math.log2(listedCount + 1))));
  if (thorough) return Math.min(12, Math.round(base * 1.5));

  const genreWeights = taste.genreWeights || {};
  const genreIds = title.genreIds || [];
  if (!genreIds.length || listedCount < 4) return base;

  const avgWeight = genreIds.reduce((s, id) => s + (genreWeights[id] ?? 1.0), 0) / genreIds.length;
  const deviation = Math.abs(avgWeight - 1.0);

  // Strong genre signal = we know our taste here → fewer battles needed
  if (deviation > 0.4 && listedCount > 10) return Math.max(2, base - 1);
  // Weak/unknown genre signal → more battles to calibrate
  if (deviation < 0.15 && listedCount > 5) return Math.min(9, base + 1);

  return base;
}

// thorough prop: triggers longer comparison set (from MyList re-rank flow)
export default function PostWatchRanking({ title, onDone, thorough = false }) {
  const { state, dispatch } = useApp();
  const { watched, opponents, rankOf, neighbors, seedElo, ratingOf } = useTitles();
  const [round, setRound] = useState(0);
  const [done, setDone] = useState(false);
  const usedIds = useRef([]);
  const seeded = useRef(false);
  const beatElos = useRef([]);
  const lostElos = useRef([]);

  // Fix round count once at start so it can't shift mid-flow.
  const totalRef = useRef(null);
  const cascadeRef = useRef(null);
  if (totalRef.current === null) {
    const listedCount = watched.filter((t) => t.id !== title.id).length;
    totalRef.current = roundsFor(title, listedCount, state.taste, thorough);
    // +2 cascade verification rounds: re-battle the bracket boundaries to fix
    // neighbor ordering bugs caused by insertion — only when library is big enough.
    cascadeRef.current = listedCount >= 4 ? 2 : 0;
  }
  const TOTAL = totalRef.current;
  const CASCADE = cascadeRef.current;
  const GRAND_TOTAL = TOTAL + CASCADE;

  // Seed starting Elo from genre affinity once, before first battle.
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    const current = watched.find((t) => t.id === title.id);
    if (current && (current.wins || 0) + (current.losses || 0) === 0) {
      dispatch({ type: 'SET_ELO', id: title.id, elo: seedElo(title) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const live = watched.find((t) => t.id === title.id) || title;
  const opponent = useMemo(
    () => opponents(live, usedIds.current)[0] || null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [round]
  );

  useEffect(() => {
    if (!opponent && round < GRAND_TOTAL && !done) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opponent]);

  function next() {
    if (round + 1 >= GRAND_TOTAL) finish();
    else setRound((r) => r + 1);
  }

  function handlePick(winner, loser) {
    dispatch({ type: 'RECORD_BATTLE', winnerId: winner.id, loserId: loser.id });
    if (opponent) {
      if (winner.id === title.id) beatElos.current.push(opponent.eloScore);
      else lostElos.current.push(opponent.eloScore);
      usedIds.current.push(opponent.id);
    }
    next();
  }

  function handleNeither() {
    if (opponent) usedIds.current.push(opponent.id);
    next();
  }

  // Place the title strictly between the highest it beat and lowest it lost to.
  // Re-applied after cascade rounds for maximum accuracy.
  function applyBracket() {
    const beat = beatElos.current;
    const lost = lostElos.current;
    if (!beat.length && !lost.length) return;
    const lower = beat.length ? Math.max(...beat) : null;
    const upper = lost.length ? Math.min(...lost) : null;
    let elo;
    if (lower != null && upper != null) elo = Math.round((lower + upper) / 2);
    else if (lower != null) elo = lower + 30;
    else elo = upper - 30;
    dispatch({ type: 'SET_ELO', id: title.id, elo });
  }

  function finish() {
    applyBracket();
    setDone(true);
    setTimeout(onDone, 2000);
  }

  if (done) {
    const rank = rankOf(title.id);
    const rating = ratingOf(title.id);
    const { above, below } = neighbors(title.id);
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-3 text-center"
      >
        <div className="font-display text-3xl text-txt">
          {title.title} lands at {rank ? `#${rank}` : 'your list'}
        </div>
        {rating != null && (
          <div className="font-display text-xl text-accent">{rating.toFixed(1)} / 5</div>
        )}
        <div className="text-sm text-sub">
          {below && <span>↑ above {below.title}</span>}
          {above && below && <span> · </span>}
          {above && <span>↓ below {above.title}</span>}
          {!above && !below && <span>First in your list 🎉</span>}
        </div>
      </motion.div>
    );
  }

  if (!opponent) return <p className="text-sub">Placing…</p>;

  const inCascade = round >= TOTAL;

  return (
    <>
      {inCascade && (
        <p className="mb-3 text-center text-xs uppercase tracking-wider text-sub">
          Verifying placement…
        </p>
      )}
      <BattleArena
        left={live}
        right={opponent}
        prompt={`How does ${title.title} compare?`}
        neitherLabel="Preferred neither"
        progress={(round + 1) / GRAND_TOTAL}
        onPick={handlePick}
        onNeither={handleNeither}
      />
    </>
  );
}
