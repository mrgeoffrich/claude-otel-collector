import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  getSession,
  getSessionPrompts,
  getPromptEvents,
  type Session,
  type Prompt,
  type TimelineEvent,
} from "@/lib/api";
import { formatTokens, formatCost, formatDuration, formatRelativeTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

function EventIcon({ type }: { type: string }) {
  switch (type) {
    case "api_request":
      return <span className="text-blue-500 font-bold text-xs">API</span>;
    case "tool_result":
      return <span className="text-green-500 font-bold text-xs">TOOL</span>;
    case "api_error":
      return <span className="text-red-500 font-bold text-xs">ERR</span>;
    case "tool_decision":
      return <span className="text-gray-400 font-bold text-xs">PERM</span>;
    default:
      return null;
  }
}

function EventRow({
  event,
  onClick,
}: {
  event: TimelineEvent;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-1.5 text-sm hover:bg-muted/50 w-full text-left rounded"
    >
      <EventIcon type={event.type} />
      <span className="flex-1">
        {event.type === "api_request" && (
          <>
            <span className="text-muted-foreground">{event.model}</span>
            <span className="ml-2 font-mono text-xs">
              {event.inputTokens ?? 0}&rarr;{event.outputTokens ?? 0} tokens
            </span>
            <span className="ml-2 text-muted-foreground">
              {formatCost(event.costUsd ?? 0)}
            </span>
            {event.durationMs != null && (
              <span className="ml-2 text-muted-foreground">
                {formatDuration(event.durationMs)}
              </span>
            )}
          </>
        )}
        {event.type === "tool_result" && (
          <>
            <span>{event.toolName || "Tool"}</span>
            {event.success ? (
              <Badge variant="secondary" className="ml-2 text-xs">OK</Badge>
            ) : (
              <Badge variant="destructive" className="ml-2 text-xs">FAIL</Badge>
            )}
            {event.durationMs != null && (
              <span className="ml-2 text-muted-foreground">
                {formatDuration(event.durationMs)}
              </span>
            )}
          </>
        )}
        {event.type === "api_error" && (
          <>
            <span className="text-red-500">{event.errorType}</span>
            {event.httpStatusCode && (
              <Badge variant="destructive" className="ml-2 text-xs">
                {event.httpStatusCode}
              </Badge>
            )}
            {event.retryAttempt != null && (
              <span className="ml-2 text-muted-foreground">
                retry #{event.retryAttempt}
              </span>
            )}
          </>
        )}
        {event.type === "tool_decision" && (
          <>
            <span>{event.toolName}</span>
            <span className="ml-2">
              {event.decision === "accept" ? (
                <Badge variant="secondary" className="text-xs">accept</Badge>
              ) : (
                <Badge variant="destructive" className="text-xs">reject</Badge>
              )}
            </span>
            <span className="ml-2 text-muted-foreground text-xs">
              ({event.source})
            </span>
          </>
        )}
      </span>
    </button>
  );
}

function EventDetail({ event }: { event: TimelineEvent }) {
  let attrs: Record<string, unknown> = {};
  try {
    if (event.attributes) attrs = JSON.parse(event.attributes);
  } catch {
    // ignore
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="text-muted-foreground">Type</div>
        <div>{event.type}</div>
        <div className="text-muted-foreground">Timestamp</div>
        <div>{new Date(event.timestamp).toLocaleString()}</div>
        {event.model && (
          <>
            <div className="text-muted-foreground">Model</div>
            <div>{event.model}</div>
          </>
        )}
        {event.durationMs != null && (
          <>
            <div className="text-muted-foreground">Duration</div>
            <div>{formatDuration(event.durationMs)}</div>
          </>
        )}
        {event.costUsd != null && (
          <>
            <div className="text-muted-foreground">Cost</div>
            <div>{formatCost(event.costUsd)}</div>
          </>
        )}
        {event.inputTokens != null && (
          <>
            <div className="text-muted-foreground">Input Tokens</div>
            <div>{event.inputTokens.toLocaleString()}</div>
          </>
        )}
        {event.outputTokens != null && (
          <>
            <div className="text-muted-foreground">Output Tokens</div>
            <div>{event.outputTokens.toLocaleString()}</div>
          </>
        )}
        {event.cacheReadInputTokens != null && (
          <>
            <div className="text-muted-foreground">Cache Read</div>
            <div>{event.cacheReadInputTokens.toLocaleString()}</div>
          </>
        )}
        {event.toolName && (
          <>
            <div className="text-muted-foreground">Tool</div>
            <div>{event.toolName}</div>
          </>
        )}
        {event.success != null && (
          <>
            <div className="text-muted-foreground">Success</div>
            <div>{event.success ? "Yes" : "No"}</div>
          </>
        )}
        {event.error && (
          <>
            <div className="text-muted-foreground">Error</div>
            <div className="text-red-500">{event.error}</div>
          </>
        )}
        {event.toolParameters && (
          <>
            <div className="text-muted-foreground">Parameters</div>
            <div className="font-mono text-xs break-all">
              {event.toolParameters}
            </div>
          </>
        )}
        {event.errorType && (
          <>
            <div className="text-muted-foreground">Error Type</div>
            <div>{event.errorType}</div>
          </>
        )}
        {event.httpStatusCode != null && (
          <>
            <div className="text-muted-foreground">HTTP Status</div>
            <div>{event.httpStatusCode}</div>
          </>
        )}
      </div>

      {Object.keys(attrs).length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Raw Attributes</h4>
          <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-60">
            {JSON.stringify(attrs, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [promptEvents, setPromptEvents] = useState<
    Record<string, TimelineEvent[]>
  >({});
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([getSession(id), getSessionPrompts(id)])
      .then(([s, p]) => {
        setSession(s);
        setPrompts(p);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const loadEvents = async (promptId: string) => {
    if (promptEvents[promptId]) return;
    const events = await getPromptEvents(promptId);
    setPromptEvents((prev) => ({ ...prev, [promptId]: events }));
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading session...</div>;
  }

  if (!session) {
    return <div className="text-muted-foreground">Session not found</div>;
  }

  return (
    <div>
      <Link
        to="/sessions"
        className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block"
      >
        &larr; Back to sessions
      </Link>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-mono text-base">{session.id}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">Model: </span>
              <Badge variant="secondary">{session.model || "unknown"}</Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Started: </span>
              {formatRelativeTime(session.firstSeenAt)}
            </div>
            <div>
              <span className="text-muted-foreground">Tokens: </span>
              <span className="font-mono">
                {formatTokens(
                  session.totalInputTokens + session.totalOutputTokens,
                )}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Cost: </span>
              <span className="font-mono">
                {formatCost(session.totalCostUsd)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Errors: </span>
              {session.totalErrors > 0 ? (
                <Badge variant="destructive">{session.totalErrors}</Badge>
              ) : (
                "0"
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <h3 className="text-lg font-semibold mb-3">Prompt Timeline</h3>

      <div className="space-y-2">
        {prompts.map((prompt, i) => (
          <Collapsible key={prompt.id} onOpenChange={() => loadEvents(prompt.id)}>
            <CollapsibleTrigger className="w-full">
              <Card className="hover:bg-muted/30 transition-colors cursor-pointer">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground text-sm font-mono w-8">
                      #{i + 1}
                    </span>
                    <span className="flex-1 text-left text-sm truncate">
                      {prompt.promptText || (
                        <span className="text-muted-foreground italic">
                          Prompt text not captured
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatTokens(
                        prompt.totalInputTokens + prompt.totalOutputTokens,
                      )}{" "}
                      tokens
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatCost(prompt.totalCostUsd)}
                    </span>
                    {prompt.totalDurationMs > 0 && (
                      <span className="font-mono text-xs text-muted-foreground">
                        {formatDuration(prompt.totalDurationMs)}
                      </span>
                    )}
                    {prompt.errorCount > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {prompt.errorCount} err
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="ml-12 border-l-2 border-border pl-4 py-2 space-y-0.5">
                {promptEvents[prompt.id] ? (
                  promptEvents[prompt.id].length > 0 ? (
                    promptEvents[prompt.id].map((event) => (
                      <EventRow
                        key={event.id}
                        event={event}
                        onClick={() => setSelectedEvent(event)}
                      />
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground py-2">
                      No events
                    </div>
                  )
                ) : (
                  <div className="text-sm text-muted-foreground py-2">
                    Loading events...
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>

      <Sheet
        open={!!selectedEvent}
        onOpenChange={() => setSelectedEvent(null)}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Event Detail</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {selectedEvent && <EventDetail event={selectedEvent} />}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
