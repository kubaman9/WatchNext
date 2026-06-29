import { useCallback, useEffect, useRef, useState } from 'react';
import * as tmdb from '../services/tmdbApi';

// Debounced search hook.
export function useSearch(delay = 300) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef();

  useEffect(() => {
    clearTimeout(timer.current);
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        setResults(await tmdb.search(query));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, delay);
    return () => clearTimeout(timer.current);
  }, [query, delay]);

  return { query, setQuery, results, loading };
}

export function useProviders(id, type) {
  const [providers, setProviders] = useState([]);
  useEffect(() => {
    let alive = true;
    if (!id) return;
    tmdb.watchProviders(id, type).then((p) => alive && setProviders(p));
    return () => {
      alive = false;
    };
  }, [id, type]);
  return providers;
}

export function usePool() {
  return useCallback((size) => tmdb.buildPool(size), []);
}
