import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getTraces, type TraceSpan } from "@/lib/api";
import { formatTokens, formatDuration, formatRelativeTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function TracesPage() {
  const [spans, setSpans] = useState<TraceSpan[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modelFilter, setModelFilter] = useState("");
  const [selectedSpan, setSelectedSpan] = useState<TraceSpan | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTraces({
      limit: 100,
      model: modelFilter || undefined,
    })
      .then((res) => {
        if (!cancelled) {
          setSpans(res.data);
          setTotal(res.total);
        }
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [modelFilter]);

  if (loading && spans.length === 0) {
    return <div className="text-muted-foreground">Loading traces...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Traces</h2>
        <span className="text-sm text-muted-foreground">{total} spans</span>
      </div>

      <div className="flex gap-3 mb-4">
        <Input
          placeholder="Filter by model..."
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {spans.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg font-medium">No trace spans yet</p>
          <p className="mt-2 text-sm">
            Trace spans are created from OTLP trace data sent to POST /v1/traces
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Span</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Session</TableHead>
              <TableHead className="text-right">TTFT</TableHead>
              <TableHead className="text-right">Duration</TableHead>
              <TableHead className="text-right">Tokens</TableHead>
              <TableHead>Input</TableHead>
              <TableHead>Output</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {spans.map((span) => (
              <TableRow
                key={span.id}
                className="cursor-pointer"
                onClick={() => setSelectedSpan(span)}
              >
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {formatRelativeTime(span.startTime)}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {span.spanName}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">
                    {span.model || "-"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Link
                    to={`/sessions/${span.sessionId}`}
                    className="text-primary hover:underline font-mono text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {span.sessionId.slice(0, 16)}...
                  </Link>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {span.ttftMs != null ? formatDuration(span.ttftMs) : "-"}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {span.durationMs != null ? formatDuration(span.durationMs) : "-"}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {formatTokens((span.inputTokens ?? 0) + (span.outputTokens ?? 0))}
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                  {span.newContext
                    ? span.newContext.slice(0, 60) + (span.newContext.length > 60 ? "..." : "")
                    : "-"}
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                  {span.responseModelOutput
                    ? span.responseModelOutput.slice(0, 60) + (span.responseModelOutput.length > 60 ? "..." : "")
                    : "-"}
                </TableCell>
                <TableCell className="text-center">
                  {span.success === true && <span className="text-green-500 text-xs font-medium">OK</span>}
                  {span.success === false && <span className="text-red-500 text-xs font-medium">FAIL</span>}
                  {span.success == null && <span className="text-muted-foreground text-xs">-</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Span detail sheet */}
      <Sheet open={!!selectedSpan} onOpenChange={() => setSelectedSpan(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Trace Span Detail</SheetTitle>
          </SheetHeader>
          {selectedSpan && (
            <div className="mt-4 space-y-4">
              <SpanDetailSheet span={selectedSpan} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SpanDetailSheet({ span }: { span: TraceSpan }) {
  let tools: unknown[] = [];
  try {
    if (span.tools) tools = JSON.parse(span.tools);
  } catch { /* ignore */ }

  let attrs: Record<string, unknown> = {};
  try {
    if (span.attributes) attrs = JSON.parse(span.attributes);
  } catch { /* ignore */ }

  return (
    <>
      {/* IDs */}
      <div className="text-xs font-mono text-muted-foreground space-y-1">
        <div>Trace: {span.traceId}</div>
        <div>Span: {span.spanId}</div>
        {span.parentSpanId && <div>Parent: {span.parentSpanId}</div>}
        <div>
          Session:{" "}
          <Link
            to={`/sessions/${span.sessionId}`}
            className="text-primary hover:underline"
          >
            {span.sessionId}
          </Link>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="text-muted-foreground">Span Name</div>
        <div className="font-mono">{span.spanName}</div>
        <div className="text-muted-foreground">Model</div>
        <div>{span.model || "-"}</div>
        <div className="text-muted-foreground">Duration</div>
        <div className="font-mono">{span.durationMs != null ? formatDuration(span.durationMs) : "-"}</div>
        <div className="text-muted-foreground">TTFT</div>
        <div className="font-mono">{span.ttftMs != null ? formatDuration(span.ttftMs) : "-"}</div>
        <div className="text-muted-foreground">Input Tokens</div>
        <div className="font-mono">{span.inputTokens?.toLocaleString() ?? "-"}</div>
        <div className="text-muted-foreground">Output Tokens</div>
        <div className="font-mono">{span.outputTokens?.toLocaleString() ?? "-"}</div>
        <div className="text-muted-foreground">Cache Read</div>
        <div className="font-mono">{span.cacheReadTokens?.toLocaleString() ?? "-"}</div>
        <div className="text-muted-foreground">Cache Created</div>
        <div className="font-mono">{span.cacheCreationTokens?.toLocaleString() ?? "-"}</div>
        <div className="text-muted-foreground">Success</div>
        <div>{span.success != null ? (span.success ? "Yes" : "No") : "-"}</div>
        <div className="text-muted-foreground">Attempt</div>
        <div>{span.attempt ?? "-"}</div>
        <div className="text-muted-foreground">Speed</div>
        <div>{span.speed ?? "-"}</div>
        <div className="text-muted-foreground">Query Source</div>
        <div>{span.querySource ?? "-"}</div>
        <div className="text-muted-foreground">Time</div>
        <div>{new Date(span.startTime).toLocaleString()}</div>
      </div>

      {/* User input */}
      {span.newContext && (
        <div>
          <h4 className="text-sm font-medium mb-1">User Input</h4>
          <pre className="text-xs bg-muted p-3 rounded max-h-40 overflow-auto whitespace-pre-wrap">
            {span.newContext}
          </pre>
        </div>
      )}

      {/* Model output */}
      {span.responseModelOutput && (
        <div>
          <h4 className="text-sm font-medium mb-1">Model Output</h4>
          <pre className="text-xs bg-muted p-3 rounded max-h-40 overflow-auto whitespace-pre-wrap">
            {span.responseModelOutput}
          </pre>
        </div>
      )}

      {/* System prompt */}
      {span.systemPromptPreview && (
        <div>
          <h4 className="text-sm font-medium mb-1">
            System Prompt{" "}
            <span className="text-muted-foreground font-normal font-mono text-xs">
              {span.systemPromptHash} ({span.systemPromptLength?.toLocaleString()} chars)
            </span>
          </h4>
          <pre className="text-xs bg-muted p-3 rounded max-h-32 overflow-auto whitespace-pre-wrap text-muted-foreground">
            {span.systemPromptPreview}
          </pre>
        </div>
      )}

      {/* Tools */}
      {tools.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-1">Tools ({span.toolsCount})</h4>
          <div className="flex flex-wrap gap-1">
            {tools.map((tool, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {typeof tool === "string" ? tool : (tool as Record<string, unknown>).name as string || JSON.stringify(tool)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Raw attributes */}
      {Object.keys(attrs).length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-1">Raw Attributes</h4>
          <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-60">
            {JSON.stringify(attrs, null, 2)}
          </pre>
        </div>
      )}
    </>
  );
}
