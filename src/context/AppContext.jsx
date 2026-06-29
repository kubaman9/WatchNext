import { createContext, useContext, useEffect, useReducer } from 'react';
import { loadState, saveState } from '../services/storage';
import { updateElo } from '../utils/elo';
import { bumpGenreWeights } from '../utils/scoring';

const AppContext = createContext(null);

const initialState = {
  titles: [],
  taste: { genreWeights: {}, totalBattles: 0, onboardingComplete: false },
  settings: { mode: 'both' }, // 'movie' | 'tv' | 'both'
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
      return { ...state, titles };
    }

    case 'RECORD_BATTLE': {
      const { winnerId, loserId } = action;
      const winner = state.titles.find((t) => t.id === winnerId);
      const loser = state.titles.find((t) => t.id === loserId);
      if (!winner || !loser) return state;
      const [we, le] = updateElo(winner.eloScore, loser.eloScore);
      const titles = state.titles.map((t) => {
        if (t.id === winnerId) return { ...t, eloScore: we, wins: (t.wins || 0) + 1 };
        if (t.id === loserId) return { ...t, eloScore: le, losses: (t.losses || 0) + 1 };
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
      return { ...state, titles, taste: { ...state.taste, genreWeights } };
    }

    case 'REMOVE_TITLE':
      return { ...state, titles: state.titles.filter((t) => t.id !== action.id) };

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
      }));
      return {
        ...state,
        titles,
        taste: { genreWeights: {}, totalBattles: 0, onboardingComplete: false },
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
