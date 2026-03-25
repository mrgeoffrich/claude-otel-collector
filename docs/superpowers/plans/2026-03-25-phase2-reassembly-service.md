# Phase 2: Reassembly Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reassembly layer that processes raw agent SDK messages on ingest and writes structured conversation data to a `ConversationMessage` table, with a new API endpoint to serve it.

**Architecture:** On each `POST /messages`, after storing the raw `AgentMessage`, call `reassembleMessage()` which filters for conversation-relevant types (assistant, user, result, tool_use_summary, system:init), extracts structured fields, and upserts into `ConversationMessage`. A new `GET /api/sessions/:id/conversation` endpoint serves the reassembled data.

**Tech Stack:** Prisma (SQLite), Express 5, TypeScript, Vitest + Supertest

**Spec:** `docs/superpowers/specs/2026-03-25-phase2-reassembly-service-design.md`

---

### Task 1: Add shared types

**Files:**
- Modify: `lib/src/api-types.ts`
- Modify: `lib/src/index.ts`

- [ ] **Step 1: Add ToolCallEntry and ConversationMessageResponse to api-types.ts**

Add after the existing `AgentMessageResponse` interface:

```ts
export interface ToolCallEntry {
  id: string;
  name: string;
  input: unknown;
}

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

- [ ] **Step 2: Export new types from index.ts**

Add `ToolCallEntry` and `ConversationMessageResponse` to the export list in `lib/src/index.ts`.

- [ ] **Step 3: Build lib to verify**

Run: `npm run build:lib`
Expected: Success, no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/src/api-types.ts lib/src/index.ts
git commit -m "feat: add ConversationMessage shared types"
```

---

### Task 2: Add Prisma schema and migration

**Files:**
- Modify: `server/prisma/schema.prisma`

- [ ] **Step 1: Add ConversationMessage model to schema.prisma**

Add after the `AgentMessage` model:

```prisma
model ConversationMessage {
  id              String   @id @default(cuid())
  sessionId       String
  sequence        Int
  timestamp       DateTime
  uuid            String   @unique
  role            String

  userContent     String?
  textContent     String?
  toolCalls       String?
  toolCallCount   Int?
  model           String?
  stopReason      String?

  costUsd         Float?
  durationMs      Int?
  numTurns        Int?
  isError         Boolean?
  resultText      String?

  toolSummary     String?

  parentToolUseId String?

  session AgentSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId, sequence])
  @@map("conversation_messages")
}
```

Add to `AgentSession` model:

```prisma
conversationMessages ConversationMessage[]
```

- [ ] **Step 2: Run migration**

This migration only adds a table (no data loss), so it should run non-interactively. If `prisma migrate dev` fails due to non-interactive terminal, use the manual approach:
```bash
cd server
mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_add_conversation_messages
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/*_add_conversation_messages/migration.sql
npx prisma migrate deploy
npx prisma generate
```

Expected: Migration applied, Prisma client regenerated.

- [ ] **Step 5: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations/
git commit -m "feat: add ConversationMessage schema and migration"
```

---

### Task 3: Create reassembly service with tests

**Files:**
- Create: `server/src/services/reassembly-service.ts`
- Modify: `server/src/__tests__/message-ingestion.test.ts`

- [ ] **Step 1: Write failing tests for reassembly**

First, update the `beforeEach` cleanup to also delete conversation messages (before `agentMessage` and `agentSession` deletions):

```ts
beforeEach(async () => {
  await prisma.conversationMessage.deleteMany();
  await prisma.agentMessage.deleteMany();
  await prisma.agentSession.deleteMany();
});
```

Then add these test cases to `server/src/__tests__/message-ingestion.test.ts`:

```ts
describe("Reassembly: ConversationMessage", () => {
  it("should create a ConversationMessage for an assistant message", async () => {
    const envelope = makeEnvelope();
    await request(app).post("/messages").send(envelope).expect(200);

    const conv = await prisma.conversationMessage.findUnique({
      where: { uuid: "msg-001" },
    });
    expect(conv).not.toBeNull();
    expect(conv!.role).toBe("assistant");
    expect(conv!.textContent).toBe("Hello, world!");
    expect(conv!.model).toBe("claude-sonnet-4-20250514");
    expect(conv!.toolCallCount).toBe(0);
  });

  it("should NOT create a ConversationMessage for a stream_event", async () => {
    const envelope = makeEnvelope({
      type: "stream_event",
      uuid: "msg-stream-1",
      message: {
        type: "stream_event",
        event: { type: "content_block_delta" },
        parent_tool_use_id: null,
        uuid: "msg-stream-1",
        session_id: "test-session-1",
      },
    });
    await request(app).post("/messages").send(envelope).expect(200);

    const conv = await prisma.conversationMessage.findUnique({
      where: { uuid: "msg-stream-1" },
    });
    expect(conv).toBeNull();
  });

  it("should create a ConversationMessage for a user message", async () => {
    const envelope = makeEnvelope({
      type: "user",
      uuid: "msg-user-1",
      message: {
        type: "user",
        message: { content: "What is 2+2?" },
        parent_tool_use_id: null,
        session_id: "test-session-1",
      },
    });
    await request(app).post("/messages").send(envelope).expect(200);

    const conv = await prisma.conversationMessage.findUnique({
      where: { uuid: "msg-user-1" },
    });
    expect(conv).not.toBeNull();
    expect(conv!.role).toBe("user");
    expect(conv!.userContent).toBe("What is 2+2?");
  });

  it("should create a ConversationMessage for a result message", async () => {
    const envelope = makeEnvelope({
      type: "result",
      uuid: "msg-result-conv",
      message: {
        type: "result",
        subtype: "success",
        total_cost_usd: 0.05,
        duration_ms: 10000,
        num_turns: 5,
        is_error: false,
        result: "Task completed successfully",
        session_id: "test-session-1",
      },
    });
    await request(app).post("/messages").send(envelope).expect(200);

    const conv = await prisma.conversationMessage.findUnique({
      where: { uuid: "msg-result-conv" },
    });
    expect(conv).not.toBeNull();
    expect(conv!.role).toBe("result");
    expect(conv!.costUsd).toBeCloseTo(0.05);
    expect(conv!.resultText).toBe("Task completed successfully");
    expect(conv!.isError).toBe(false);
  });

  it("should create a ConversationMessage for an error result with joined errors", async () => {
    const envelope = makeEnvelope({
      type: "result",
      uuid: "msg-result-err",
      message: {
        type: "result",
        subtype: "error_during_execution",
        total_cost_usd: 0.01,
        duration_ms: 5000,
        num_turns: 1,
        is_error: true,
        errors: ["Something went wrong", "Connection lost"],
        session_id: "test-session-1",
      },
    });
    await request(app).post("/messages").send(envelope).expect(200);

    const conv = await prisma.conversationMessage.findUnique({
      where: { uuid: "msg-result-err" },
    });
    expect(conv!.isError).toBe(true);
    expect(conv!.resultText).toBe("Something went wrong; Connection lost");
  });

  it("should create a ConversationMessage for system:init", async () => {
    const envelope = makeEnvelope({
      type: "system",
      subtype: "init",
      uuid: "msg-init-conv",
      message: {
        type: "system",
        subtype: "init",
        model: "claude-opus-4-20250514",
        tools: ["Read", "Write"],
        claude_code_version: "1.2.3",
        session_id: "test-session-1",
      },
    });
    await request(app).post("/messages").send(envelope).expect(200);

    const conv = await prisma.conversationMessage.findUnique({
      where: { uuid: "msg-init-conv" },
    });
    expect(conv!.role).toBe("system");
    expect(conv!.textContent).toBe("Session started");
    expect(conv!.model).toBe("claude-opus-4-20250514");
  });

  it("should NOT create a ConversationMessage for system:api_retry", async () => {
    const envelope = makeEnvelope({
      type: "system",
      subtype: "api_retry",
      uuid: "msg-retry-1",
      message: {
        type: "system",
        subtype: "api_retry",
        attempt: 1,
        session_id: "test-session-1",
      },
    });
    await request(app).post("/messages").send(envelope).expect(200);

    const conv = await prisma.conversationMessage.findUnique({
      where: { uuid: "msg-retry-1" },
    });
    expect(conv).toBeNull();
  });

  it("should create a ConversationMessage for tool_use_summary", async () => {
    const envelope = makeEnvelope({
      type: "tool_use_summary",
      uuid: "msg-tus-1",
      message: {
        type: "tool_use_summary",
        summary: "Read 3 files and found the bug in auth.ts",
        preceding_tool_use_ids: ["tu-1", "tu-2"],
        uuid: "msg-tus-1",
        session_id: "test-session-1",
      },
    });
    await request(app).post("/messages").send(envelope).expect(200);

    const conv = await prisma.conversationMessage.findUnique({
      where: { uuid: "msg-tus-1" },
    });
    expect(conv!.role).toBe("tool_summary");
    expect(conv!.toolSummary).toBe("Read 3 files and found the bug in auth.ts");
  });

  it("should extract tool calls from assistant message", async () => {
    const envelope = makeEnvelope({
      uuid: "msg-tools-1",
      message: {
        type: "assistant",
        message: {
          model: "claude-sonnet-4-20250514",
          stop_reason: "tool_use",
          content: [
            { type: "text", text: "Let me read that file." },
            { type: "tool_use", id: "tu-123", name: "Read", input: { file_path: "/foo.ts" } },
          ],
        },
        parent_tool_use_id: null,
        uuid: "msg-tools-1",
        session_id: "test-session-1",
      },
    });
    await request(app).post("/messages").send(envelope).expect(200);

    const conv = await prisma.conversationMessage.findUnique({
      where: { uuid: "msg-tools-1" },
    });
    expect(conv!.textContent).toBe("Let me read that file.");
    expect(conv!.toolCallCount).toBe(1);
    expect(conv!.stopReason).toBe("tool_use");
    const toolCalls = JSON.parse(conv!.toolCalls!);
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0].name).toBe("Read");
    expect(toolCalls[0].id).toBe("tu-123");
  });

  it("should be idempotent for ConversationMessage", async () => {
    const envelope = makeEnvelope();
    await request(app).post("/messages").send(envelope).expect(200);
    await request(app).post("/messages").send(envelope).expect(200);

    const count = await prisma.conversationMessage.count({
      where: { uuid: "msg-001" },
    });
    expect(count).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npm test`
Expected: New tests FAIL (reassembly-service doesn't exist, ConversationMessage not being created).

- [ ] **Step 3: Create reassembly-service.ts**

Create `server/src/services/reassembly-service.ts`:

```ts
import { MessageEnvelope } from "@claude-otel/lib";
import prisma from "../lib/prisma";
import { appLogger } from "../lib/logger";

const CONVERSATION_TYPES = new Set(["assistant", "user", "result", "tool_use_summary"]);

/**
 * Reassemble a message envelope into a ConversationMessage if it's conversation-relevant.
 * Called after raw message storage. Failures are logged but non-blocking.
 */
export async function reassembleMessage(
  envelope: MessageEnvelope,
): Promise<void> {
  // Filter: only conversation-relevant types
  const isSystemInit =
    envelope.type === "system" && envelope.subtype === "init";
  if (!CONVERSATION_TYPES.has(envelope.type) && !isSystemInit) {
    return;
  }

  const msg = envelope.message as Record<string, unknown>;
  const timestamp = new Date(envelope.timestamp);

  const fields = extractConversationFields(envelope.type, envelope.subtype, msg);

  await prisma.conversationMessage.upsert({
    where: { uuid: envelope.uuid },
    create: {
      sessionId: envelope.session_id,
      sequence: envelope.sequence,
      timestamp,
      uuid: envelope.uuid,
      ...fields,
    },
    update: {
      ...fields,
    },
  });
}

interface ConversationFields {
  role: string;
  userContent?: string | null;
  textContent?: string | null;
  toolCalls?: string | null;
  toolCallCount?: number | null;
  model?: string | null;
  stopReason?: string | null;
  costUsd?: number | null;
  durationMs?: number | null;
  numTurns?: number | null;
  isError?: boolean | null;
  resultText?: string | null;
  toolSummary?: string | null;
  parentToolUseId?: string | null;
}

function extractConversationFields(
  type: string,
  subtype: string | null,
  msg: Record<string, unknown>,
): ConversationFields {
  switch (type) {
    case "assistant":
      return extractAssistantFields(msg);
    case "user":
      return extractUserFields(msg);
    case "result":
      return extractResultFields(msg);
    case "tool_use_summary":
      return extractToolSummaryFields(msg);
    case "system":
      if (subtype === "init") return extractSystemInitFields(msg);
      return { role: "system" };
    default:
      return { role: type };
  }
}

function extractAssistantFields(msg: Record<string, unknown>): ConversationFields {
  const inner = msg.message as Record<string, unknown> | undefined;
  const content = inner?.content;
  const parentToolUseId =
    typeof msg.parent_tool_use_id === "string" ? msg.parent_tool_use_id : null;

  let textContent: string | null = null;
  const toolCalls: Array<{ id: string; name: string; input: unknown }> = [];

  if (Array.isArray(content)) {
    const textParts: string[] = [];
    for (const block of content) {
      if (block?.type === "text" && typeof block.text === "string") {
        textParts.push(block.text);
      } else if (block?.type === "tool_use") {
        toolCalls.push({
          id: block.id ?? "",
          name: block.name ?? "",
          input: block.input ?? {},
        });
      }
    }
    if (textParts.length > 0) {
      textContent = textParts.join("\n");
    }
  }

  return {
    role: "assistant",
    textContent,
    toolCalls: toolCalls.length > 0 ? JSON.stringify(toolCalls) : null,
    toolCallCount: toolCalls.length,
    model: typeof inner?.model === "string" ? inner.model : null,
    stopReason: typeof inner?.stop_reason === "string" ? inner.stop_reason : null,
    parentToolUseId,
  };
}

function extractUserFields(msg: Record<string, unknown>): ConversationFields {
  const parentToolUseId =
    typeof msg.parent_tool_use_id === "string" ? msg.parent_tool_use_id : null;

  const message = msg.message as Record<string, unknown> | undefined;
  let userContent: string | null = null;

  if (message) {
    const content = message.content;
    if (typeof content === "string") {
      userContent = content;
    } else if (Array.isArray(content)) {
      const textParts: string[] = [];
      for (const block of content) {
        if (block?.type === "text" && typeof block.text === "string") {
          textParts.push(block.text);
        }
      }
      if (textParts.length > 0) {
        userContent = textParts.join("\n");
      }
    }
  }

  return {
    role: "user",
    userContent,
    parentToolUseId,
  };
}

function extractResultFields(msg: Record<string, unknown>): ConversationFields {
  const costUsd =
    typeof msg.total_cost_usd === "number" ? msg.total_cost_usd : null;
  const durationMs =
    typeof msg.duration_ms === "number" ? Math.floor(msg.duration_ms) : null;
  const numTurns =
    typeof msg.num_turns === "number" ? msg.num_turns : null;
  const isError =
    typeof msg.is_error === "boolean" ? msg.is_error : null;

  let resultText: string | null = null;
  if (typeof msg.result === "string") {
    resultText = msg.result;
  } else if (Array.isArray(msg.errors)) {
    resultText = msg.errors
      .filter((e: unknown) => typeof e === "string")
      .join("; ");
  }

  return {
    role: "result",
    costUsd,
    durationMs,
    numTurns,
    isError,
    resultText,
  };
}

function extractToolSummaryFields(msg: Record<string, unknown>): ConversationFields {
  return {
    role: "tool_summary",
    toolSummary: typeof msg.summary === "string" ? msg.summary : null,
  };
}

function extractSystemInitFields(msg: Record<string, unknown>): ConversationFields {
  return {
    role: "system",
    textContent: "Session started",
    model: typeof msg.model === "string" ? msg.model : null,
  };
}
```

- [ ] **Step 4: Wire reassembly into the ingestion pipeline**

In `server/src/services/agent-message-service.ts`, add import and call after raw message upsert:

Add import at top:
```ts
import { reassembleMessage } from "./reassembly-service";
```

Add at end of `processEnvelope()`, after the session side-effects block:
```ts
  // Reassemble into conversation view (non-blocking)
  try {
    await reassembleMessage(envelope);
  } catch (err) {
    appLogger.error(
      { err, type: envelope.type, uuid: envelope.uuid },
      "Failed to reassemble message into conversation",
    );
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd server && npm test`
Expected: All tests PASS (existing 11 + new reassembly tests).

- [ ] **Step 6: Commit**

```bash
git add server/src/services/reassembly-service.ts server/src/services/agent-message-service.ts server/src/__tests__/message-ingestion.test.ts
git commit -m "feat: add reassembly service for conversation messages"
```

---

### Task 4: Add conversation API endpoint with tests

**Files:**
- Modify: `server/src/routes/agent-sessions.ts`
- Modify: `server/src/__tests__/message-ingestion.test.ts`

- [ ] **Step 1: Write failing tests for the conversation endpoint**

Add to `server/src/__tests__/message-ingestion.test.ts`:

```ts
describe("GET /api/sessions/:id/conversation", () => {
  it("should return conversation messages ordered by sequence", async () => {
    const envelopes = [
      makeEnvelope({ sequence: 1, uuid: "msg-c1", type: "user", message: { type: "user", message: { content: "Hello" }, parent_tool_use_id: null, session_id: "test-session-1" } }),
      makeEnvelope({ sequence: 2, uuid: "msg-c2" }),
      makeEnvelope({ sequence: 3, uuid: "msg-c3", type: "stream_event", message: { type: "stream_event", event: {}, parent_tool_use_id: null, uuid: "msg-c3", session_id: "test-session-1" } }),
    ];
    await request(app).post("/messages").send(envelopes).expect(200);

    const res = await request(app)
      .get("/api/sessions/test-session-1/conversation")
      .expect(200);

    // stream_event should be excluded
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].role).toBe("user");
    expect(res.body.data[1].role).toBe("assistant");
  });

  it("should filter by role", async () => {
    const envelopes = [
      makeEnvelope({ sequence: 1, uuid: "msg-f1", type: "user", message: { type: "user", message: { content: "Hi" }, parent_tool_use_id: null, session_id: "test-session-1" } }),
      makeEnvelope({ sequence: 2, uuid: "msg-f2" }),
    ];
    await request(app).post("/messages").send(envelopes).expect(200);

    const res = await request(app)
      .get("/api/sessions/test-session-1/conversation?role=assistant")
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].role).toBe("assistant");
  });

  it("should return 404 for unknown session", async () => {
    await request(app)
      .get("/api/sessions/nonexistent/conversation")
      .expect(404);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npm test`
Expected: New conversation endpoint tests FAIL (route not defined).

- [ ] **Step 3: Add conversation endpoint to agent-sessions.ts**

Add import of `ConversationMessageResponse` to the import line in `server/src/routes/agent-sessions.ts`:

```ts
import { PaginatedResponse, AgentSessionResponse, AgentMessageResponse, ConversationMessageResponse } from "@claude-otel/lib";
```

Add before `export default router;`:

```ts
// GET /api/sessions/:id/conversation — reassembled conversation messages
router.get(
  "/:id/conversation",
  (async (req: Request, res: Response) => {
    const sessionId = String(req.params.id);

    const session = await prisma.agentSession.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 200, 1000);
    const offset = parseInt(req.query.offset as string) || 0;
    const roleFilter = req.query.role as string | undefined;

    const where: Record<string, unknown> = { sessionId };
    if (roleFilter) {
      where.role = roleFilter;
    }

    const [messages, total] = await Promise.all([
      prisma.conversationMessage.findMany({
        where,
        orderBy: [{ sequence: "asc" }, { timestamp: "asc" }],
        take: limit,
        skip: offset,
      }),
      prisma.conversationMessage.count({ where }),
    ]);

    const data: ConversationMessageResponse[] = messages.map((m) => ({
      id: m.id,
      sessionId: m.sessionId,
      sequence: m.sequence,
      timestamp: m.timestamp.toISOString(),
      uuid: m.uuid,
      role: m.role,
      userContent: m.userContent,
      textContent: m.textContent,
      toolCalls: m.toolCalls,
      toolCallCount: m.toolCallCount,
      model: m.model,
      stopReason: m.stopReason,
      costUsd: m.costUsd,
      durationMs: m.durationMs,
      numTurns: m.numTurns,
      isError: m.isError,
      resultText: m.resultText,
      toolSummary: m.toolSummary,
      parentToolUseId: m.parentToolUseId,
    }));

    const response: PaginatedResponse<ConversationMessageResponse> = {
      data,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };

    res.json(response);
  }) as RequestHandler,
);
```

**IMPORTANT — Route ordering fix:** In `agent-sessions.ts`, the existing `/:id` route (session detail) currently appears BEFORE `/:id/messages`. This is a pre-existing bug — Express matches `/sessions/foo/messages` as `/:id` with `id = "foo"`. When adding the new `/:id/conversation` route, **reorder ALL routes** so the final order in the file is:

1. `GET /` (list sessions)
2. `GET /:id/conversation` (new)
3. `GET /:id/messages` (existing, moved up)
4. `GET /:id` (session detail, moved to last)

This ensures parameterized sub-routes match before the catch-all `/:id`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npm test`
Expected: All tests PASS.

- [ ] **Step 5: Type-check**

Run: `cd server && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/agent-sessions.ts server/src/__tests__/message-ingestion.test.ts
git commit -m "feat: add GET /api/sessions/:id/conversation endpoint"
```

---

### Task 5: Final verification

- [ ] **Step 1: Run full test suite**

Run: `cd server && npm test`
Expected: All tests pass.

- [ ] **Step 2: Type-check entire server**

Run: `cd server && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Manual smoke test**

Start the server: `npm run dev:server`

Post a sequence of messages:
```bash
# system:init
curl -s -X POST http://localhost:4318/messages -H 'Content-Type: application/json' -d '{"sequence":1,"timestamp":"2026-03-25T10:00:00Z","type":"system","subtype":"init","session_id":"smoke-1","uuid":"s1","message":{"type":"system","subtype":"init","model":"claude-sonnet-4-20250514","tools":["Read","Bash"],"claude_code_version":"1.0","permissionMode":"default","session_id":"smoke-1"}}'

# user message
curl -s -X POST http://localhost:4318/messages -H 'Content-Type: application/json' -d '{"sequence":2,"timestamp":"2026-03-25T10:00:01Z","type":"user","subtype":null,"session_id":"smoke-1","uuid":"s2","message":{"type":"user","message":{"content":"Hello Claude"},"parent_tool_use_id":null,"session_id":"smoke-1"}}'

# stream_event (should NOT appear in conversation)
curl -s -X POST http://localhost:4318/messages -H 'Content-Type: application/json' -d '{"sequence":3,"timestamp":"2026-03-25T10:00:02Z","type":"stream_event","subtype":null,"session_id":"smoke-1","uuid":"s3","message":{"type":"stream_event","event":{},"parent_tool_use_id":null,"uuid":"s3","session_id":"smoke-1"}}'

# assistant message
curl -s -X POST http://localhost:4318/messages -H 'Content-Type: application/json' -d '{"sequence":4,"timestamp":"2026-03-25T10:00:03Z","type":"assistant","subtype":null,"session_id":"smoke-1","uuid":"s4","message":{"type":"assistant","message":{"model":"claude-sonnet-4-20250514","stop_reason":"end_turn","content":[{"type":"text","text":"Hello! How can I help?"}]},"parent_tool_use_id":null,"uuid":"s4","session_id":"smoke-1"}}'
```

Verify conversation endpoint:
```bash
curl -s http://localhost:4318/api/sessions/smoke-1/conversation | jq '.data | length'
# Expected: 3 (init, user, assistant — no stream_event)

curl -s http://localhost:4318/api/sessions/smoke-1/conversation | jq '.data[].role'
# Expected: "system", "user", "assistant"
```

Verify raw messages still have all 4:
```bash
curl -s http://localhost:4318/api/sessions/smoke-1/messages | jq '.data | length'
# Expected: 4
```
