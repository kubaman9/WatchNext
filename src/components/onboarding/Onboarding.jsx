import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { usePool } from '../../hooks/useTmdb';
import PickPopular from './PickPopular';
import TasteBattles from './TasteBattles';
import { TASTE_VERSION } from '../../utils/rating';

// Two steps: pick 5 titles you've actually watched (from a browsable popular
// list), then a battle round that establishes real relative taste — replaces
// the old single manual "rate 1-5" baseline entirely.
export default function Onboarding({ onDone }) {
  const { dispatch } = useApp();
  const buildPool = usePool();
  const [step, setStep] = useState(1); // 1 | 'battles'
  const [recent, setRecent] = useState([]);

  function step1Continue(selected) {
    selected.forEach((t) => {
      dispatch({ type: 'ADD_TITLE', title: { ...t, eloScore: 1000 } });
      dispatch({ type: 'MARK_WATCHED', id: t.id });
    });
    setRecent(selected);
    setStep('battles');
  }

  async function skipAll() {
    const titles = await buildPool(15);
    dispatch({ type: 'ADD_TITLES', titles });
    dispatch({ type: 'COMPLETE_ONBOARDING' });
    dispatch({ type: 'SET_TASTE', payload: { tasteVersion: TASTE_VERSION } });
    onDone();
  }

  function finishBattles() {
    dispatch({ type: 'COMPLETE_ONBOARDING' });
    onDone(true);
  }

  if (step === 1) return <PickPopular onContinue={step1Continue} onSkip={skipAll} />;
  return <TasteBattles recentlyWatched={recent} onComplete={finishBattles} />;
}
