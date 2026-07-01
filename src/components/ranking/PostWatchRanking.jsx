import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { useTitles } from '../../hooks/useTitles';
import { seedElo, estimateIndex, randomPrompt } from '../../utils/rating';
import BattleArena from '../shared/BattleArena';

// ── The one rating engine ─────────────────────────────────────────────────────
// Every place a title gets ranked (Rank Mode "Yes", Home "Watch This"/quick-add,
// Watch Later "Seen", My List re-rank) renders this component.
//
// It picks opponents by binary insertion (start near a multi-factor seed, then
// halve the candidate window each pick) and places the title strictly between the
// highest-Elo title it beat and the lowest-Elo title it lost to — so it always
// lands above what it beat and below what it lost to.
//
// Quick placements stop as soon as the window converges (~log2 N comparisons).
// A `thorough` re-rank (from My List) instead runs a guaranteed minimum number of
// comparisons (up to 5), continuing against the nearest untested neighbors after
// the window converges, so a re-rank is deliberately careful.
export default function PostWatchRanking({ title, onDone, thorough = false }) {
  const { state, dispatch } = useApp();
  const { watched, rankOf, neighbors, ratingOf } = useTitles();

  // Freeze the ranked snapshot (desc by Elo) for the whole session.
  const rankedRef = useRef(null);
  if (rankedRef.current === null) rankedRef.current = watched.filter((t) => t.id !== title.id);
  const ranked = rankedRef.current;

  const baseline = state.taste.baseline || 1000;
  const seedRef = useRef(null);
  if (seedRef.current === null) seedRef.current = seedElo(title, { taste: state.taste, baseline });

  // Guaranteed minimum comparisons: thorough → up to 5 (or list size); quick → 0.
  const minComparisons = thorough ? Math.min(5, ranked.length) : 0;
  const estTotal = Math.max(minComparisons, Math.ceil(Math.log2(ranked.length + 1)), 1);

  const lo = useRef(0);
  const hi = useRef(ranked.length);
  const used = useRef([]); // ranked ids already compared
  const beat = useRef([]); // Elos of titles this one beat
  const lost = useRef([]); // Elos of titles this one lost to
  const count = useRef(0);
  const [round, setRound] = useState(0);
  const [done, setDone] = useState(false);
  const [megaUsed, setMegaUsed] = useState(false);

  // Nearest not-yet-tested index to a center, scanning outward — used to keep
  // comparing after the binary window converges (thorough mode).
  function nearestUnused(center) {
    const c = Math.min(ranked.length - 1, Math.max(0, center));
    for (let d = 0; d < ranked.length; d++) {
      for (const i of [c - d, c + d]) {
        if (i >= 0 && i < ranked.length && !used.current.includes(ranked[i].id)) return i;
      }
    }
    return -1;
  }

  // Which opponent to show this round (-1 = we're done).
  const pivot = useMemo(() => {
    const L = lo.current;
    const H = hi.current;
    if (H - L > 0) {
      let idx;
      if (round === 0) {
        const si = estimateIndex(seedRef.current, ranked);
        idx = Math.min(H - 1, Math.max(L, si >= H ? H - 1 : si));
      } else {
        const jitter = thorough ? 0.1 : 0.32;
        const frac = 0.5 + (Math.random() - 0.5) * jitter;
        idx = Math.min(H - 1, Math.max(L, Math.floor(L + (H - L) * frac)));
      }
      if (used.current.includes(ranked[idx]?.id)) {
        // find an untested index inside the window
        for (let i = L; i < H; i++) if (!used.current.includes(ranked[i].id)) return i;
      }
      return idx;
    }
    // Window converged — keep going only if a thorough pass still owes comparisons.
    if (count.current < minComparisons) return nearestUnused(lo.current);
    return -1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  const prompt = useMemo(() => randomPrompt(), [round]);
  const opponent = pivot >= 0 ? ranked[pivot] : null;

  useEffect(() => {
    if (!opponent && !done) finalize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opponent]);

  function learn(newWins, opp) {
    dispatch({
      type: 'LEARN_GENRES',
      up: newWins ? title.genreIds : opp.genreIds,
      down: newWins ? opp.genreIds : title.genreIds,
      ids: [title.id, opp.id],
    });
  }

  function record(opp, newWins) {
    used.current.push(opp.id);
    count.current += 1;
    (newWins ? beat : lost).current.push(opp.eloScore ?? 1000);
    // Narrow the binary window while it's still open.
    if (hi.current - lo.current > 0) {
      if (newWins) hi.current = pivot;
      else lo.current = pivot + 1;
    }
  }

  function handlePick(winner) {
    const opp = opponent;
    const newWins = winner.id === title.id;
    learn(newWins, opp);
    record(opp, newWins);
    setRound((r) => r + 1);
  }

  function handleNeither() {
    // "About the same" — record no preference, just move on.
    if (opponent) {
      used.current.push(opponent.id);
      count.current += 1;
      if (hi.current - lo.current > 0) hi.current = Math.max(lo.current, pivot);
    }
    setRound((r) => r + 1);
  }

  // Place strictly between the highest Elo it beat and the lowest it lost to.
  function bracketElo() {
    const lower = beat.current.length ? Math.max(...beat.current) : null;
    const upper = lost.current.length ? Math.min(...lost.current) : null;
    if (lower != null && upper != null) return Math.round((lower + upper) / 2);
    if (lower != null) return lower + 30;
    if (upper != null) return upper - 30;
    return seedRef.current;
  }

  // One-shot "I love this": a decisive but modest lift ABOVE this opponent.
  function handleMega() {
    if (megaUsed || !opponent) return;
    setMegaUsed(true);
    learn(true, opponent);
    const above = ranked[pivot - 1];
    let elo = (opponent.eloScore ?? 1000) + 45;
    if (above) elo = Math.min(elo, (above.eloScore ?? 1000) - 1);
    finalizeWithElo(elo);
  }

  function finalize() {
    finalizeWithElo(ranked.length ? bracketElo() : seedRef.current);
  }
  function finalizeWithElo(elo) {
    dispatch({ type: 'SET_ELO', id: title.id, elo });
    setDone(true);
    setTimeout(onDone, 1800);
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

  return (
    <>
      {thorough && (
        <p className="mb-3 text-center text-xs uppercase tracking-wider text-sub">
          Careful re-rank · comparison {count.current + 1}
        </p>
      )}
      <BattleArena
        left={title}
        right={opponent}
        prompt={prompt}
        neitherLabel="About the same"
        progress={Math.min(0.95, count.current / estTotal)}
        onPick={handlePick}
        onNeither={handleNeither}
        onMega={!megaUsed ? handleMega : undefined}
        megaLabel={`🔥 Love ${title.title} — bump it up`}
      />
    </>
  );
}
