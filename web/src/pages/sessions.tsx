import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSessions, type Session } from "@/lib/api";
import { formatTokens, formatCost, formatRelativeTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => {
      getSessions({ limit: 50 })
        .then((res) => setSessions(res.data))
        .catch(console.error)
        .finally(() => setLoading(false));
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="text-muted-foreground">Loading sessions...</div>;
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p className="text-lg font-medium">No sessions yet</p>
        <p className="mt-2 text-sm">
          Configure your Claude Agent SDK with OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Sessions</h2>
      <div className="space-y-2">
        {sessions.map((session) => (
          <Link
            key={session.id}
            to={`/sessions/${session.id}`}
            className="block group"
          >
            <div className="border border-border rounded-lg px-4 py-3 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-4">
                {/* Session ID and model */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-primary group-hover:underline">
                      {session.id.length > 28
                        ? `${session.id.slice(0, 28)}...`
                        : session.id}
                    </span>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {session.model || "unknown"}
                    </Badge>
                    {session.totalErrors > 0 && (
                      <Badge variant="destructive" className="text-[10px] shrink-0">
                        {session.totalErrors} err
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Metrics row */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                  <span className="font-mono">
                    {formatTokens(session.totalInputTokens + session.totalOutputTokens)} tok
                  </span>
                  <span className="font-mono">
                    {formatCost(session.totalCostUsd)}
                  </span>
                  <span>{session.totalApiCalls} calls</span>
                  <span>{session.totalToolCalls} tools</span>
                  <span className="w-20 text-right">
                    {formatRelativeTime(session.lastSeenAt)}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
