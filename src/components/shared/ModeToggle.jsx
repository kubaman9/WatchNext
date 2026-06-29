const OPTIONS = [
  { id: 'both', label: 'All' },
  { id: 'movie', label: '🎬 Movies' },
  { id: 'tv', label: '📺 TV' },
];

// Segmented Movie / TV / All filter. `value` is 'movie' | 'tv' | 'both'.
export default function ModeToggle({ value, onChange, className = '' }) {
  return (
    <div
      className={`inline-flex rounded-full border border-border bg-surface p-1 ${className}`}
      role="tablist"
    >
      {OPTIONS.map((o) => {
        const active = value === o.id;
        const activeBg = o.id === 'tv' ? 'bg-tv text-black' : o.id === 'movie' ? 'bg-movie text-white' : 'bg-accent text-white';
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              active ? activeBg : 'text-sub hover:text-txt'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
