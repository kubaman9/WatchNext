import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { useTitles } from '../../hooks/useTitles';
import BattleArena from '../shared/BattleArena';

// Battle count scales with library size (binary-search style) so larger lists
// place titles more precisely. 3 battles at small sizes, up to 7 for big lists.
function roundsFor(libraryCount) {
  return Math.min(7, Math.max(3, Math.ceil(Math.log2(libraryCount + 1))));
}

// Places a freshly-watched (or re-ranked) title via Elo battles, then shows where it landed.
export default function PostWatchRanking({ title, onDone }) {
  const { dispatch } = useApp();
  const { watched, opponents, rankOf, neighbors, seedElo } = useTitles();
  const [round, setRound] = useState(0);
  const [done, setDone] = useState(false);
  const usedIds = useRef([]);
  const seeded = useRef(false);
  // Elo of opponents this title beat / lost to, captured at battle time. Used to
  // place the title strictly between them so it never outranks something it lost to.
  const beatElos = useRef([]);
  const lostElos = useRef([]);
  // Fix the round count once at start so it can't shift mid-flow.
  const totalRef = useRef(null);
  if (totalRef.current === null) {
    totalRef.current = roundsFor(watched.filter((t) => t.id !== title.id).length);
  }
  const TOTAL = totalRef.current;

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

  // Override the title's Elo so it sits between the highest title it beat and the
  // lowest title it lost to — keeps the ranked order consistent with the choices.
  function applyBracket() {
    const beat = beatElos.current;
    const lost = lostElos.current;
    if (!beat.length && !lost.length) return; // no decisive battles — keep seed
    const lower = beat.length ? Math.max(...beat) : null; // must rank above this
    const upper = lost.length ? Math.min(...lost) : null; // must rank below this
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
          {below && <span>↑ above {below.title}</span>}
          {above && below && <span> · </span>}
          {above && <span>↓ below {above.title}</span>}
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
