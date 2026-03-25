# Phase 3: Frontend Redesign

## Context

Phases 1-2 replaced OTLP trace ingestion with Agent SDK message ingestion and added a reassembly service that produces structured `ConversationMessage` records. The frontend still references the old `Session`, `TraceSpan`, and dashboard APIs which no longer exist. This phase rewrites the frontend to render conversations from the new data.

## Design Decisions

- **Two pages only** — sessions list and session detail. Dashboard and system prompt viewer removed.
- **Single conversation view** — no tabs. Session header shows metadata, body shows the conversation.
- **Tool calls inline** — shown as collapsible blocks within assistant messages, not as separate conversation entries.
- **Role-based components** — each conversation message role gets its own React component.
- **Rewrite pages, keep shell** — App.tsx structure, nav bar, shadcn/ui components, Tailwind, and utility functions preserved. Pages and API client rewritten.

## File Structure

### Files to Create

```
web/src/components/conversation/
  conversation-message.tsx     — dispatcher: switches on role, renders the right component
  user-message.tsx             — renders role="user" messages
  assistant-message.tsx        — renders role="assistant" with inline tool calls
  result-message.tsx           — renders role="result" (session summary)
  system-message.tsx           — renders role="system" (session started)
  tool-summary-message.tsx     — renders role="tool_summary"
```

### Files to Rewrite

- `web/src/lib/api.ts` — new API client with new endpoints and types
- `web/src/pages/sessions.tsx` — sessions list using `AgentSessionResponse`
- `web/src/pages/session-detail.tsx` — conversation view using `ConversationMessageResponse`
- `web/src/App.tsx` — simplified routes, remove dashboard/system-prompt

### Files to Delete

- `web/src/pages/dashboard.tsx`
- `web/src/pages/system-prompt.tsx`

### Files to Keep (unchanged)

- `web/src/lib/format.ts` — formatting utilities
- `web/src/components/ui/*` — all shadcn/ui components
- `web/vite.config.ts` — Vite config with proxy
- `web/src/index.css` — global styles

## API Client (`web/src/lib/api.ts`)

Three endpoints, all typed:

```ts
import { AgentSessionResponse, ConversationMessageResponse, PaginatedResponse } from "@claude-otel/lib";

export async function getSessions(params?: { limit?: number; offset?: number }): Promise<PaginatedResponse<AgentSessionResponse>>

export async function getSession(id: string): Promise<AgentSessionResponse>

export async function getConversation(id: string, params?: { limit?: number; offset?: number; role?: string }): Promise<PaginatedResponse<ConversationMessageResponse>>
```

## Pages

### Sessions List (`pages/sessions.tsx`)

- Fetches sessions via `getSessions()`, auto-refreshes every 5 seconds
- Card per session, ordered by lastSeenAt (server default)
- Each card shows:
  - Session ID (first 8 chars) as monospace text
  - Model badge (if available)
  - Cost (formatted), turn count, message count
  - Error badge if `isError === true`
  - Relative time (using `formatRelativeTime`)
  - Status badge if session is running
- Click navigates to `/sessions/:id`
- Sessions with `messageCount === 0` shown dimmed (similar to current behavior with empty sessions)
- Loading state while fetching
- Error state for network failures
- Empty state if no sessions

### Session Detail (`pages/session-detail.tsx`)

**Header section:**
- Back arrow link to `/sessions`
- Session ID
- Badges: model, Claude Code version, permission mode, status
- Stats: cost (formatCost), duration (formatDuration), turns, message count

**Conversation body:**
- Fetches conversation via `getConversation(id)` with high limit (1000)
- Renders each `ConversationMessageResponse` using `<ConversationMessage>` dispatcher
- If `hasMore === true`, show a "Load more messages" button or a notice that the conversation is truncated
- Loading state while fetching
- Error state for 404 (session not found) or network errors
- Empty state if no messages

## Conversation Components

### `conversation-message.tsx` (dispatcher)

```tsx
function ConversationMessage({ message }: { message: ConversationMessageResponse }) {
  switch (message.role) {
    case "user": return <UserMessage message={message} />;
    case "assistant": return <AssistantMessage message={message} />;
    case "result": return <ResultMessage message={message} />;
    case "system": return <SystemMessage message={message} />;
    case "tool_summary": return <ToolSummaryMessage message={message} />;
    default: return null;
  }
}
```

### `user-message.tsx`

- Blue left-border card (border-blue-500)
- "User" label in muted text
- `message.userContent` as plain text (whitespace-pre-wrap)

### `assistant-message.tsx`

- Green left-border card (border-green-500)
- "Assistant" label with model badge and stopReason badge (if tool_use)
- `message.textContent` rendered via react-markdown
- If `message.toolCalls` exists (non-null JSON string):
  - Parse JSON into `ToolCallEntry[]` inside a try/catch (fallback: show nothing on parse failure)
  - Render each as a collapsible block: tool name badge, expand to see JSON input
  - Use shadcn Collapsible component

### `result-message.tsx`

- Muted background card (bg-muted/30)
- "Session Complete" or "Session Error" label based on `isError` (treat `null` as unknown/complete)
- Stats row: cost (`costUsd` — this is the session total from the SDK result event), duration (`durationMs`), turns (`numTurns`). Use `formatCost` and `formatDuration` from `lib/format.ts`.
- If `resultText`, show it as muted text

### `system-message.tsx`

- Subtle gray card (bg-muted/20, no border or thin gray border)
- `message.textContent` ("Session started")
- Model badge if available

### `tool-summary-message.tsx`

- Amber left-border card (border-amber-500)
- "Tool Summary" label
- `message.toolSummary` as plain text

## Routing (`App.tsx`)

```tsx
<Routes>
  <Route path="/" element={<Navigate to="/sessions" replace />} />
  <Route path="/sessions" element={<SessionsPage />} />
  <Route path="/sessions/:id" element={<SessionDetailPage />} />
</Routes>
```

Nav bar: single "Sessions" link. Remove Dashboard link.

## Verification

1. `cd web && npm run lint` passes
2. `npm run dev:web` starts without errors
3. Sessions list renders (may be empty if no data ingested)
4. Navigate to a session → conversation renders with role-based components
5. Tool calls in assistant messages are collapsible
6. Result message shows cost/duration/turns
7. Auto-refresh works on sessions list
8. No console errors
