# Phase 3: Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the frontend to display agent SDK conversations using role-based message components, replacing the old OTLP-based UI.

**Architecture:** Rewrite `api.ts` to call new endpoints, rewrite `sessions.tsx` and `session-detail.tsx` to use new types, create per-role conversation components in `components/conversation/`. Delete dashboard and system-prompt pages.

**Tech Stack:** React 19, TypeScript, Tailwind v4, shadcn/ui (Badge, Card, Collapsible), react-markdown, react-router-dom 7, lucide-react

**Spec:** `docs/superpowers/specs/2026-03-25-phase3-frontend-redesign.md`

---

### Task 1: Rewrite API client

**Files:**
- Rewrite: `web/src/lib/api.ts`

- [ ] **Step 1: Rewrite api.ts**

```ts
import type {
  AgentSessionResponse,
  ConversationMessageResponse,
  PaginatedResponse,
} from "@claude-otel/lib";

export type { AgentSessionResponse, ConversationMessageResponse, PaginatedResponse };

const BASE_URL = "/api";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export function getSessions(params?: {
  limit?: number;
  offset?: number;
}): Promise<PaginatedResponse<AgentSessionResponse>> {
  const search = new URLSearchParams();
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.offset) search.set("offset", String(params.offset));
  const qs = search.toString();
  return fetchJson(`/sessions${qs ? `?${qs}` : ""}`);
}

export function getSession(id: string): Promise<AgentSessionResponse> {
  return fetchJson(`/sessions/${id}`);
}

export function getConversation(
  id: string,
  params?: { limit?: number; offset?: number; role?: string },
): Promise<PaginatedResponse<ConversationMessageResponse>> {
  const search = new URLSearchParams();
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.offset) search.set("offset", String(params.offset));
  if (params?.role) search.set("role", params.role);
  const qs = search.toString();
  return fetchJson(`/sessions/${id}/conversation${qs ? `?${qs}` : ""}`);
}
```

- [ ] **Step 2: Verify lib builds**

Run: `cd web && npx tsc --noEmit 2>&1 | head -5`
Expected: May show errors in pages that still reference old types — that's fine, we'll fix them next.

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/api.ts
git commit -m "feat: rewrite API client for agent SDK endpoints"
```

---

### Task 2: Create conversation components

**Files:**
- Create: `web/src/components/conversation/user-message.tsx`
- Create: `web/src/components/conversation/assistant-message.tsx`
- Create: `web/src/components/conversation/result-message.tsx`
- Create: `web/src/components/conversation/system-message.tsx`
- Create: `web/src/components/conversation/tool-summary-message.tsx`
- Create: `web/src/components/conversation/conversation-message.tsx`

- [ ] **Step 1: Create user-message.tsx**

```tsx
import type { ConversationMessageResponse } from "@claude-otel/lib";

export function UserMessage({ message }: { message: ConversationMessageResponse }) {
  return (
    <div className="border-l-4 border-blue-500 bg-card rounded-lg px-4 py-3 ring-1 ring-foreground/10">
      <p className="text-xs font-medium text-muted-foreground mb-1">User</p>
      <p className="whitespace-pre-wrap text-sm">{message.userContent}</p>
    </div>
  );
}
```

- [ ] **Step 2: Create assistant-message.tsx**

```tsx
import { useState } from "react";
import type { ConversationMessageResponse, ToolCallEntry } from "@claude-otel/lib";
import ReactMarkdown from "react-markdown";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";

export function AssistantMessage({ message }: { message: ConversationMessageResponse }) {
  let toolCalls: ToolCallEntry[] = [];
  if (message.toolCalls) {
    try {
      toolCalls = JSON.parse(message.toolCalls);
    } catch {
      // Ignore parse errors
    }
  }

  return (
    <div className="border-l-4 border-green-500 bg-card rounded-lg px-4 py-3 ring-1 ring-foreground/10">
      <div className="flex items-center gap-2 mb-1">
        <p className="text-xs font-medium text-muted-foreground">Assistant</p>
        {message.model && <Badge variant="secondary">{message.model.replace("claude-", "").split("-202")[0]}</Badge>}
        {message.stopReason === "tool_use" && <Badge variant="outline">tool_use</Badge>}
      </div>
      {message.textContent && (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown>{message.textContent}</ReactMarkdown>
        </div>
      )}
      {toolCalls.length > 0 && (
        <div className="mt-3 space-y-2">
          {toolCalls.map((tc) => (
            <ToolCallBlock key={tc.id} toolCall={tc} />
          ))}
        </div>
      )}
    </div>
  );
}

function ToolCallBlock({ toolCall }: { toolCall: ToolCallEntry }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
        <ChevronRight className={`size-3 transition-transform ${open ? "rotate-90" : ""}`} />
        <Badge variant="outline">{toolCall.name}</Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="mt-1 ml-5 text-xs bg-muted/30 rounded p-2 overflow-x-auto">
          {JSON.stringify(toolCall.input, null, 2)}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}
```

- [ ] **Step 3: Create result-message.tsx**

```tsx
import type { ConversationMessageResponse } from "@claude-otel/lib";
import { formatCost, formatDuration } from "@/lib/format";

export function ResultMessage({ message }: { message: ConversationMessageResponse }) {
  const isError = message.isError === true;

  return (
    <div className={`rounded-lg px-4 py-3 ${isError ? "bg-destructive/10" : "bg-muted/30"}`}>
      <p className={`text-xs font-medium mb-1 ${isError ? "text-destructive" : "text-muted-foreground"}`}>
        {isError ? "Session Error" : "Session Complete"}
      </p>
      <div className="flex items-center gap-4 text-sm">
        {message.costUsd != null && (
          <span className="text-muted-foreground">Cost: <span className="text-foreground font-medium">{formatCost(message.costUsd)}</span></span>
        )}
        {message.durationMs != null && (
          <span className="text-muted-foreground">Duration: <span className="text-foreground font-medium">{formatDuration(message.durationMs)}</span></span>
        )}
        {message.numTurns != null && (
          <span className="text-muted-foreground">Turns: <span className="text-foreground font-medium">{message.numTurns}</span></span>
        )}
      </div>
      {message.resultText && (
        <p className="mt-2 text-xs text-muted-foreground">{message.resultText}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create system-message.tsx**

```tsx
import type { ConversationMessageResponse } from "@claude-otel/lib";
import { Badge } from "@/components/ui/badge";

export function SystemMessage({ message }: { message: ConversationMessageResponse }) {
  return (
    <div className="rounded-lg bg-muted/20 px-4 py-2 border border-border/50">
      <div className="flex items-center gap-2">
        <p className="text-xs text-muted-foreground">{message.textContent || "System"}</p>
        {message.model && <Badge variant="secondary">{message.model.replace("claude-", "").split("-202")[0]}</Badge>}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create tool-summary-message.tsx**

```tsx
import type { ConversationMessageResponse } from "@claude-otel/lib";

export function ToolSummaryMessage({ message }: { message: ConversationMessageResponse }) {
  return (
    <div className="border-l-4 border-amber-500 bg-card rounded-lg px-4 py-3 ring-1 ring-foreground/10">
      <p className="text-xs font-medium text-muted-foreground mb-1">Tool Summary</p>
      <p className="text-sm text-muted-foreground">{message.toolSummary}</p>
    </div>
  );
}
```

- [ ] **Step 6: Create conversation-message.tsx dispatcher**

```tsx
import type { ConversationMessageResponse } from "@claude-otel/lib";
import { UserMessage } from "./user-message";
import { AssistantMessage } from "./assistant-message";
import { ResultMessage } from "./result-message";
import { SystemMessage } from "./system-message";
import { ToolSummaryMessage } from "./tool-summary-message";

export function ConversationMessage({ message }: { message: ConversationMessageResponse }) {
  switch (message.role) {
    case "user":
      return <UserMessage message={message} />;
    case "assistant":
      return <AssistantMessage message={message} />;
    case "result":
      return <ResultMessage message={message} />;
    case "system":
      return <SystemMessage message={message} />;
    case "tool_summary":
      return <ToolSummaryMessage message={message} />;
    default:
      return null;
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add web/src/components/conversation/
git commit -m "feat: add role-based conversation message components"
```

---

### Task 3: Rewrite sessions list page

**Files:**
- Rewrite: `web/src/pages/sessions.tsx`

- [ ] **Step 1: Rewrite sessions.tsx**

```tsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getSessions } from "@/lib/api";
import type { AgentSessionResponse } from "@claude-otel/lib";
import { Badge } from "@/components/ui/badge";
import { formatCost, formatRelativeTime } from "@/lib/format";

export function SessionsPage() {
  const [sessions, setSessions] = useState<AgentSessionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const res = await getSessions({ limit: 50 });
        if (mounted) {
          setSessions(res.data);
          setError(null);
        }
      } catch (err) {
        if (mounted) setError("Failed to load sessions");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 5000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading sessions...</p>;
  }

  if (error) {
    return <p className="text-destructive text-sm">{error}</p>;
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No sessions yet.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Point your agent's HTTP sink at this server to start collecting messages.
        </p>
      </div>
    );
  }

  const active = sessions.filter((s) => s.messageCount > 0);
  const empty = sessions.filter((s) => s.messageCount === 0);

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Sessions</h2>
      {active.map((session) => (
        <SessionCard key={session.id} session={session} />
      ))}
      {empty.length > 0 && (
        <>
          <h3 className="text-sm text-muted-foreground mt-6">Empty Sessions</h3>
          {empty.map((session) => (
            <SessionCard key={session.id} session={session} dimmed />
          ))}
        </>
      )}
    </div>
  );
}

function SessionCard({ session, dimmed }: { session: AgentSessionResponse; dimmed?: boolean }) {
  return (
    <Link
      to={`/sessions/${session.id}`}
      className={`block rounded-xl bg-card p-4 ring-1 ring-foreground/10 hover:ring-foreground/20 transition-all ${dimmed ? "opacity-50" : ""}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <code className="text-xs font-mono text-muted-foreground">{session.id.slice(0, 8)}</code>
          {session.model && (
            <Badge variant="secondary">{session.model.replace("claude-", "").split("-202")[0]}</Badge>
          )}
          {session.isError && <Badge variant="destructive">Error</Badge>}
          {session.status === "running" && <Badge variant="outline">Running</Badge>}
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatRelativeTime(session.lastSeenAt)}
        </span>
      </div>
      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
        {session.totalCostUsd != null && session.totalCostUsd > 0 && (
          <span>{formatCost(session.totalCostUsd)}</span>
        )}
        {session.numTurns != null && <span>{session.numTurns} turns</span>}
        <span>{session.messageCount} messages</span>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd web && npx tsc --noEmit 2>&1 | head -10`
Expected: May still show errors from session-detail.tsx (not yet rewritten) — that's OK.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/sessions.tsx
git commit -m "feat: rewrite sessions list page for agent SDK data"
```

---

### Task 4: Rewrite session detail page

**Files:**
- Rewrite: `web/src/pages/session-detail.tsx`

- [ ] **Step 1: Rewrite session-detail.tsx**

```tsx
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
      } catch (err) {
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
```

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/session-detail.tsx
git commit -m "feat: rewrite session detail page with conversation view"
```

---

### Task 5: Update App.tsx and clean up

**Files:**
- Rewrite: `web/src/App.tsx`
- Delete: `web/src/pages/dashboard.tsx`
- Delete: `web/src/pages/system-prompt.tsx`

- [ ] **Step 1: Rewrite App.tsx**

```tsx
import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import { SessionsPage } from "./pages/sessions";
import { SessionDetailPage } from "./pages/session-detail";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background">
        {/* Top nav */}
        <nav className="sticky top-0 z-10 border-b border-border bg-card px-6 py-3 flex items-center gap-6">
          <h1 className="text-lg font-bold">Agent Collector</h1>
          <NavLink
            to="/sessions"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`
            }
          >
            Sessions
          </NavLink>
        </nav>

        {/* Main content */}
        <main className="mx-auto max-w-6xl px-6 py-6">
          <Routes>
            <Route path="/" element={<Navigate to="/sessions" replace />} />
            <Route path="/sessions" element={<SessionsPage />} />
            <Route path="/sessions/:id" element={<SessionDetailPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: Delete old pages**

```bash
rm web/src/pages/dashboard.tsx web/src/pages/system-prompt.tsx
```

- [ ] **Step 3: Verify everything compiles**

Run: `cd web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Run lint**

Run: `cd web && npm run lint`
Expected: Passes (may have warnings, no errors).

- [ ] **Step 5: Commit**

```bash
git add web/src/App.tsx
git add -u web/src/pages/dashboard.tsx web/src/pages/system-prompt.tsx
git commit -m "feat: simplify App.tsx routes, remove dashboard and system-prompt pages"
```

---

### Task 6: Final verification

- [ ] **Step 1: Type-check**

Run: `cd web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 2: Lint**

Run: `cd web && npm run lint`
Expected: Passes.

- [ ] **Step 3: Start dev and visually verify**

Run: `npm run dev` (starts both server and web)

Check in browser at http://localhost:3110:
- Sessions list renders (empty state if no data)
- If you have data: click a session → conversation renders with role-colored messages
- Tool calls in assistant messages are collapsible
- Result message shows cost/duration/turns
- Back button works
- No console errors
- Nav bar shows "Agent Collector" with Sessions link only
