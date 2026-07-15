import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { getApiKey, setApiKey, usingFallbackKey } from '../../services/tmdbApi';
import ModeToggle from '../shared/ModeToggle';

export default function Settings({ onExit, onResetTaste }) {
  const { state, dispatch } = useApp();
  const { user, logout } = useAuth();
  const [key, setKey] = useState(usingFallbackKey() ? '' : getApiKey());
  const [confirmReset, setConfirmReset] = useState(false);

  function saveKey() {
    setApiKey(key.trim());
    location.reload();
  }

  return (
    <div className="mx-auto h-full max-w-xl overflow-y-auto px-5 py-5">
      <div className="flex items-center gap-3">
        <button onClick={onExit} className="text-2xl text-sub hover:text-txt" aria-label="Back">
          ←
        </button>
        <h1 className="font-display text-2xl text-txt">Settings</h1>
      </div>

      <section className="mt-6 space-y-3">
        <h2 className="text-sm uppercase tracking-wider text-sub">Default mode</h2>
        <p className="text-sm text-sub">What the button recommends by default.</p>
        <ModeToggle
          value={state.settings.mode || 'both'}
          onChange={(mode) => dispatch({ type: 'SET_SETTINGS', payload: { mode } })}
        />
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="text-sm uppercase tracking-wider text-sub">TMDB API key</h2>
        <p className="text-sm text-sub">
          {usingFallbackKey()
            ? 'Using a shared public key. Add your own for reliable results.'
            : 'Using your own key.'}
        </p>
        <div className="flex gap-2">
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="TMDB API key"
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-txt outline-none focus:border-accent"
          />
          <button onClick={saveKey} className="rounded-lg bg-accent px-4 text-white">
            Save
          </button>
        </div>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-sm uppercase tracking-wider text-sub">Data</h2>
        {!confirmReset ? (
          <button
            onClick={() => setConfirmReset(true)}
            className="w-full rounded-lg border border-red-900 bg-surface py-3 text-red-400 hover:border-red-600"
          >
            Reset taste profile
          </button>
        ) : (
          <div className="rounded-lg border border-red-900 bg-surface p-3 text-sm">
            <p className="text-txt">Wipe Elo scores + genre weights and re-run onboarding?</p>
            <div className="mt-2 flex gap-2">
              <button onClick={onResetTaste} className="rounded-md bg-red-600 px-3 py-1 text-white">
                Reset
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="rounded-md border border-border px-3 py-1 text-sub"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="mt-6 space-y-2 border-t border-border pt-5">
        {user && <p className="truncate text-sm text-sub">Signed in as {user.name || user.email}</p>}
        <button
          onClick={logout}
          className="w-full rounded-lg border border-border bg-surface py-3 text-sub hover:border-accent hover:text-txt"
        >
          ⎋ Sign out
        </button>
      </section>
    </div>
  );
}
