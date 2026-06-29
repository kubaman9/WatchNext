import { AnimatePresence, motion } from 'framer-motion';

const ITEMS = [
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'list', label: 'My List', icon: '📋' },
  { id: 'rank', label: 'Rank Titles', icon: '⚡' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export default function NavDrawer({ open, current, onNavigate, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 bg-black/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.nav
            className="absolute right-0 top-0 h-full w-64 border-l border-border bg-surface p-5"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 280, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <span className="font-display text-xl text-txt">WatchNext</span>
              <button onClick={onClose} className="text-2xl text-sub hover:text-txt">
                ✕
              </button>
            </div>
            <ul className="space-y-1">
              {ITEMS.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => {
                      onNavigate(item.id);
                      onClose();
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                      current === item.id
                        ? 'bg-accent/20 text-txt'
                        : 'text-sub hover:bg-bg hover:text-txt'
                    }`}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </motion.nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
