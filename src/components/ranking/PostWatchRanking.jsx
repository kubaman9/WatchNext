import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { useTitles } from '../../hooks/useTitles';
import { seedElo, estimateIndex, eloForIndex, randomPrompt } from '../../utils/rating';
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

  // [lo, hi] is the range of insertion positions still consistent with the
  // comparisons made so far. Every pick tightens it: beating the title at index i
  // means "insert at or above i" (hi = min(hi, i)); losing means "below i"
  // (lo = max(lo, i+1)). Placement is by position, never by raw Elo, so the final
  // spot always respects each head-to-head choice.
  const lo = useRef(0);
  const hi = useRef(ranked.length);
  const used = useRef([]); // ranked ids already compared
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

  // Every comparison tightens the insertion window by the opponent's position.
  function record(newWins) {
    used.current.push(opponent.id);
    count.current += 1;
    if (newWins) hi.current = Math.min(hi.current, pivot); // new goes at/above pivot
    else lo.current = Math.max(lo.current, pivot + 1); // new goes below pivot
  }

  function handlePick(winner) {
    const newWins = winner.id === title.id;
    learn(newWins, opponent);
    record(newWins);
    setRound((r) => r + 1);
  }

  function handleNeither() {
    // "About the same" — no strong signal; narrow the larger half to converge.
    if (opponent) {
      used.current.push(opponent.id);
      count.current += 1;
      if (pivot - lo.current <= hi.current - pivot) lo.current = pivot + 1;
      else hi.current = pivot;
    }
    setRound((r) => r + 1);
  }

  // Final insertion index consistent with every pick. If picks were
  // non-transitive (lo > hi), fall back to the tighter (win-constrained) bound.
  function finalIndex() {
    const idx = lo.current <= hi.current ? lo.current : hi.current;
    return Math.max(0, Math.min(ranked.length, idx));
  }

  // One-shot "I love this": place it just above the current opponent — decisive
  // but modest (not to the top of the list).
  function handleMega() {
    if (megaUsed || !opponent) return;
    setMegaUsed(true);
    learn(true, opponent);
    finalizeWithElo(ranked.length ? eloForIndex(pivot, ranked) : seedRef.current);
  }

  function finalize() {
    finalizeWithElo(ranked.length ? eloForIndex(finalIndex(), ranked) : seedRef.current);
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
        initial={{ opacity: 0, scale: 0.8, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 20 }}
        className="flex flex-col items-center gap-3 text-center"
      >
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 400, damping: 14 }}
          className="text-4xl"
        >
          {rank === 1 ? '👑' : '✓'}
        </motion.span>
        <div className="font-display text-3xl text-txt">
          {title.title} lands at {rank ? `#${rank}` : 'your list'}
        </div>
        {rating != null && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="font-display text-xl text-accent"
          >
            {rating.toFixed(1)} / 5
          </motion.div>
        )}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-sm text-sub"
        >
          {below && <span>↑ above {below.title}</span>}
          {above && below && <span> · </span>}
          {above && <span>↓ below {above.title}</span>}
          {!above && !below && <span>First in your list 🎉</span>}
        </motion.div>
      </motion.div>
    );
  }

  if (!opponent) return <p className="text-sub">Placing…</p>;

  return (
    <>
      {thorough && (
        <motion.p
          key={count.current}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 text-center text-xs uppercase tracking-wider text-sub"
        >
          Careful re-rank · comparison {count.current + 1}
        </motion.p>
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
