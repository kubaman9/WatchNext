import { AnimatePresence, motion } from 'framer-motion';

export default function Toast({ message }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-border bg-surface px-5 py-2.5 text-sm text-txt shadow-card"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
