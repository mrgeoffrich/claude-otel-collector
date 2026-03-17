import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getErrors, type ErrorsResponse } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ErrorsPage() {
  const [data, setData] = useState<ErrorsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getErrors()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-muted-foreground">Loading errors...</div>;
  }

  if (!data || data.total === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p className="text-lg font-medium">No errors found</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">
        Error Analysis{" "}
        <Badge variant="destructive" className="ml-2">
          {data.total}
        </Badge>
      </h2>

      <Tabs defaultValue="api-errors">
        <TabsList>
          <TabsTrigger value="api-errors">
            API Errors ({data.apiErrors.length})
          </TabsTrigger>
          <TabsTrigger value="tool-failures">
            Tool Failures ({data.failedTools.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="api-errors">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Error Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Retry</TableHead>
                <TableHead>Prompt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.apiErrors.map((err) => (
                <TableRow key={err.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatRelativeTime(err.timestamp)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="destructive">
                      {err.errorType || "unknown"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono">
                    {err.httpStatusCode}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{err.model || "unknown"}</Badge>
                  </TableCell>
                  <TableCell>{err.retryAttempt ?? "-"}</TableCell>
                  <TableCell>
                    <Link
                      to={`/sessions/${err.prompt.sessionId}`}
                      className="text-primary hover:underline text-sm"
                    >
                      {err.prompt.promptText
                        ? err.prompt.promptText.slice(0, 40) + "..."
                        : err.prompt.id.slice(0, 16) + "..."}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="tool-failures">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Tool</TableHead>
                <TableHead>Error</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Prompt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.failedTools.map((tool) => (
                <TableRow key={tool.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatRelativeTime(tool.timestamp)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {tool.toolName || "unknown"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-red-500 max-w-xs truncate">
                    {tool.error || "Unknown error"}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {tool.durationMs ? `${tool.durationMs}ms` : "-"}
                  </TableCell>
                  <TableCell>
                    <Link
                      to={`/sessions/${tool.prompt.sessionId}`}
                      className="text-primary hover:underline text-sm"
                    >
                      {tool.prompt.promptText
                        ? tool.prompt.promptText.slice(0, 40) + "..."
                        : tool.prompt.id.slice(0, 16) + "..."}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  );
}
