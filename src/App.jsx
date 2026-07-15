import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from './context/AppContext';
import { useAuth } from './context/AuthContext';
import { useCloudSync } from './hooks/useCloudSync';
import { loadGenres } from './services/tmdbApi';
import { TASTE_VERSION } from './utils/rating';
import AuthScreen from './components/auth/AuthScreen';
import Onboarding from './components/onboarding/Onboarding';
import RebasePrompt from './components/onboarding/RebasePrompt';
import HomeScreen from './components/home/HomeScreen';
import RankMode from './components/ranking/RankMode';
import MyList from './components/list/MyList';
import WatchLater from './components/list/WatchLater';
import Settings from './components/list/Settings';
import TabBar from './components/shared/TabBar';
import Toast from './components/shared/Toast';

export default function App() {
  const { state, dispatch } = useApp();
  const { user, loading } = useAuth();
  const [view, setView] = useState('home');
  const [toast, setToast] = useState(null);
  const toastTimer = useRef();

  useCloudSync();

  useEffect(() => {
    loadGenres();
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  function resetTaste() {
    dispatch({ type: 'RESET_TASTE' });
    sessionStorage.removeItem('wn_fired');
    setView('home');
  }

  if (loading) {
    return <div className="flex h-dvh items-center justify-center text-sub">Loading…</div>;
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (!state.taste.onboardingComplete) {
    return (
      <>
        <Onboarding
          onDone={(built) => {
            if (built) showToast("Taste profile built. Here's your first pick.");
          }}
        />
        <Toast message={toast} />
      </>
    );
  }

  // Accounts onboarded under an older taste-calibration method get a one-time
  // prompt to rebase (recalibrates order via battles; the scale itself is fixed).
  const needsRebase = (state.taste.tasteVersion ?? 0) < TASTE_VERSION;

  return (
    <>
      {/* dvh shell: content fills the VISIBLE viewport (not behind mobile
          browser chrome), tab bar pinned below it. Screens use h-full. */}
      <div className="flex h-dvh flex-col">
        <div className="min-h-0 flex-1 overflow-hidden">
          {view === 'home' && <HomeScreen onNavigate={setView} onToast={showToast} />}
          {view === 'list' && <MyList />}
          {view === 'watchlater' && <WatchLater />}
          {view === 'rank' && <RankMode />}
          {view === 'settings' && (
            <Settings onExit={() => setView('home')} onResetTaste={resetTaste} />
          )}
        </div>
        <TabBar current={view} onNavigate={setView} />
      </div>

      {needsRebase && (
        <RebasePrompt
          onDone={(rebased) => {
            if (rebased) showToast('Taste calibration updated.');
          }}
        />
      )}
      <Toast message={toast} />
    </>
  );
}
