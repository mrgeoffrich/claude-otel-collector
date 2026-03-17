import { useState } from "react";
import { Link } from "react-router-dom";
import { searchPrompts, type Prompt } from "@/lib/api";
import { formatTokens, formatCost, formatRelativeTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SearchResult = Prompt & { session: { id: string; model: string | null } };

export function SearchPage() {
  const [query, setQuery] = useState("");
  const [model, setModel] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const doSearch = async () => {
    setLoading(true);
    setSearched(true);
    try {
      const res = await searchPrompts({
        q: query || undefined,
        model: model || undefined,
      });
      setResults(res.data);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Prompt Search</h2>

      <div className="flex gap-3 mb-6">
        <Input
          placeholder="Search prompt text..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doSearch()}
          className="max-w-md"
        />
        <Input
          placeholder="Filter by model..."
          value={model}
          onChange={(e) => setModel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doSearch()}
          className="max-w-48"
        />
        <Button onClick={doSearch} disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </Button>
      </div>

      {searched && (
        <>
          <p className="text-sm text-muted-foreground mb-3">
            {total} result{total !== 1 ? "s" : ""} found
          </p>

          {results.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prompt</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((prompt) => (
                  <TableRow key={prompt.id}>
                    <TableCell className="max-w-xs truncate text-sm">
                      {prompt.promptText || (
                        <span className="text-muted-foreground italic">
                          Not captured
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/sessions/${prompt.sessionId}`}
                        className="text-primary hover:underline font-mono text-xs"
                      >
                        {prompt.sessionId.slice(0, 16)}...
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {prompt.model || prompt.session?.model || "unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatRelativeTime(prompt.timestamp)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatTokens(
                        prompt.totalInputTokens + prompt.totalOutputTokens,
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCost(prompt.totalCostUsd)}
                    </TableCell>
                    <TableCell className="text-right">
                      {prompt.errorCount > 0 ? (
                        <Badge variant="destructive">
                          {prompt.errorCount}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">0</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              No prompts match your search criteria
            </div>
          )}
        </>
      )}
    </div>
  );
}
