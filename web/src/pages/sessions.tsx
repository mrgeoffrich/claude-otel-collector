import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSessions, type Session } from "@/lib/api";
import { formatTokens, formatRelativeTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

/**
 * Strip common role prefixes from newContext (e.g., "[USER]\n")
 */
function stripRolePrefix(text: string): string {
  return text.replace(/^\[(?:USER|ASSISTANT|SYSTEM)\]\n?/i, "");
}

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
        {sessions.map((session) => {
          const preview = session.firstMessage
            ? stripRolePrefix(session.firstMessage)
            : null;

          return (
            <Link
              key={session.id}
              to={`/sessions/${session.id}`}
              className="block group"
            >
              <div className="border border-border rounded-lg px-4 py-3 hover:bg-muted/30 transition-colors">
                {/* Top row: ID, model, metrics */}
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted-foreground">
                    {session.id.slice(0, 8)}
                  </span>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {session.model || "unknown"}
                  </Badge>
                  {session.totalErrors > 0 && (
                    <Badge variant="destructive" className="text-[10px] shrink-0">
                      {session.totalErrors} err
                    </Badge>
                  )}
                  <div className="flex-1" />
                  <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                    <span className="font-mono">
                      {formatTokens(session.totalInputTokens + session.totalOutputTokens)} tok
                    </span>
                    <span>{session.spanCount ?? session.totalApiCalls} spans</span>
                    <span>{formatRelativeTime(session.lastSeenAt)}</span>
                  </div>
                </div>

                {/* Preview of first user message */}
                {preview && (
                  <p className="mt-1.5 text-sm text-foreground truncate group-hover:text-primary transition-colors">
                    {preview}
                  </p>
                )}

                {/* Preview of first response (truncated) */}
                {session.firstResponse && (
                  <p className="mt-0.5 text-xs text-muted-foreground truncate">
                    {session.firstResponse.slice(0, 120)}
                    {session.firstResponse.length > 120 ? "..." : ""}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
