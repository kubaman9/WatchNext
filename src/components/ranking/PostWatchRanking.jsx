import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { useTitles } from '../../hooks/useTitles';
import BattleArena from '../shared/BattleArena';

const TOTAL = 3;

// Places a freshly-watched title via up to 3 Elo battles, then shows where it landed.
export default function PostWatchRanking({ title, onDone }) {
  const { dispatch } = useApp();
  const { watched, opponents, rankOf, neighbors, seedElo } = useTitles();
  const [round, setRound] = useState(0);
  const [done, setDone] = useState(false);
  const usedIds = useRef([]);
  const seeded = useRef(false);

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

  // No opponents to compare against — nothing to rank, just finish.
  useEffect(() => {
    if (!opponent && round < TOTAL && !done) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opponent]);

  function next() {
    if (round + 1 >= TOTAL) finish();
    else setRound((r) => r + 1);
  }

  function handlePick(winner, loser) {
    dispatch({ type: 'RECORD_BATTLE', winnerId: winner.id, loserId: loser.id });
    if (opponent) usedIds.current.push(opponent.id);
    next();
  }

  function handleNeither() {
    if (opponent) usedIds.current.push(opponent.id);
    next();
  }

  function finish() {
    setDone(true);
    setTimeout(onDone, 2000);
  }

  if (done) {
    const rank = rankOf(title.id);
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
        <div className="text-sm text-sub">
          {above && <span>↑ above {above.title}</span>}
          {above && below && <span> · </span>}
          {below && <span>↓ below {below.title}</span>}
          {!above && !below && <span>First in your list 🎉</span>}
        </div>
      </motion.div>
    );
  }

  if (!opponent) return <p className="text-sub">Placing…</p>;

  return (
    <BattleArena
      left={live}
      right={opponent}
      prompt={`How does ${title.title} compare?`}
      neitherLabel="Preferred neither"
      progress={(round + 1) / TOTAL}
      onPick={handlePick}
      onNeither={handleNeither}
    />
  );
}
