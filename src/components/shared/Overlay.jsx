import { motion } from 'framer-motion';

// Full-screen centered overlay used to host battle / ranking flows.
export default function Overlay({ children, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg/95 p-4 backdrop-blur"
    >
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-3xl text-sub hover:text-txt"
          aria-label="Close"
        >
          ✕
        </button>
      )}
      {children}
    </motion.div>
  );
}
