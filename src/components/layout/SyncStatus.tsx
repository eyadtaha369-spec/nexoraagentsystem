import { useEffect, useState } from "react";
import { WifiOff, RefreshCw, CloudUpload, CheckCircle2 } from "lucide-react";
import { syncStore, drainQueue, type SyncState } from "@/services/offline/sync";

export function SyncStatus() {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [state, setState] = useState<SyncState>(syncStore.get());

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const unsub = syncStore.subscribe(setState);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      unsub();
    };
  }, []);

  if (!online) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-2.5 py-1 text-xs text-muted-foreground">
        <WifiOff className="h-3.5 w-3.5" />
        Offline{state.pending > 0 ? ` · ${state.pending} pending` : ""}
      </span>
    );
  }

  if (state.status === "syncing") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-2.5 py-1 text-xs text-muted-foreground">
        <CloudUpload className="h-3.5 w-3.5 animate-pulse" />
        Syncing…
      </span>
    );
  }

  if (state.pending > 0) {
    return (
      <button
        onClick={() => drainQueue()}
        className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent/60"
        title="Retry sync now"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        {state.pending} to sync
      </button>
    );
  }

  return (
    <span className="hidden lg:inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-2.5 py-1 text-xs text-muted-foreground" title={state.lastSyncAt ? `Last synced ${new Date(state.lastSyncAt).toLocaleTimeString()}` : ""}>
      <CheckCircle2 className="h-3.5 w-3.5" />
      Synced
    </span>
  );
}
