import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getSessions } from "@/lib/api";
import type { AgentSessionResponse } from "@claude-otel/lib";
import { Badge } from "@/components/ui/badge";
import { formatCost, formatRelativeTime } from "@/lib/format";

export function SessionsPage() {
  const [sessions, setSessions] = useState<AgentSessionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const res = await getSessions({ limit: 50 });
        if (mounted) {
          setSessions(res.data);
          setError(null);
        }
      } catch {
        if (mounted) setError("Failed to load sessions");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 5000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading sessions...</p>;
  }

  if (error) {
    return <p className="text-destructive text-sm">{error}</p>;
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No sessions yet.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Point your agent's HTTP sink at this server to start collecting messages.
        </p>
      </div>
    );
  }

  const active = sessions.filter((s) => s.messageCount > 0);
  const empty = sessions.filter((s) => s.messageCount === 0);

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Sessions</h2>
      {active.map((session) => (
        <SessionCard key={session.id} session={session} />
      ))}
      {empty.length > 0 && (
        <>
          <h3 className="text-sm text-muted-foreground mt-6">Empty Sessions</h3>
          {empty.map((session) => (
            <SessionCard key={session.id} session={session} dimmed />
          ))}
        </>
      )}
    </div>
  );
}

function SessionCard({ session, dimmed }: { session: AgentSessionResponse; dimmed?: boolean }) {
  return (
    <Link
      to={`/sessions/${session.id}`}
      className={`block rounded-xl bg-card p-4 ring-1 ring-foreground/10 hover:ring-foreground/20 transition-all ${dimmed ? "opacity-50" : ""}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <code className="text-xs font-mono text-muted-foreground">{session.id.slice(0, 8)}</code>
          {session.model && (
            <Badge variant="secondary">{session.model.replace("claude-", "").split("-202")[0]}</Badge>
          )}
          {session.isError && <Badge variant="destructive">Error</Badge>}
          {session.status === "running" && <Badge variant="outline">Running</Badge>}
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatRelativeTime(session.lastSeenAt)}
        </span>
      </div>
      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
        {session.totalCostUsd != null && session.totalCostUsd > 0 && (
          <span>{formatCost(session.totalCostUsd)}</span>
        )}
        {session.numTurns != null && <span>{session.numTurns} turns</span>}
        <span>{session.messageCount} messages</span>
      </div>
    </Link>
  );
}
