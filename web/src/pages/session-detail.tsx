import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  getSession,
  getSessionTraces,
  type Session,
  type TraceSpan,
} from "@/lib/api";
import { formatTokens, formatCost, formatDuration, formatRelativeTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  const sortedTtfts = [...ttfts].sort((a, b) => a - b);
  const p50Ttft = sortedTtfts.length > 0 ? sortedTtfts[Math.floor(sortedTtfts.length * 0.5)] : null;
  const p95Ttft = sortedTtfts.length > 0 ? sortedTtfts[Math.floor(sortedTtfts.length * 0.95)] : null;
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
  const [traceSpans, setTraceSpans] = useState<TraceSpan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([getSession(id), getSessionTraces(id)])
      .then(([s, t]) => {
        setSession(s);
        setTraceSpans(t);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

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
              <span className="text-muted-foreground">Spans: </span>
              {traceSpans.length}
            </div>
            {session.totalErrors > 0 && (
              <div>
                <span className="text-muted-foreground">Errors: </span>
                <Badge variant="destructive">{session.totalErrors}</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabbed content */}
      {traceSpans.length > 0 ? (
        <Tabs defaultValue="conversation">
          <TabsList>
            <TabsTrigger value="conversation">
              Conversation ({traceSpans.length})
            </TabsTrigger>
            <TabsTrigger value="performance">
              Performance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="conversation">
            <div className="space-y-6 mt-4 max-w-3xl">
              {traceSpans.map((span) => (
                <ConversationTurn key={span.id} span={span} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="performance">
            <div className="mt-4">
              <PerformanceView spans={traceSpans} />
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <div className="text-center py-10 text-muted-foreground text-sm">
          No trace spans recorded for this session
        </div>
      )}
    </div>
  );
}
