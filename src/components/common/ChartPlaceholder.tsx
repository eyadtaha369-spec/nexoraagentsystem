import { BarChart3 } from "lucide-react";
export function ChartPlaceholder({ title, height = 260 }: { title: string; height?: number }) {
  return (
    <div className="glass-card p-6">
      <div className="mb-4 text-xs uppercase tracking-wider text-muted-foreground">{title}</div>
      <div
        className="grid place-items-center rounded-xl border border-dashed border-border/70 text-muted-foreground"
        style={{
          height,
          background:
            "repeating-linear-gradient(45deg, transparent, transparent 12px, oklch(1 0 0 / 0.02) 12px, oklch(1 0 0 / 0.02) 24px)",
        }}
      >
        <div className="flex flex-col items-center gap-2 text-sm">
          <BarChart3 className="h-6 w-6" />
          <span>Chart connects when the API is wired.</span>
        </div>
      </div>
    </div>
  );
}
