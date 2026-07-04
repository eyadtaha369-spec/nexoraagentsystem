import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  label, value, icon, hint, tint = "from-brand-blue/30 to-brand-purple/20",
}: { label: string; value: ReactNode; icon?: ReactNode; hint?: string; tint?: string }) {
  return (
    <div className="glass-card relative overflow-hidden p-5">
      <div className={cn("absolute -top-10 -right-10 h-28 w-28 rounded-full blur-3xl opacity-60 bg-gradient-to-br", tint)} />
      <div className="flex items-center justify-between relative">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className="mt-3 text-3xl font-semibold relative" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground relative">{hint}</div>}
    </div>
  );
}
