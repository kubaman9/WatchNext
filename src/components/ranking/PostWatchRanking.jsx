import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { useTitles } from '../../hooks/useTitles';
import { seedElo, estimateIndex, eloForIndex, randomPrompt } from '../../utils/rating';
import BattleArena from '../shared/BattleArena';

// ── The one rating engine ─────────────────────────────────────────────────────
// Every place a title gets ranked (Rank Mode "Yes", Home "Watch This"/quick-add,
// Watch Later "Seen", My List re-rank) renders this component. It places a title
// by binary insertion into the live ranked list:
//   • multi-factor seed (baseline + genre affinity + TMDB popularity) chooses the
//     first comparison, so we start near the likely spot
//   • each comparison halves the candidate window → exact placement in ~log2(N)
//   • randomized pivots + rotating prompts make every session feel fresh
//   • one "🔥 Mega prefer" per session jumps the title to the top of the window
//   • thorough mode (My List re-rank) adds boundary verification rounds
// Placement is comparison-driven, so a title always lands above everything it beat
// and below everything it lost to — no slow Elo convergence.
export default function PostWatchRanking({ title, onDone, thorough = false }) {
  const { state, dispatch } = useApp();
  const { watched, rankOf, neighbors, ratingOf } = useTitles();

  // Freeze the ranked snapshot (desc by Elo) for the whole session.
  const rankedRef = useRef(null);
  if (rankedRef.current === null) {
    rankedRef.current = watched.filter((t) => t.id !== title.id);
  }
  const ranked = rankedRef.current;

  const baseline = state.taste.baseline || 1000;
  const seedRef = useRef(null);
  if (seedRef.current === null) seedRef.current = seedElo(title, { taste: state.taste, baseline });

  const lo = useRef(0);
  const hi = useRef(ranked.length);
  const verifyQueue = useRef(null); // indices to re-check in thorough mode
  const [round, setRound] = useState(0);
  const [done, setDone] = useState(false);
  const [megaUsed, setMegaUsed] = useState(false);
  const estTotal = Math.max(1, Math.ceil(Math.log2(ranked.length + 1))) + (thorough ? 2 : 0);

  // Choose the opponent index for the current round.
  const pivot = useMemo(() => {
    if (verifyQueue.current && verifyQueue.current.length) return verifyQueue.current[0];
    const L = lo.current;
    const H = hi.current;
    if (H - L <= 0) return -1;
    if (round === 0) {
      const si = estimateIndex(seedRef.current, ranked);
      return Math.min(H - 1, Math.max(L, si >= H ? H - 1 : si));
    }
    const jitter = thorough ? 0.08 : 0.32; // wider variety in normal sessions
    const frac = 0.5 + (Math.random() - 0.5) * jitter;
    return Math.min(H - 1, Math.max(L, Math.floor(L + (H - L) * frac)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  const prompt = useMemo(() => randomPrompt(), [round]);
  const opponent = pivot >= 0 ? ranked[pivot] : null;

  // Window collapsed (or no opponents) → enter verify phase or finalize.
  useEffect(() => {
    if (done) return;
    if (!opponent) {
      if (thorough && verifyQueue.current === null && ranked.length) {
        const idxs = [lo.current - 1, lo.current]
          .filter((i) => i >= 0 && i < ranked.length);
        if (idxs.length) {
          verifyQueue.current = idxs;
          setRound((r) => r + 1);
          return;
        }
      }
      finalizeAt(lo.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opponent]);

  function learn(newWins, opp) {
    dispatch({
      type: 'LEARN_GENRES',
      up: newWins ? title.genreIds : opp.genreIds,
      down: newWins ? opp.genreIds : title.genreIds,
    });
  }

  function advance() {
    setRound((r) => r + 1);
  }

  function handlePick(winner) {
    const opp = opponent;
    const newWins = winner.id === title.id;
    learn(newWins, opp);

    // Verify phase: nudge the final boundary if the user flips on a neighbor.
    if (verifyQueue.current && verifyQueue.current.length) {
      const idx = verifyQueue.current[0];
      if (newWins && idx < lo.current) lo.current = idx;
      if (!newWins && idx >= lo.current) lo.current = idx + 1;
      verifyQueue.current = verifyQueue.current.slice(1);
      if (!verifyQueue.current.length) {
        finalizeAt(lo.current);
        return;
      }
      advance();
      return;
    }

    if (newWins) hi.current = pivot;
    else lo.current = pivot + 1;
    advance();
  }

  function handleNeither() {
    // Treat as "about equal" — settle right at the pivot.
    if (verifyQueue.current && verifyQueue.current.length) {
      verifyQueue.current = verifyQueue.current.slice(1);
      if (!verifyQueue.current.length) return finalizeAt(lo.current);
      return advance();
    }
    finalizeAt(pivot >= 0 ? pivot : lo.current);
  }

  // One-shot "I love this": a decisive but modest lift ABOVE this opponent —
  // a handful of points, not a jump to #1.
  function handleMega() {
    if (megaUsed || !opponent) return;
    setMegaUsed(true);
    learn(true, opponent);
    const MEGA = 45;
    const above = ranked[pivot - 1];
    let elo = (opponent.eloScore ?? 1000) + MEGA;
    if (above) elo = Math.min(elo, (above.eloScore ?? 1000) - 1); // never leapfrog
    finalizeWithElo(elo);
  }

  function finalizeWithElo(elo) {
    dispatch({ type: 'SET_ELO', id: title.id, elo });
    setDone(true);
    setTimeout(onDone, 1800);
  }

  function finalizeAt(index) {
    finalizeWithElo(ranked.length ? eloForIndex(index, ranked) : seedRef.current);
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

  const verifying = verifyQueue.current && verifyQueue.current.length;
  const progress = verifying ? 0.95 : Math.min(0.9, round / estTotal);

  return (
    <>
      {verifying && (
        <p className="mb-3 text-center text-xs uppercase tracking-wider text-sub">
          Double-checking placement…
        </p>
      )}
      <BattleArena
        left={title}
        right={opponent}
        prompt={prompt}
        neitherLabel="About the same"
        progress={progress}
        onPick={handlePick}
        onNeither={handleNeither}
        onMega={!megaUsed ? handleMega : undefined}
        megaLabel={`🔥 Love ${title.title} — bump it up`}
      />
    </>
  );
}
