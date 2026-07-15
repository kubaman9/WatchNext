import { motion } from 'framer-motion';

const FALLBACK =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450"><rect width="100%" height="100%" fill="#13131A"/><text x="50%" y="50%" fill="#6B7280" font-family="sans-serif" font-size="16" text-anchor="middle">No poster</text></svg>`
  );

export default function PosterCard({ title, onClick, selected, rank, className = '' }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.95 }}
      className={`group relative block w-full overflow-hidden rounded-none border bg-surface text-left shadow-card transition-shadow hover:shadow-glow ${
        selected ? 'border-accent ring-2 ring-accent' : 'border-border'
      } ${className}`}
    >
      <div className="aspect-[2/3] w-full">
        <img
          src={title.poster || FALLBACK}
          alt={title.title}
          loading="lazy"
          onError={(e) => (e.currentTarget.src = FALLBACK)}
          className="h-full w-full object-cover"
        />
      </div>
      {selected && (
        <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-none bg-accent text-sm text-white">
          ✓
        </div>
      )}
      {rank != null && (
        <div className="absolute left-2 top-2 rounded-none bg-black/70 px-2 py-0.5 font-display text-sm text-txt">
          #{rank}
        </div>
      )}
    </motion.button>
  );
}
