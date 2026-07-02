import { useId } from 'react';
import { motion } from 'framer-motion';

const OPTIONS = [
  { id: 'both', label: 'All', pill: 'bg-accent', text: 'text-white' },
  { id: 'movie', label: '🎬 Movies', pill: 'bg-movie', text: 'text-white' },
  { id: 'tv', label: '📺 TV', pill: 'bg-tv', text: 'text-black' },
];

// Segmented Movie / TV / All filter with a sliding active pill (shared layout
// animation, scoped per instance via useId). `value` is 'movie' | 'tv' | 'both'.
export default function ModeToggle({ value, onChange, className = '' }) {
  const id = useId();
  return (
    <div
      className={`inline-flex rounded-full border border-border bg-surface p-1 ${className}`}
      role="tablist"
    >
      {OPTIONS.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            className="relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
          >
            {active && (
              <motion.span
                layoutId={`${id}-mode-pill`}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                className={`absolute inset-0 rounded-full ${o.pill}`}
              />
            )}
            <span className={`relative z-10 ${active ? o.text : 'text-sub'}`}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
