import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getSession, getConversation } from "@/lib/api";
import type { AgentSessionResponse, ConversationMessageResponse } from "@claude-otel/lib";
import { ConversationMessage } from "@/components/conversation/conversation-message";
import { Badge } from "@/components/ui/badge";
import { formatCost, formatDuration } from "@/lib/format";
import { ArrowLeft } from "lucide-react";

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<AgentSessionResponse | null>(null);
  const [messages, setMessages] = useState<ConversationMessageResponse[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let mounted = true;

    async function load() {
      try {
        const [sessionData, convData] = await Promise.all([
          getSession(id!),
          getConversation(id!, { limit: 1000 }),
        ]);
        if (mounted) {
          setSession(sessionData);
          setMessages(convData.data);
          setHasMore(convData.hasMore);
          setError(null);
        }
      } catch {
        if (mounted) setError("Session not found");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, [id]);

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading session...</p>;
  }

  if (error || !session) {
    return (
      <div>
        <Link to="/sessions" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
          <ArrowLeft className="size-4" /> Back to sessions
        </Link>
        <p className="text-destructive text-sm">{error || "Session not found"}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link to="/sessions" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-3">
          <ArrowLeft className="size-4" /> Back to sessions
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-semibold font-mono">{session.id.slice(0, 12)}</h2>
          {session.model && (
            <Badge variant="secondary">{session.model.replace("claude-", "").split("-202")[0]}</Badge>
          )}
          {session.claudeCodeVersion && (
            <Badge variant="outline">v{session.claudeCodeVersion}</Badge>
          )}
          {session.permissionMode && session.permissionMode !== "default" && (
            <Badge variant="outline">{session.permissionMode}</Badge>
          )}
          {session.status === "running" && <Badge>Running</Badge>}
          {session.isError && <Badge variant="destructive">Error</Badge>}
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          {session.totalCostUsd != null && session.totalCostUsd > 0 && (
            <span>Cost: {formatCost(session.totalCostUsd)}</span>
          )}
          {session.durationMs != null && (
            <span>Duration: {formatDuration(session.durationMs)}</span>
          )}
          {session.numTurns != null && <span>{session.numTurns} turns</span>}
          <span>{session.messageCount} messages</span>
        </div>
      </div>

      {/* Conversation */}
      <div className="space-y-3">
        {messages.length === 0 ? (
          <p className="text-muted-foreground text-sm">No conversation messages yet.</p>
        ) : (
          messages.map((msg) => (
            <ConversationMessage key={msg.id} message={msg} />
          ))
        )}
        {hasMore && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Showing first {messages.length} messages. More messages exist in this session.
          </p>
        )}
      </div>
    </div>
  );
}
