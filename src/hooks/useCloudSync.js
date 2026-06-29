import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

// Loads the user's state from MongoDB on sign-in, then pushes local changes back
// (debounced). Server state wins on load so the account follows the user across devices.
export function useCloudSync() {
  const { state, dispatch } = useApp();
  const { user } = useAuth();
  const loaded = useRef(false);
  const timer = useRef();

  // Pull on sign-in.
  useEffect(() => {
    if (!user || loaded.current) return;
    let alive = true;
    api
      .getState()
      .then(({ state: remote }) => {
        if (!alive) return;
        if (remote) dispatch({ type: 'HYDRATE', payload: remote });
        loaded.current = true;
      })
      .catch(() => {
        loaded.current = true;
      });
    return () => {
      alive = false;
    };
  }, [user, dispatch]);

  // Push on change (debounced) once the initial pull has completed.
  useEffect(() => {
    if (!user || !loaded.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      api.putState(state).catch(() => {});
    }, 800);
    return () => clearTimeout(timer.current);
  }, [state, user]);
}
