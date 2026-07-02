import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listAgents, assignAgentTab, setUserRole, getMe, inviteUser } from "@/lib/crm.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_app/team")({
  head: () => ({ meta: [{ title: "Team — Nexora CRM" }] }),
  component: TeamPage,
});

function TeamPage() {
  const meFn = useServerFn(getMe);
  const listFn = useServerFn(listAgents);
  const assignFn = useServerFn(assignAgentTab);
  const roleFn = useServerFn(setUserRole);
  const queryClient = useQueryClient();

  const inviteFn = useServerFn(inviteUser);
  const [invEmail, setInvEmail] = useState("");
  const [invName, setInvName] = useState("");
  const [invPw, setInvPw] = useState("");
  const [inviting, setInviting] = useState(false);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const { data } = useQuery({ queryKey: ["agents"], queryFn: () => listFn() });

  if (!me?.roles.includes("owner")) return <div className="glass-card p-6">Owner-only page.</div>;
  if (!data) return <div className="glass-card p-6">Loading team…</div>;

  const taken = new Set(data.profiles.map((p: any) => p.sheet_tab_name).filter(Boolean));

  function roleOf(userId: string) {
    return data!.roles.find((r: any) => r.user_id === userId)?.role || "agent";
  }

  async function changeTab(userId: string, tab: string) {
    try {
      await assignFn({ data: { userId, tab: tab === "__none__" ? null : tab } });
      toast.success("Agent tab updated");
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    } catch (e: any) { toast.error(e?.message || "Update failed"); }
  }
  async function changeRole(userId: string, role: "owner" | "agent") {
    try {
      await roleFn({ data: { userId, role } });
      toast.success("Role updated");
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    } catch (e: any) { toast.error(e?.message || "Update failed"); }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted-foreground uppercase tracking-[0.2em]">Team management</p>
        <h1 className="text-3xl md:text-4xl font-semibold mt-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          <span className="gradient-text">Agents</span> & permissions
        </h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          Each agent must be linked to one of the 8 tabs in the Google Sheet. Their name in the sheet becomes their assigned-agent identity in the CRM.
        </p>
      </header>

      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Sheet tab</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.profiles.map((p: any) => {
              const role = roleOf(p.id);
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{p.email}</div>
                  </TableCell>
                  <TableCell>
                    <Select value={role} onValueChange={(v) => changeRole(p.id, v as any)} disabled={p.id === me.userId}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="agent">Agent</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={p.sheet_tab_name || "__none__"} onValueChange={(v) => changeTab(p.id, v)}>
                      <SelectTrigger className="w-56"><SelectValue placeholder="Unassigned"/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— None —</SelectItem>
                        {data.agentTabs.map((t: string) => {
                          const usedByOther = taken.has(t) && p.sheet_tab_name !== t;
                          return (
                            <SelectItem key={t} value={t} disabled={usedByOther}>
                              {t}{usedByOther ? " (taken)" : ""}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="glass-card p-6">
        <h2 className="font-semibold mb-2">Sheet tabs</h2>
        <div className="flex flex-wrap gap-2">
          {data.agentTabs.map((t: string) => (
            <Badge key={t} variant="outline" className={taken.has(t) ? "border-emerald-500/40 text-emerald-300" : "border-border"}>
              {t}{taken.has(t) ? " · linked" : ""}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
