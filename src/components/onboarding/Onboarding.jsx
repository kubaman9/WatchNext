import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { usePool } from '../../hooks/useTmdb';
import RecentlyWatched from './RecentlyWatched';
import RatingAnchor from './RatingAnchor';
import TasteBattles from './TasteBattles';
import { ratingToElo } from '../../utils/rating';

export default function Onboarding({ onDone }) {
  const { dispatch } = useApp();
  const buildPool = usePool();
  const [step, setStep] = useState(1); // 1 | 'rate' | 'battles'
  const [recent, setRecent] = useState([]);

  function step1Continue(selected) {
    selected.forEach((t) => {
      dispatch({ type: 'ADD_TITLE', title: { ...t, eloScore: 1000 } });
      dispatch({ type: 'MARK_WATCHED', id: t.id });
    });
    setRecent(selected);
    setStep('rate');
  }

  // Anchor the scale to the first title's 1–10 rating: set its Elo and store the
  // personal baseline that the rating engine centers every future placement on.
  function rateContinue(rating) {
    const elo = ratingToElo(rating);
    if (recent[0]) dispatch({ type: 'SET_ELO', id: recent[0].id, elo });
    dispatch({ type: 'SET_TASTE', payload: { baseline: elo } });
    setStep('battles');
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

  if (step === 1) return <RecentlyWatched onContinue={step1Continue} onSkip={skipAll} />;
  if (step === 'rate') return <RatingAnchor title={recent[0]} onDone={rateContinue} />;
  return <TasteBattles recentlyWatched={recent} onComplete={finishBattles} />;
}
