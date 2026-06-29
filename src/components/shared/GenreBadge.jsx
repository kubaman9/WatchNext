export default function GenreBadge({ children }) {
  return (
    <span className="genre-badge rounded-full border border-border bg-surface px-2 py-0.5 text-sub">
      {children}
    </span>
  );
}
