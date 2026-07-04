import type { LeadPriority, LeadStatus } from "@/types/domain";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<LeadStatus, string> = {
  New:           "bg-sky-500/15 text-sky-300 border-sky-400/25",
  Contacted:     "bg-violet-500/15 text-violet-300 border-violet-400/25",
  Interested:    "bg-amber-500/15 text-amber-300 border-amber-400/25",
  "Follow Up":   "bg-cyan-500/15 text-cyan-300 border-cyan-400/25",
  Won:           "bg-emerald-500/15 text-emerald-300 border-emerald-400/25",
  Lost:          "bg-rose-500/15 text-rose-300 border-rose-400/25",
  "No Answer":   "bg-zinc-500/15 text-zinc-300 border-zinc-400/25",
  "Wrong Number":"bg-orange-500/15 text-orange-300 border-orange-400/25",
};

const PRIO_STYLES: Record<LeadPriority, string> = {
  High:   "bg-rose-500/15 text-rose-300 border-rose-400/25",
  Medium: "bg-amber-500/15 text-amber-300 border-amber-400/25",
  Low:    "bg-emerald-500/15 text-emerald-300 border-emerald-400/25",
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium", STATUS_STYLES[status])}>
      {status}
    </span>
  );
}
export function PriorityBadge({ priority }: { priority: LeadPriority }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium", PRIO_STYLES[priority])}>
      {priority}
    </span>
  );
}
