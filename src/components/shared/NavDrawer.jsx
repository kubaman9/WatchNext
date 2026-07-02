import { AnimatePresence, motion } from 'framer-motion';
import { useEscape } from '../../hooks/useEscape';

const ITEMS = [
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'list', label: 'My List', icon: '📋' },
  { id: 'watchlater', label: 'Watch Later', icon: '🔖' },
  { id: 'rank', label: 'Rank Titles', icon: '⚡' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export default function NavDrawer({ open, current, onNavigate, onClose, user, onLogout }) {
  useEscape(open ? onClose : null);
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
            className="absolute right-0 top-0 flex h-full w-64 flex-col border-l border-border bg-surface p-5"
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
            <motion.ul
              className="flex-1 space-y-1"
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } } }}
            >
              {ITEMS.map((item) => (
                <motion.li
                  key={item.id}
                  variants={{ hidden: { opacity: 0, x: 20 }, show: { opacity: 1, x: 0 } }}
                >
                  <motion.button
                    whileTap={{ scale: 0.97 }}
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
                  </motion.button>
                </motion.li>
              ))}
            </motion.ul>

            {user && (
              <div className="border-t border-border pt-3">
                <p className="truncate px-3 text-sm text-sub">{user.name || user.email}</p>
                <button
                  onClick={onLogout}
                  className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sub hover:bg-bg hover:text-txt"
                >
                  ⎋ Sign out
                </button>
              </div>
            )}
          </motion.nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
