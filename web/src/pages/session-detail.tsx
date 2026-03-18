import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  getSession,
  getSessionPrompts,
  getSessionTraces,
  getPromptEvents,
  type Session,
  type Prompt,
  type TraceSpan,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// --- Conversation View (Trace Spans) ---

function ConversationTurn({ span }: { span: TraceSpan }) {
  const [expanded, setExpanded] = useState(false);

  const userText = span.newContext;
  const assistantText = span.responseModelOutput;
  const hasContent = userText || assistantText;

  return (
    <div className="space-y-3">
      {/* User message */}
      {userText && (
        <div className="flex gap-3">
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold mt-0.5">
            U
          </div>
          <div className="flex-1 min-w-0">
            <div className="bg-muted rounded-lg px-4 py-3 text-sm whitespace-pre-wrap break-words">
              {userText}
            </div>
          </div>
        </div>
      )}

      {/* Assistant message */}
      {assistantText && (
        <div className="flex gap-3">
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-chart-3 text-white flex items-center justify-center text-xs font-bold mt-0.5">
            A
          </div>
          <div className="flex-1 min-w-0">
            <div className="bg-card border border-border rounded-lg px-4 py-3 text-sm whitespace-pre-wrap break-words">
              {assistantText}
            </div>
            {/* Inline metrics bar */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {span.model || "unknown"}
              </Badge>
              {span.durationMs != null && (
                <span className="font-mono">{formatDuration(span.durationMs)}</span>
              )}
              {span.ttftMs != null && (
                <span className="font-mono">TTFT {formatDuration(span.ttftMs)}</span>
              )}
              <span className="font-mono">
                {formatTokens((span.inputTokens ?? 0) + (span.outputTokens ?? 0))} tok
              </span>
              {span.responseHasToolCall && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  tools
                </Badge>
              )}
              <span className={expanded ? "rotate-180 transition-transform" : "transition-transform"}>
                &#9662;
              </span>
            </button>
          </div>
        </div>
      )}

      {/* No content — show a minimal span indicator */}
      {!hasContent && (
        <div className="flex gap-3">
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground mt-0.5">
            ?
          </div>
          <div className="flex-1">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-2"
            >
              <span className="font-mono">{span.spanName}</span>
              {span.model && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{span.model}</Badge>}
              {span.durationMs != null && <span className="font-mono">{formatDuration(span.durationMs)}</span>}
              <span className={expanded ? "rotate-180 transition-transform" : "transition-transform"}>
                &#9662;
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Expanded details */}
      {expanded && <SpanDetail span={span} />}
    </div>
  );
}

function SpanDetail({ span }: { span: TraceSpan }) {
  let tools: string[] = [];
  try {
    if (span.tools) tools = JSON.parse(span.tools);
  } catch { /* ignore */ }

  let attrs: Record<string, unknown> = {};
  try {
    if (span.attributes) attrs = JSON.parse(span.attributes);
  } catch { /* ignore */ }

  return (
    <div className="ml-10 bg-muted/30 border border-border rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <MetricBox label="Input Tokens" value={span.inputTokens?.toLocaleString() ?? "-"} />
        <MetricBox label="Output Tokens" value={span.outputTokens?.toLocaleString() ?? "-"} />
        <MetricBox label="Cache Read" value={span.cacheReadTokens?.toLocaleString() ?? "-"} />
        <MetricBox label="Cache Created" value={span.cacheCreationTokens?.toLocaleString() ?? "-"} />
        <MetricBox label="Duration" value={span.durationMs != null ? formatDuration(span.durationMs) : "-"} />
        <MetricBox label="TTFT" value={span.ttftMs != null ? formatDuration(span.ttftMs) : "-"} />
        <MetricBox label="Attempt" value={span.attempt?.toString() ?? "-"} />
        <MetricBox label="Success" value={span.success != null ? (span.success ? "Yes" : "No") : "-"} />
      </div>

      {span.speed && (
        <div className="text-xs">
          <span className="text-muted-foreground">Speed: </span>
          <Badge variant="outline" className="text-[10px]">{span.speed}</Badge>
        </div>
      )}

      {span.systemPromptPreview && (
        <div className="text-xs">
          <span className="text-muted-foreground">System Prompt: </span>
          <span className="font-mono text-muted-foreground">
            {span.systemPromptHash}
          </span>
          <span className="text-muted-foreground"> ({span.systemPromptLength?.toLocaleString()} chars)</span>
          <div className="mt-1 bg-muted rounded p-2 text-muted-foreground italic truncate">
            {span.systemPromptPreview}
          </div>
        </div>
      )}

      {tools.length > 0 && (
        <div className="text-xs">
          <span className="text-muted-foreground">Tools ({span.toolsCount}): </span>
          <div className="flex flex-wrap gap-1 mt-1">
            {tools.map((tool, i) => (
              <Badge key={i} variant="secondary" className="text-[10px]">
                {typeof tool === "string" ? tool : (tool as Record<string, unknown>).name as string || JSON.stringify(tool)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {span.systemReminders && (
        <div className="text-xs">
          <span className="text-muted-foreground">
            System Reminders ({span.systemRemindersCount}):
          </span>
          <pre className="mt-1 bg-muted rounded p-2 text-[11px] max-h-32 overflow-auto whitespace-pre-wrap">
            {span.systemReminders}
          </pre>
        </div>
      )}

      {Object.keys(attrs).length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="text-xs text-muted-foreground hover:text-foreground">
            Raw attributes &#9662;
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-1 text-[11px] bg-muted p-3 rounded overflow-auto max-h-60">
              {JSON.stringify(attrs, null, 2)}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      )}

      <div className="flex gap-3 text-[10px] text-muted-foreground font-mono">
        <span>trace: {span.traceId.slice(0, 12)}...</span>
        <span>span: {span.spanId}</span>
        {span.parentSpanId && <span>parent: {span.parentSpanId}</span>}
      </div>
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground mb-0.5">{label}</div>
      <div className="font-mono font-medium">{value}</div>
    </div>
  );
}

// --- Events View (Legacy prompts + events) ---

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
  } catch { /* ignore */ }

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

// --- Performance View ---

function PerformanceView({ spans }: { spans: TraceSpan[] }) {
  if (spans.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        No trace spans available
      </div>
    );
  }

  const totalInputTokens = spans.reduce((s, sp) => s + (sp.inputTokens ?? 0), 0);
  const totalOutputTokens = spans.reduce((s, sp) => s + (sp.outputTokens ?? 0), 0);
  const totalCacheRead = spans.reduce((s, sp) => s + (sp.cacheReadTokens ?? 0), 0);
  const totalCacheCreation = spans.reduce((s, sp) => s + (sp.cacheCreationTokens ?? 0), 0);
  const ttfts = spans.filter((s) => s.ttftMs != null).map((s) => s.ttftMs!);
  const durations = spans.filter((s) => s.durationMs != null).map((s) => s.durationMs!);
  const avgTtft = ttfts.length > 0 ? ttfts.reduce((a, b) => a + b, 0) / ttfts.length : null;
  const p50Ttft = ttfts.length > 0 ? ttfts.sort((a, b) => a - b)[Math.floor(ttfts.length * 0.5)] : null;
  const p95Ttft = ttfts.length > 0 ? ttfts.sort((a, b) => a - b)[Math.floor(ttfts.length * 0.95)] : null;
  const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
  const failedSpans = spans.filter((s) => s.success === false);
  const retries = spans.filter((s) => (s.attempt ?? 1) > 1);

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatBox label="Total Spans" value={String(spans.length)} />
        <StatBox label="Total Input" value={formatTokens(totalInputTokens)} />
        <StatBox label="Total Output" value={formatTokens(totalOutputTokens)} />
        <StatBox label="Cache Read" value={formatTokens(totalCacheRead)} />
        <StatBox label="Cache Created" value={formatTokens(totalCacheCreation)} />
        <StatBox label="Avg TTFT" value={avgTtft != null ? formatDuration(avgTtft) : "-"} />
        <StatBox label="p50 TTFT" value={p50Ttft != null ? formatDuration(p50Ttft) : "-"} />
        <StatBox label="p95 TTFT" value={p95Ttft != null ? formatDuration(p95Ttft) : "-"} />
        <StatBox label="Avg Duration" value={avgDuration != null ? formatDuration(avgDuration) : "-"} />
        <StatBox label="Failures" value={String(failedSpans.length)} highlight={failedSpans.length > 0} />
        <StatBox label="Retries" value={String(retries.length)} highlight={retries.length > 0} />
      </div>

      {/* Span-by-span timing table */}
      <div>
        <h4 className="text-sm font-medium mb-2">Span Timings</h4>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-3 py-2 font-medium">Span</th>
                <th className="text-left px-3 py-2 font-medium">Model</th>
                <th className="text-right px-3 py-2 font-medium">TTFT</th>
                <th className="text-right px-3 py-2 font-medium">Duration</th>
                <th className="text-right px-3 py-2 font-medium">In</th>
                <th className="text-right px-3 py-2 font-medium">Out</th>
                <th className="text-right px-3 py-2 font-medium">Cache</th>
                <th className="text-center px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {spans.map((span) => (
                <tr key={span.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono truncate max-w-[200px]">
                    {span.spanName}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {span.model || "-"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {span.ttftMs != null ? formatDuration(span.ttftMs) : "-"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {span.durationMs != null ? formatDuration(span.durationMs) : "-"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {span.inputTokens?.toLocaleString() ?? "-"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {span.outputTokens?.toLocaleString() ?? "-"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {span.cacheReadTokens?.toLocaleString() ?? "-"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {span.success === true && (
                      <span className="text-green-500">OK</span>
                    )}
                    {span.success === false && (
                      <span className="text-red-500">FAIL</span>
                    )}
                    {span.success == null && (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-muted/30 border border-border rounded-lg px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`text-lg font-mono font-bold ${highlight ? "text-destructive" : ""}`}>
        {value}
      </div>
    </div>
  );
}

// --- Main Page ---

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [traceSpans, setTraceSpans] = useState<TraceSpan[]>([]);
  const [promptEvents, setPromptEvents] = useState<Record<string, TimelineEvent[]>>({});
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([getSession(id), getSessionPrompts(id), getSessionTraces(id)])
      .then(([s, p, t]) => {
        setSession(s);
        setPrompts(p);
        setTraceSpans(t);
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

  const hasTraces = traceSpans.length > 0;
  const defaultTab = hasTraces ? "conversation" : "events";

  return (
    <div>
      <Link
        to="/sessions"
        className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block"
      >
        &larr; Back to sessions
      </Link>

      {/* Session header */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="font-mono text-base">{session.id}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
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
                {formatTokens(session.totalInputTokens)} in / {formatTokens(session.totalOutputTokens)} out
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Cost: </span>
              <span className="font-mono">
                {formatCost(session.totalCostUsd)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">API Calls: </span>
              {session.totalApiCalls}
            </div>
            <div>
              <span className="text-muted-foreground">Tool Calls: </span>
              {session.totalToolCalls}
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

      {/* Tabbed content */}
      <Tabs defaultValue={defaultTab}>
        <TabsList>
          {hasTraces && (
            <TabsTrigger value="conversation">
              Conversation ({traceSpans.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="events">
            Events ({prompts.length} prompts)
          </TabsTrigger>
          {hasTraces && (
            <TabsTrigger value="performance">
              Performance
            </TabsTrigger>
          )}
        </TabsList>

        {/* Conversation Tab */}
        {hasTraces && (
          <TabsContent value="conversation">
            <div className="space-y-6 mt-4 max-w-3xl">
              {traceSpans.map((span) => (
                <ConversationTurn key={span.id} span={span} />
              ))}
            </div>
          </TabsContent>
        )}

        {/* Events Tab (legacy prompt timeline) */}
        <TabsContent value="events">
          <div className="space-y-2 mt-4">
            {prompts.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                No prompts recorded for this session
              </div>
            ) : (
              prompts.map((prompt, i) => (
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
              ))
            )}
          </div>
        </TabsContent>

        {/* Performance Tab */}
        {hasTraces && (
          <TabsContent value="performance">
            <div className="mt-4">
              <PerformanceView spans={traceSpans} />
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Event detail sheet */}
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
