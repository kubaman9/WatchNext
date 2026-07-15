import { motion } from 'framer-motion';

const TABS = [
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'rank', label: 'Discover', icon: '⚡' },
  { id: 'watchlater', label: 'Watch Later', icon: '🔖' },
  { id: 'list', label: 'My List', icon: '📋' },
];

// Persistent bottom navigation — thumb-reachable, sliding active pill.
// Settings lives behind the gear on Home, not here.
export default function TabBar({ current, onNavigate }) {
  // Settings highlights nothing; it's reached from Home's gear.
  return (
    <nav className="z-40 flex shrink-0 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      {TABS.map((tab) => {
        const active = current === tab.id;
        return (
          <motion.button
            key={tab.id}
            whileTap={{ scale: 0.92 }}
            onClick={() => onNavigate(tab.id)}
            className="relative flex flex-1 flex-col items-center gap-0.5 py-2"
            aria-label={tab.label}
            aria-current={active ? 'page' : undefined}
          >
            {active && (
              <motion.span
                layoutId="tab-pill"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                className="absolute inset-x-3 inset-y-1 rounded-xl bg-accent/15"
              />
            )}
            <span className="relative z-10 text-lg leading-none">{tab.icon}</span>
            <span
              className={`relative z-10 text-[10px] font-medium ${
                active ? 'text-accent' : 'text-sub'
              }`}
            >
              {tab.label}
            </span>
          </motion.button>
        );
      })}
    </nav>
  );
}
