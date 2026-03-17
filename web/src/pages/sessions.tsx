import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSessions, type Session } from "@/lib/api";
import { formatTokens, formatCost, formatRelativeTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Session ID</TableHead>
            <TableHead>Last Active</TableHead>
            <TableHead>Model</TableHead>
            <TableHead className="text-right">Tokens</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead className="text-right">API Calls</TableHead>
            <TableHead className="text-right">Tool Calls</TableHead>
            <TableHead className="text-right">Errors</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((session) => (
            <TableRow key={session.id}>
              <TableCell>
                <Link
                  to={`/sessions/${session.id}`}
                  className="text-primary hover:underline font-mono text-sm"
                >
                  {session.id.length > 20
                    ? `${session.id.slice(0, 20)}...`
                    : session.id}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {formatRelativeTime(session.lastSeenAt)}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{session.model || "unknown"}</Badge>
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatTokens(
                  session.totalInputTokens + session.totalOutputTokens,
                )}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatCost(session.totalCostUsd)}
              </TableCell>
              <TableCell className="text-right text-sm">
                {session.totalApiCalls}
              </TableCell>
              <TableCell className="text-right text-sm">
                {session.totalToolCalls}
              </TableCell>
              <TableCell className="text-right">
                {session.totalErrors > 0 ? (
                  <Badge variant="destructive">{session.totalErrors}</Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">0</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
