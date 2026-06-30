import { useApp } from '../../context/AppContext';
import BattleArena from '../shared/BattleArena';

// A single re-comparison between two titles already in the ranked list, woven
// into the Rank Mode feed to keep existing rankings calibrated over time.
export default function RerankDuel({ a, b, onDone }) {
  const { dispatch } = useApp();

  function handlePick(winner, loser) {
    dispatch({ type: 'RECORD_BATTLE', winnerId: winner.id, loserId: loser.id });
    setTimeout(onDone, 150);
  }

  if (!a || !b) {
    onDone();
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs uppercase tracking-wider text-gold">Quick re-rank</p>
      <BattleArena
        left={a}
        right={b}
        prompt="Which do you prefer?"
        neitherLabel="Skip"
        onPick={handlePick}
        onNeither={onDone}
      />
    </div>
  );
}
