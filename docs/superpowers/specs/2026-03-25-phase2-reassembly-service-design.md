# Phase 2: Reassembly Service Design

## Context

Phase 1 built the raw message ingestion pipeline: `POST /messages` receives `MessageEnvelope` objects from the `@mrgeoffrich/claude-agent-sdk-tap` library and stores them in an `AgentMessage` table with extracted metadata. The raw table stores *every* message type including streaming deltas, tool progress, hooks, and operational noise.

Phase 2 adds a **reassembly layer** that builds a clean, structured conversation view from the raw messages. This sits between raw storage and the frontend, producing data that's ready to render as a chat-like session replay.

## Design Decisions

- **Flat message list** — no turn grouping; the frontend handles visual grouping
- **Processed on ingest** — reassembly happens synchronously during `POST /messages`, so data is always query-ready
- **Conversation messages only** — only `assistant`, `user`, `result`, `tool_use_summary`, and `system:init` are included. All other system subtypes (api_retry, status, hook_*, etc.) are skipped. The `role = "system"` value is used exclusively for `system:init` messages.
- **Structured columns** — assistant text, tool calls, model, stop reason extracted into typed columns
- **New `/conversation` endpoint** — clean separation from the raw `/messages` endpoint
- **Reassembly failures are logged but non-blocking** — errors in reassembly are logged via `appLogger.error()` but do not prevent raw message storage. The raw data is always the source of truth; conversation data can be rebuilt if needed.
- **Sequence ordering** — `sequence` comes from the envelope and is assumed monotonically increasing per session per sink. Secondary sort by `timestamp` is used as a tiebreaker in queries.

## Prisma Schema

### New model: `ConversationMessage`

```prisma
model ConversationMessage {
  id              String   @id @default(cuid())
  sessionId       String
  sequence        Int      // from the source envelope
  timestamp       DateTime
  uuid            String   @unique  // matches the AgentMessage uuid
  role            String   // "user" | "assistant" | "system" | "result" | "tool_summary"

  // User message fields
  userContent     String?  // full text of user message

  // Assistant message fields
  textContent     String?  // concatenated text from all text blocks
  toolCalls       String?  // JSON array of ToolCallEntry (see shared types)
  toolCallCount   Int?
  model           String?
  stopReason      String?  // end_turn, tool_use, max_tokens

  // Result fields
  costUsd         Float?
  durationMs      Int?
  numTurns        Int?
  isError         Boolean?
  resultText      String?  // result string or error messages

  // Tool use summary fields
  toolSummary     String?  // summary text

  // Linking
  parentToolUseId String?  // for tool call chains

  session AgentSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId, sequence])
  @@map("conversation_messages")
}
```

### AgentSession update

Add relation:
```prisma
conversationMessages ConversationMessage[]
```

## Service: `services/reassembly-service.ts`

### `reassembleMessage(envelope: MessageEnvelope): Promise<void>`

Main entry point, called from the ingestion pipeline after raw message storage.

1. Check if `envelope.type` is conversation-relevant (assistant, user, result, tool_use_summary, or system with subtype init). Skip all others.
2. Extract structured fields based on type:
   - **assistant**: concatenate text from `message.message.content` text blocks, serialize tool_use blocks as JSON, extract `model`, `stop_reason` from `message.message`
   - **user**: extract text content from `message.message.content` (string or content blocks)
   - **result**: extract `total_cost_usd`, `duration_ms`, `num_turns`, `is_error`. For success results, `resultText` = `message.result` (string). For error results, `resultText` = `message.errors.join("; ")` (errors is a string array in the SDK).
   - **tool_use_summary**: extract `summary` (stored full-length, no truncation — summaries are already concise)
   - **system:init**: role = "system", `textContent` = `"Session started"`, `model` = model from init message
3. Upsert into `ConversationMessage` by `uuid` for idempotency.

### Integration point

In `agent-message-service.ts` `processEnvelope()`, add a call to `reassembleMessage(envelope)` after the raw message upsert. The reassembly is fire-and-forget in terms of error handling — a failure to reassemble should not block raw message storage.

## API Route

### `GET /api/sessions/:id/conversation`

Added to `routes/agent-sessions.ts`:
- Returns 404 if the session does not exist
- Returns `ConversationMessage` rows ordered by `sequence ASC, timestamp ASC`
- Supports pagination (`limit`, `offset`)
- Supports `?role=` filter (e.g., `?role=assistant`)
- Returns `PaginatedResponse<ConversationMessageResponse>`

## Shared Type

### `ToolCallEntry` (in `lib/src/api-types.ts`)

```ts
export interface ToolCallEntry {
  id: string;       // tool_use block id
  name: string;     // tool name
  input: unknown;   // structured input object
}
```

### `ConversationMessageResponse` (in `lib/src/api-types.ts`)

```ts
export interface ConversationMessageResponse {
  id: string;
  sessionId: string;
  sequence: number;
  timestamp: string;
  uuid: string;
  role: string;
  userContent: string | null;
  textContent: string | null;
  toolCalls: string | null;
  toolCallCount: number | null;
  model: string | null;
  stopReason: string | null;
  costUsd: number | null;
  durationMs: number | null;
  numTurns: number | null;
  isError: boolean | null;
  resultText: string | null;
  toolSummary: string | null;
  parentToolUseId: string | null;
}
```

## Files to Create

- `server/src/services/reassembly-service.ts` — reassembly logic

## Files to Modify

- `server/prisma/schema.prisma` — add `ConversationMessage` model, update `AgentSession` relation
- `server/src/services/agent-message-service.ts` — call `reassembleMessage()` after raw storage
- `server/src/routes/agent-sessions.ts` — add `GET /api/sessions/:id/conversation`
- `lib/src/api-types.ts` — add `ConversationMessageResponse`
- `lib/src/index.ts` — export new type
- `server/src/__tests__/message-ingestion.test.ts` — add reassembly tests

## Verification

1. Migration succeeds: `npx prisma migrate dev --name add-conversation-messages`
2. Server compiles: `npx tsc --noEmit`
3. POST an assistant message → verify both `AgentMessage` and `ConversationMessage` rows created
4. POST a stream_event → verify `AgentMessage` created but NO `ConversationMessage`
5. POST a result message → verify `ConversationMessage` with cost/duration/turns
6. POST a system:init → verify `ConversationMessage` with role "system"
7. `GET /api/sessions/:id/conversation` returns ordered conversation
8. `GET /api/sessions/:id/conversation?role=assistant` filters correctly
9. Idempotent: POST same message twice → one `ConversationMessage` row
10. POST a tool_use_summary → verify ConversationMessage with role "tool_summary" and summary text
11. All existing tests still pass
12. New tests pass
