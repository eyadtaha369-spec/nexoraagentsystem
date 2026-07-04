export function TableSkeleton({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="animate-pulse">
        <div className="grid gap-4 px-4 py-3 border-b border-border/60" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
          {Array.from({ length: cols }).map((_, i) => (<div key={i} className="h-3 rounded bg-muted/60" />))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="grid gap-4 px-4 py-4 border-b border-border/40 last:border-0" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
            {Array.from({ length: cols }).map((_, i) => (<div key={i} className="h-4 rounded bg-muted/40" />))}
          </div>
        ))}
      </div>
    </div>
  );
}
