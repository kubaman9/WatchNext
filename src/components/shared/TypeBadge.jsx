// Colored pill distinguishing movies (red) from TV (gold).
export default function TypeBadge({ type, className = '' }) {
  const tv = type === 'tv';
  return (
    <span
      className={`genre-badge rounded-none px-2 py-0.5 font-semibold ${
        tv ? 'bg-tv/20 text-tv' : 'bg-movie/20 text-movie'
      } ${className}`}
    >
      {tv ? '📺 TV' : '🎬 Movie'}
    </span>
  );
}
