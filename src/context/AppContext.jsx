import { createContext, useContext, useEffect, useReducer } from 'react';
import { loadState, saveState } from '../services/storage';
import { updateElo } from '../utils/elo';
import { bumpGenreWeights } from '../utils/scoring';

const AppContext = createContext(null);

const initialState = {
  titles: [],
  taste: {
    genreWeights: {},
    totalBattles: 0,
    onboardingComplete: false,
    baseline: 1000,
    tasteVersion: 0,
  },
  settings: { mode: 'both' }, // 'movie' | 'tv' | 'both'
  watchLater: [], // ordered array of title ids — user's manual Watch Later order
};

function reducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return { ...state, ...action.payload };

    case 'ADD_TITLE': {
      if (state.titles.some((t) => t.id === action.title.id)) return state;
      return { ...state, titles: [...state.titles, action.title] };
    }

    case 'ADD_TITLES': {
      let titles = state.titles;
      for (const t of action.titles) {
        if (!titles.some((x) => x.id === t.id)) titles = [...titles, t];
      }
      return { ...state, titles };
    }

    case 'MARK_WATCHED': {
      const titles = state.titles.map((t) =>
        t.id === action.id
          ? { ...t, watched: true, watchedDate: action.date || new Date().toISOString() }
          : t
      );
      // Once watched it leaves the Watch Later queue.
      return { ...state, titles, watchLater: state.watchLater.filter((id) => id !== action.id) };
    }

    case 'RECORD_BATTLE': {
      const { winnerId, loserId } = action;
      const winner = state.titles.find((t) => t.id === winnerId);
      const loser = state.titles.find((t) => t.id === loserId);
      if (!winner || !loser) return state;
      let [we, le] = updateElo(winner.eloScore, loser.eloScore);
      // Hard ordering guarantee: a title you just preferred must rank above the
      // one it beat — immediately, even in an upset. Fixes slow convergence where
      // the winner stayed below the loser for several more comparisons.
      if (we <= le) we = le + 1;
      const titles = state.titles.map((t) => {
        if (t.id === winnerId)
          return { ...t, eloScore: we, wins: (t.wins || 0) + 1, comparisons: (t.comparisons || 0) + 1 };
        if (t.id === loserId)
          return { ...t, eloScore: le, losses: (t.losses || 0) + 1, comparisons: (t.comparisons || 0) + 1 };
        return t;
      });
      const genreWeights = bumpGenreWeights(
        state.taste.genreWeights,
        winner.genreIds,
        loser.genreIds
      );
      return {
        ...state,
        titles,
        taste: {
          ...state.taste,
          genreWeights,
          totalBattles: state.taste.totalBattles + 1,
        },
      };
    }

    case 'SET_ELO': {
      const titles = state.titles.map((t) =>
        t.id === action.id ? { ...t, eloScore: action.elo } : t
      );
      return { ...state, titles };
    }

    // Genre-only learning from a comparison (no Elo mutation) — used by the
    // binary-insertion placement engine, which sets Elo directly via SET_ELO.
    // Also credits a comparison to each participant for confidence tracking.
    case 'LEARN_GENRES': {
      const genreWeights = bumpGenreWeights(
        state.taste.genreWeights,
        action.up || [],
        action.down || []
      );
      const ids = action.ids || [];
      const titles = ids.length
        ? state.titles.map((t) =>
            ids.includes(t.id) ? { ...t, comparisons: (t.comparisons || 0) + 1 } : t
          )
        : state.titles;
      return {
        ...state,
        titles,
        taste: {
          ...state.taste,
          genreWeights,
          totalBattles: state.taste.totalBattles + 1,
        },
      };
    }

    case 'SKIP_RECOMMENDATION': {
      const titles = state.titles.map((t) =>
        t.id === action.id
          ? { ...t, skippedFromButton: (t.skippedFromButton || 0) + 1 }
          : t
      );
      return { ...state, titles };
    }

    case 'DISLIKE_TITLE': {
      const t = state.titles.find((x) => x.id === action.id);
      const titles = state.titles.map((x) =>
        x.id === action.id ? { ...x, disliked: true } : x
      );
      const genreWeights = t
        ? bumpGenreWeights(state.taste.genreWeights, [], t.genreIds)
        : state.taste.genreWeights;
      return {
        ...state,
        titles,
        taste: { ...state.taste, genreWeights },
        watchLater: state.watchLater.filter((id) => id !== action.id),
      };
    }

    case 'ADD_WATCH_LATER': {
      if (state.watchLater.includes(action.id)) return state;
      const titles = state.titles.map((t) =>
        t.id === action.id ? { ...t, watchLater: true } : t
      );
      return { ...state, titles, watchLater: [...state.watchLater, action.id] };
    }

    case 'REMOVE_WATCH_LATER': {
      // Removing marks it dismissed so it doesn't immediately resurface in
      // Discover (or the suggestion pool) — the user already said "not this".
      const titles = state.titles.map((t) =>
        t.id === action.id ? { ...t, watchLater: false, dismissed: true } : t
      );
      return { ...state, titles, watchLater: state.watchLater.filter((id) => id !== action.id) };
    }

    case 'REORDER_WATCH_LATER':
      return { ...state, watchLater: action.order };

    case 'REMOVE_TITLE':
      return {
        ...state,
        titles: state.titles.filter((t) => t.id !== action.id),
        watchLater: state.watchLater.filter((id) => id !== action.id),
      };

    case 'SET_TASTE':
      return { ...state, taste: { ...state.taste, ...action.payload } };

    case 'COMPLETE_ONBOARDING':
      return { ...state, taste: { ...state.taste, onboardingComplete: true } };

    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };

    case 'RESET_TASTE': {
      const titles = state.titles.map((t) => ({
        ...t,
        eloScore: 1000,
        wins: 0,
        losses: 0,
        skippedFromButton: 0,
        disliked: false,
        dismissed: false,
      }));
      return {
        ...state,
        titles,
        taste: {
          genreWeights: {},
          totalBattles: 0,
          onboardingComplete: false,
          baseline: 1000,
          tasteVersion: 0,
        },
      };
    }

    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState, (init) => {
    const saved = loadState();
    return saved ? { ...init, ...saved } : init;
  });

  useEffect(() => {
    saveState(state);
  }, [state]);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
