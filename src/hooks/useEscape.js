import { useEffect } from 'react';

// Calls `onClose` when Escape is pressed. No-op if onClose is falsy.
export function useEscape(onClose) {
  useEffect(() => {
    if (!onClose) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}
