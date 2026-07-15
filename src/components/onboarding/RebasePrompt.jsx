import { useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { useTitles } from '../../hooks/useTitles';
import { TASTE_VERSION } from '../../utils/rating';
import Overlay from '../shared/Overlay';
import TasteBattles from './TasteBattles';

// Shown once to accounts onboarded under the old manual-baseline system. Reuses
// the same battle engine as fresh onboarding, anchored on the user's own
// highest-ranked watched titles instead of a fresh pick-5 step (they already
// have history — no need to make them re-pick).
export default function RebasePrompt({ onDone, autoStart = false }) {
  const { dispatch } = useApp();
  const { watched } = useTitles();
  const [battling, setBattling] = useState(autoStart);

  const anchors = watched.slice(0, 5);
  const canBattle = anchors.length >= 2;

  function dismiss() {
    // Mark as seen so it doesn't nag every session; still available in Settings.
    dispatch({ type: 'SET_TASTE', payload: { tasteVersion: TASTE_VERSION } });
    onDone(false);
  }

  function finishBattle() {
    setBattling(false);
    onDone(true);
  }

  return (
    <Overlay>
      {!battling ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto flex max-w-sm flex-col items-center gap-4 text-center"
        >
          <span className="text-4xl">🎯</span>
          <h1 className="font-display text-2xl text-txt">We upgraded taste calibration.</h1>
          <p className="text-sm text-sub">
            Recommendations are now built from real head-to-head battles instead of a single
            rating. A quick recalibration sharpens everything — takes about a minute.
          </p>
          {canBattle ? (
            <>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => setBattling(true)}
                className="w-full rounded-none bg-accent py-3.5 font-semibold text-white"
              >
                Rebase now
              </motion.button>
              <button onClick={dismiss} className="text-sm text-neutral hover:text-sub">
                Maybe later
              </button>
            </>
          ) : (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={dismiss}
              className="w-full rounded-none bg-accent py-3.5 font-semibold text-white"
            >
              Got it
            </motion.button>
          )}
        </motion.div>
      ) : (
        <TasteBattles recentlyWatched={anchors} onComplete={finishBattle} rounds={10} />
      )}
    </Overlay>
  );
}
