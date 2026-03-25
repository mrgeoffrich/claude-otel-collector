import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import prisma from "../lib/prisma";

// Clean up before each test
beforeEach(async () => {
  await prisma.conversationMessage.deleteMany();
  await prisma.agentMessage.deleteMany();
  await prisma.agentSession.deleteMany();
});

function makeEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    sequence: 1,
    timestamp: "2026-03-25T10:00:00.000Z",
    type: "assistant",
    subtype: null,
    session_id: "test-session-1",
    uuid: "msg-001",
    message: {
      type: "assistant",
      message: {
        model: "claude-sonnet-4-20250514",
        content: [{ type: "text", text: "Hello, world!" }],
      },
      parent_tool_use_id: null,
      uuid: "msg-001",
      session_id: "test-session-1",
    },
    ...overrides,
  };
}

describe("POST /messages", () => {
  it("should accept a single message envelope and create session + message", async () => {
    const envelope = makeEnvelope();

    const res = await request(app)
      .post("/messages")
      .send(envelope)
      .expect(200);

    expect(res.body).toEqual({});

    // Verify session was created
    const session = await prisma.agentSession.findUnique({
      where: { id: "test-session-1" },
    });
    expect(session).not.toBeNull();
    expect(session!.messageCount).toBe(1);

    // Verify message was stored
    const message = await prisma.agentMessage.findUnique({
      where: { uuid: "msg-001" },
    });
    expect(message).not.toBeNull();
    expect(message!.type).toBe("assistant");
    expect(message!.model).toBe("claude-sonnet-4-20250514");
    expect(message!.contentPreview).toBe("Hello, world!");
    expect(message!.sequence).toBe(1);
  });

  it("should accept a batched array of envelopes", async () => {
    const envelopes = [
      makeEnvelope({ sequence: 1, uuid: "msg-001" }),
      makeEnvelope({
        sequence: 2,
        uuid: "msg-002",
        type: "user",
        message: {
          type: "user",
          message: { content: "What is 2+2?" },
          parent_tool_use_id: null,
          session_id: "test-session-1",
        },
      }),
    ];

    await request(app).post("/messages").send(envelopes).expect(200);

    const count = await prisma.agentMessage.count({
      where: { sessionId: "test-session-1" },
    });
    expect(count).toBe(2);

    const session = await prisma.agentSession.findUnique({
      where: { id: "test-session-1" },
    });
    expect(session!.messageCount).toBe(2);
  });

  it("should handle idempotent redelivery (same uuid)", async () => {
    const envelope = makeEnvelope();

    await request(app).post("/messages").send(envelope).expect(200);
    await request(app).post("/messages").send(envelope).expect(200);

    const count = await prisma.agentMessage.count({
      where: { uuid: "msg-001" },
    });
    expect(count).toBe(1);
  });

  it("should extract metadata from a result message", async () => {
    const envelope = makeEnvelope({
      type: "result",
      subtype: "success",
      uuid: "msg-result-1",
      message: {
        type: "result",
        subtype: "success",
        total_cost_usd: 0.0234,
        duration_ms: 15000,
        num_turns: 3,
        is_error: false,
        session_id: "test-session-1",
      },
    });

    await request(app).post("/messages").send(envelope).expect(200);

    const message = await prisma.agentMessage.findUnique({
      where: { uuid: "msg-result-1" },
    });
    expect(message!.costUsd).toBeCloseTo(0.0234);
    expect(message!.durationMs).toBe(15000);
    expect(message!.numTurns).toBe(3);
    expect(message!.isError).toBe(false);

    // Session should also be updated
    const session = await prisma.agentSession.findUnique({
      where: { id: "test-session-1" },
    });
    expect(session!.totalCostUsd).toBeCloseTo(0.0234);
    expect(session!.durationMs).toBe(15000);
    expect(session!.numTurns).toBe(3);
    expect(session!.isError).toBe(false);
  });

  it("should update session from system:init message", async () => {
    const envelope = makeEnvelope({
      type: "system",
      subtype: "init",
      uuid: "msg-init-1",
      message: {
        type: "system",
        subtype: "init",
        model: "claude-opus-4-20250514",
        claude_code_version: "1.2.3",
        permissionMode: "default",
        tools: ["Read", "Write", "Bash"],
        session_id: "test-session-1",
      },
    });

    await request(app).post("/messages").send(envelope).expect(200);

    const session = await prisma.agentSession.findUnique({
      where: { id: "test-session-1" },
    });
    expect(session!.model).toBe("claude-opus-4-20250514");
    expect(session!.claudeCodeVersion).toBe("1.2.3");
    expect(session!.permissionMode).toBe("default");
    expect(session!.toolsCount).toBe(3);
  });

  it("should extract tool_progress metadata", async () => {
    const envelope = makeEnvelope({
      type: "tool_progress",
      uuid: "msg-tp-1",
      message: {
        type: "tool_progress",
        tool_use_id: "tooluse_abc",
        tool_name: "Bash",
        parent_tool_use_id: null,
        elapsed_time_seconds: 5,
        session_id: "test-session-1",
      },
    });

    await request(app).post("/messages").send(envelope).expect(200);

    const message = await prisma.agentMessage.findUnique({
      where: { uuid: "msg-tp-1" },
    });
    expect(message!.toolName).toBe("Bash");
    expect(message!.toolUseId).toBe("tooluse_abc");
  });
});

describe("GET /api/sessions", () => {
  it("should return paginated sessions", async () => {
    // Create a session via message ingestion
    await request(app)
      .post("/messages")
      .send(makeEnvelope())
      .expect(200);

    const res = await request(app).get("/api/sessions").expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].id).toBe("test-session-1");
    expect(res.body.hasMore).toBe(false);
  });
});

describe("GET /api/sessions/:id", () => {
  it("should return session detail", async () => {
    await request(app)
      .post("/messages")
      .send(makeEnvelope())
      .expect(200);

    const res = await request(app)
      .get("/api/sessions/test-session-1")
      .expect(200);

    expect(res.body.id).toBe("test-session-1");
    expect(res.body.messageCount).toBe(1);
  });

  it("should return 404 for unknown session", async () => {
    await request(app).get("/api/sessions/nonexistent").expect(404);
  });
});

describe("GET /api/sessions/:id/messages", () => {
  it("should return messages ordered by sequence", async () => {
    const envelopes = [
      makeEnvelope({ sequence: 1, uuid: "msg-001" }),
      makeEnvelope({ sequence: 2, uuid: "msg-002", type: "user", message: { type: "user", message: { content: "Hi" }, parent_tool_use_id: null, session_id: "test-session-1" } }),
      makeEnvelope({ sequence: 3, uuid: "msg-003" }),
    ];

    await request(app).post("/messages").send(envelopes).expect(200);

    const res = await request(app)
      .get("/api/sessions/test-session-1/messages")
      .expect(200);

    expect(res.body.data).toHaveLength(3);
    expect(res.body.data[0].sequence).toBe(1);
    expect(res.body.data[1].sequence).toBe(2);
    expect(res.body.data[2].sequence).toBe(3);
  });

  it("should filter by type", async () => {
    const envelopes = [
      makeEnvelope({ sequence: 1, uuid: "msg-001", type: "assistant" }),
      makeEnvelope({ sequence: 2, uuid: "msg-002", type: "user", message: { type: "user", message: { content: "Hi" }, parent_tool_use_id: null, session_id: "test-session-1" } }),
    ];

    await request(app).post("/messages").send(envelopes).expect(200);

    const res = await request(app)
      .get("/api/sessions/test-session-1/messages?type=user")
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].type).toBe("user");
  });
});

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

describe("tap:query_params handling", () => {
  it("should store query params on the session", async () => {
    const envelope = makeEnvelope({
      sequence: 0,
      uuid: "msg-qp-001",
      type: "tap:query_params",
      subtype: null,
      message: {
        type: "tap:query_params",
        prompt: "Fix the login bug",
        model: "claude-sonnet-4-20250514",
        cwd: "/Users/dev/my-project",
        permissionMode: "default",
        maxBudgetUsd: 5.0,
        timestamp: "2026-03-25T10:00:00.000Z",
      },
    });

    await request(app).post("/messages").send(envelope).expect(200);

    const session = await prisma.agentSession.findUnique({
      where: { id: "test-session-1" },
    });
    expect(session).not.toBeNull();
    expect(session!.cwd).toBe("/Users/dev/my-project");
    expect(session!.initialPrompt).toBe("Fix the login bug");
    expect(session!.maxBudgetUsd).toBe(5.0);
    expect(session!.model).toBe("claude-sonnet-4-20250514");
    expect(session!.permissionMode).toBe("default");
  });

  it("should store message with extracted metadata", async () => {
    const envelope = makeEnvelope({
      sequence: 0,
      uuid: "msg-qp-002",
      type: "tap:query_params",
      subtype: null,
      message: {
        type: "tap:query_params",
        prompt: "Refactor the database layer to use connection pooling",
        model: "claude-opus-4-20250514",
        cwd: "/Users/dev/project",
        timestamp: "2026-03-25T10:00:00.000Z",
      },
    });

    await request(app).post("/messages").send(envelope).expect(200);

    const message = await prisma.agentMessage.findUnique({
      where: { uuid: "msg-qp-002" },
    });
    expect(message).not.toBeNull();
    expect(message!.type).toBe("tap:query_params");
    expect(message!.model).toBe("claude-opus-4-20250514");
    expect(message!.contentPreview).toBe(
      "Refactor the database layer to use connection pooling",
    );
  });

  it("should truncate long prompts in initialPrompt and contentPreview", async () => {
    const longPrompt = "x".repeat(1000);
    const envelope = makeEnvelope({
      sequence: 0,
      uuid: "msg-qp-003",
      type: "tap:query_params",
      subtype: null,
      message: {
        type: "tap:query_params",
        prompt: longPrompt,
        cwd: "/tmp",
        timestamp: "2026-03-25T10:00:00.000Z",
      },
    });

    await request(app).post("/messages").send(envelope).expect(200);

    const session = await prisma.agentSession.findUnique({
      where: { id: "test-session-1" },
    });
    expect(session!.initialPrompt).toHaveLength(500);

    const message = await prisma.agentMessage.findUnique({
      where: { uuid: "msg-qp-003" },
    });
    expect(message!.contentPreview).toHaveLength(200);
  });
});
