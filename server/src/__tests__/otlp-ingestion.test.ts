import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import prisma from "../lib/prisma";
import sampleTraces from "./fixtures/sample-traces.json";

describe("OTLP Ingestion", () => {
  beforeEach(async () => {
    await prisma.traceSpan.deleteMany();
    await prisma.session.deleteMany();
    await prisma.metricSnapshot.deleteMany();
  });

  describe("POST /v1/metrics", () => {
    it("should accept and return 200", async () => {
      const res = await request(app)
        .post("/v1/metrics")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({ resourceMetrics: [] }));

      expect(res.status).toBe(200);
    });
  });

  describe("POST /v1/traces", () => {
    it("should accept and return 200 for empty traces", async () => {
      const res = await request(app)
        .post("/v1/traces")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({ resourceSpans: [] }));

      expect(res.status).toBe(200);
    });

    it("should create session and trace span from llm_request span", async () => {
      await request(app)
        .post("/v1/traces")
        .set("Content-Type", "application/json")
        .send(JSON.stringify(sampleTraces));

      const session = await prisma.session.findUnique({
        where: { id: "session-trace-001" },
      });
      expect(session).not.toBeNull();
      expect(session!.model).toBe("claude-sonnet-4-6");

      const span = await prisma.traceSpan.findUnique({
        where: { spanId: "541d2022b61d71c8" },
      });
      expect(span).not.toBeNull();
      expect(span!.traceId).toBe("66c2a909b3ff10c6025a47ae14addd4a");
      expect(span!.sessionId).toBe("session-trace-001");
      expect(span!.spanName).toBe("claude_code.llm_request");
      expect(span!.spanKind).toBe(1);
      expect(span!.model).toBe("claude-sonnet-4-6");
      expect(span!.durationMs).toBe(4656);
      expect(span!.inputTokens).toBe(3);
      expect(span!.outputTokens).toBe(160);
      expect(span!.cacheCreationTokens).toBe(9434);
      expect(span!.success).toBe(true);
      expect(span!.ttftMs).toBe(2114);
      expect(span!.attempt).toBe(1);
    });

    it("should store rich content fields from trace spans", async () => {
      await request(app)
        .post("/v1/traces")
        .set("Content-Type", "application/json")
        .send(JSON.stringify(sampleTraces));

      const span = await prisma.traceSpan.findUnique({
        where: { spanId: "541d2022b61d71c8" },
      });
      expect(span).not.toBeNull();
      expect(span!.querySource).toBe("sdk");
      expect(span!.systemPromptHash).toBe("sp_5751120e97d4");
      expect(span!.systemPromptPreview).toBe("You are an AI operations assistant for Mini Infra.");
      expect(span!.systemPromptLength).toBe(12394);
      expect(span!.toolsCount).toBe(2);
      expect(span!.newContext).toBe("[USER]\nhello I like tacos");
      expect(span!.newContextMessageCount).toBe(1);
      expect(span!.responseModelOutput).toBe("Hello! Tacos are delicious! How can I help you today?");
      expect(span!.responseHasToolCall).toBe(false);
      expect(span!.speed).toBe("normal");
    });

    it("should handle redelivery by upserting on spanId", async () => {
      // Send twice
      await request(app)
        .post("/v1/traces")
        .set("Content-Type", "application/json")
        .send(JSON.stringify(sampleTraces));
      await request(app)
        .post("/v1/traces")
        .set("Content-Type", "application/json")
        .send(JSON.stringify(sampleTraces));

      const spans = await prisma.traceSpan.findMany({
        where: { sessionId: "session-trace-001" },
      });
      expect(spans).toHaveLength(1);
    });

    it("should update session aggregates from trace spans", async () => {
      await request(app)
        .post("/v1/traces")
        .set("Content-Type", "application/json")
        .send(JSON.stringify(sampleTraces));

      const session = await prisma.session.findUnique({
        where: { id: "session-trace-001" },
      });
      expect(session).not.toBeNull();
      expect(Number(session!.totalInputTokens)).toBe(3);
      expect(Number(session!.totalOutputTokens)).toBe(160);
      expect(session!.totalApiCalls).toBe(1);
    });

    it("should not double-count on redelivery", async () => {
      await request(app)
        .post("/v1/traces")
        .set("Content-Type", "application/json")
        .send(JSON.stringify(sampleTraces));
      await request(app)
        .post("/v1/traces")
        .set("Content-Type", "application/json")
        .send(JSON.stringify(sampleTraces));

      const session = await prisma.session.findUnique({
        where: { id: "session-trace-001" },
      });
      // Should only count once despite redelivery
      expect(session!.totalApiCalls).toBe(1);
      expect(Number(session!.totalInputTokens)).toBe(3);
    });
  });
});

describe("API Endpoints", () => {
  beforeEach(async () => {
    await prisma.traceSpan.deleteMany();
    await prisma.session.deleteMany();

    // Seed data via OTLP trace ingestion
    await request(app)
      .post("/v1/traces")
      .set("Content-Type", "application/json")
      .send(JSON.stringify(sampleTraces));
  });

  describe("GET /api/sessions", () => {
    it("should list sessions", async () => {
      const res = await request(app).get("/api/sessions");
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe("session-trace-001");
    });
  });

  describe("GET /api/sessions/:id", () => {
    it("should return session detail", async () => {
      const res = await request(app).get("/api/sessions/session-trace-001");
      expect(res.status).toBe(200);
      expect(res.body.id).toBe("session-trace-001");
      expect(res.body.model).toBe("claude-sonnet-4-6");
    });

    it("should return 404 for unknown session", async () => {
      const res = await request(app).get("/api/sessions/unknown");
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/sessions/:id/traces", () => {
    it("should return trace spans for a session", async () => {
      const res = await request(app).get("/api/sessions/session-trace-001/traces");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].spanName).toBe("claude_code.llm_request");
      expect(res.body[0].responseModelOutput).toBe("Hello! Tacos are delicious! How can I help you today?");
    });

    it("should return empty array for session with no traces", async () => {
      const res = await request(app).get("/api/sessions/nonexistent/traces");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });
  });

  describe("GET /api/traces", () => {
    it("should list trace spans", async () => {
      const res = await request(app).get("/api/traces");
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it("should filter by sessionId", async () => {
      const res = await request(app).get("/api/traces?sessionId=session-trace-001");
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);

      const resEmpty = await request(app).get("/api/traces?sessionId=nonexistent");
      expect(resEmpty.body.data).toHaveLength(0);
    });
  });

  describe("GET /api/traces/:spanId", () => {
    it("should return span detail", async () => {
      const res = await request(app).get("/api/traces/541d2022b61d71c8");
      expect(res.status).toBe(200);
      expect(res.body.spanName).toBe("claude_code.llm_request");
      expect(res.body.ttftMs).toBe(2114);
    });

    it("should return 404 for unknown span", async () => {
      const res = await request(app).get("/api/traces/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/dashboard/stats", () => {
    it("should return aggregate stats from trace spans", async () => {
      const res = await request(app).get("/api/dashboard/stats?hours=100000");
      expect(res.status).toBe(200);
      expect(res.body.totalInputTokens).toBe(3);
      expect(res.body.totalOutputTokens).toBe(160);
      expect(res.body.spans).toBe(1);
      expect(res.body.avgTtftMs).toBe(2114);
    });
  });

  describe("GET /health", () => {
    it("should return healthy status", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("healthy");
    });
  });
});
