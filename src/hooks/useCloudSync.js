import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

// Loads the user's state from MongoDB on sign-in, then writes local changes back
// aggressively so nothing is lost:
//   • short 400ms debounce after any change
//   • a 10s safety interval that flushes if anything is still pending
//   • a flush (with keepalive) when the tab is hidden or closed
// Server state wins on load so the account follows the user across devices.
export function useCloudSync() {
  const { state, dispatch } = useApp();
  const { user } = useAuth();
  const loaded = useRef(false);
  const timer = useRef();
  const latest = useRef(state);
  const dirty = useRef(false);

  latest.current = state;

  // Pull on sign-in.
  useEffect(() => {
    if (!user || loaded.current) return;
    let alive = true;
    api
      .getState()
      .then(({ state: remote }) => {
        if (!alive) return;
        if (remote) dispatch({ type: 'HYDRATE', payload: remote });
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
      });
    return () => {
      alive = false;
    };
  }, [user, dispatch]);

  function flush(keepalive = false) {
    if (!user || !loaded.current || !dirty.current) return;
    dirty.current = false;
    api.putState(latest.current, { keepalive }).catch(() => {
      dirty.current = true; // retry on next change / interval
    });
  }

  // Debounced write on every change.
  useEffect(() => {
    if (!user || !loaded.current) return;
    dirty.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => flush(false), 400);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, user]);

  // Safety interval + flush on tab hide/close.
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => flush(false), 10000);
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush(true);
    };
    window.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', () => flush(true));
    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', onHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
}
