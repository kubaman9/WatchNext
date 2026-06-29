import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { usePool } from '../../hooks/useTmdb';
import RecentlyWatched from './RecentlyWatched';
import TasteBattles from './TasteBattles';

export default function Onboarding({ onDone }) {
  const { dispatch } = useApp();
  const buildPool = usePool();
  const [step, setStep] = useState(1);
  const [recent, setRecent] = useState([]);

  function step1Continue(selected) {
    selected.forEach((t) => {
      dispatch({ type: 'ADD_TITLE', title: { ...t, eloScore: 1000 } });
      dispatch({ type: 'MARK_WATCHED', id: t.id });
    });
    setRecent(selected);
    setStep(2);
  }

  async function skipAll() {
    const titles = await buildPool(15);
    dispatch({ type: 'ADD_TITLES', titles });
    dispatch({ type: 'COMPLETE_ONBOARDING' });
    onDone();
  }

  function finishBattles() {
    dispatch({ type: 'COMPLETE_ONBOARDING' });
    onDone(true);
  }

  if (step === 1)
    return <RecentlyWatched onContinue={step1Continue} onSkip={skipAll} />;

  return <TasteBattles recentlyWatched={recent} onComplete={finishBattles} />;
}
