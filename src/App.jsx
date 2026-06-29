import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from './context/AppContext';
import { loadGenres } from './services/tmdbApi';
import Onboarding from './components/onboarding/Onboarding';
import HomeScreen from './components/home/HomeScreen';
import RankMode from './components/ranking/RankMode';
import MyList from './components/list/MyList';
import Settings from './components/list/Settings';
import NavDrawer from './components/shared/NavDrawer';
import Toast from './components/shared/Toast';

export default function App() {
  const { state, dispatch } = useApp();
  const [view, setView] = useState('home');
  const [drawer, setDrawer] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef();

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

  return (
    <>
      {view === 'home' && (
        <HomeScreen
          onOpenDrawer={() => setDrawer(true)}
          onNavigate={setView}
          onToast={showToast}
        />
      )}
      {view === 'list' && <MyList onExit={() => setView('home')} />}
      {view === 'rank' && <RankMode onExit={() => setView('home')} />}
      {view === 'settings' && (
        <Settings onExit={() => setView('home')} onResetTaste={resetTaste} />
      )}

      <NavDrawer
        open={drawer}
        current={view}
        onNavigate={setView}
        onClose={() => setDrawer(false)}
      />
      <Toast message={toast} />
    </>
  );
}
