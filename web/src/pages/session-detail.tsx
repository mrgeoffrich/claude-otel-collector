import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { getSession, getConversation } from "@/lib/api";
import type { AgentSessionResponse, ConversationMessageResponse } from "@claude-otel/lib";
import { ConversationMessage } from "@/components/conversation/conversation-message";
import { TurnGroup, SessionEndMarker } from "@/components/conversation/turn-group";
import { Badge } from "@/components/ui/badge";
import { formatCost, formatDuration } from "@/lib/format";
import { ArrowLeft } from "lucide-react";

interface Turn {
  number: number;
  messages: ConversationMessageResponse[];
}

function groupIntoTurns(messages: ConversationMessageResponse[]): Turn[] {
  const turns: Turn[] = [];
  let current: ConversationMessageResponse[] = [];

  for (const msg of messages) {
    // A user message starts a new turn (unless it's the very first message)
    if (msg.role === "user" && current.length > 0) {
      turns.push({ number: turns.length + 1, messages: current });
      current = [];
    }
    // Skip non-error result messages — they're shown as the session end marker
    if (msg.role === "result" && !msg.isError) {
      continue;
    }
    current.push(msg);
  }
  if (current.length > 0) {
    turns.push({ number: turns.length + 1, messages: current });
  }
  return turns;
}

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

  const turns = useMemo(() => groupIntoTurns(messages), [messages]);
  const resultMessage = useMemo(
    () => messages.find((m) => m.role === "result" && !m.isError),
    [messages],
  );

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
      {/* Back link */}
      <Link to="/sessions" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="size-3.5" /> Back to sessions
      </Link>

      {/* Compact header */}
      <div className="flex items-center gap-2.5 flex-wrap mb-6 pb-4 border-b border-border/50">
        <span className="font-mono text-sm font-semibold">{session.id.slice(0, 12)}</span>
        {session.model && (
          <Badge variant="secondary" className="text-[11px]">
            {session.model.replace("claude-", "").split("-202")[0]}
          </Badge>
        )}
        {session.claudeCodeVersion && (
          <Badge variant="outline" className="text-[11px]">
            v{session.claudeCodeVersion}
          </Badge>
        )}
        {session.status === "running" && <Badge className="text-[11px]">Running</Badge>}
        {session.isError && <Badge variant="destructive" className="text-[11px]">Error</Badge>}
        <span className="flex-1" />
        <span className="text-xs text-muted-foreground/60">
          {[
            session.totalCostUsd != null && session.totalCostUsd > 0 && formatCost(session.totalCostUsd),
            session.durationMs != null && formatDuration(session.durationMs),
            session.numTurns != null && `${session.numTurns} turns`,
            `${session.messageCount} msgs`,
          ].filter(Boolean).join(" · ")}
        </span>
      </div>

      {/* Turn timeline */}
      <div className="space-y-6">
        {turns.length === 0 ? (
          <p className="text-muted-foreground text-sm">No conversation messages yet.</p>
        ) : (
          <>
            {turns.map((turn) => (
              <TurnGroup key={turn.number} turnNumber={turn.number} isLast={!resultMessage && turn.number === turns.length}>
                {turn.messages.map((msg) => (
                  <ConversationMessage key={msg.id} message={msg} />
                ))}
              </TurnGroup>
            ))}
            {resultMessage && (
              <SessionEndMarker
                costUsd={resultMessage.costUsd}
                durationMs={resultMessage.durationMs}
                numTurns={resultMessage.numTurns}
              />
            )}
          </>
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
