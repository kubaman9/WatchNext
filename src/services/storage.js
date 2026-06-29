const STATE_KEY = 'watchnext_state';

export function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function clearState() {
  try {
    localStorage.removeItem(STATE_KEY);
  } catch {
    /* ignore */
  }
}
