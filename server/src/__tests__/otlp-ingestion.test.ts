import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import prisma from "../lib/prisma";
import sampleLogs from "./fixtures/sample-logs.json";

describe("OTLP Ingestion", () => {
  beforeEach(async () => {
    // Clear all tables before each test
    await prisma.toolDecision.deleteMany();
    await prisma.apiError.deleteMany();
    await prisma.toolResult.deleteMany();
    await prisma.apiRequest.deleteMany();
    await prisma.prompt.deleteMany();
    await prisma.session.deleteMany();
    await prisma.metricSnapshot.deleteMany();
  });

  describe("POST /v1/logs", () => {
    it("should accept and return 200 for valid OTLP logs payload", async () => {
      const res = await request(app)
        .post("/v1/logs")
        .set("Content-Type", "application/json")
        .send(JSON.stringify(sampleLogs));

      expect(res.status).toBe(200);
      expect(res.body).toEqual({});
    });

    it("should create session and prompt from user_prompt event", async () => {
      await request(app)
        .post("/v1/logs")
        .set("Content-Type", "application/json")
        .send(JSON.stringify(sampleLogs));

      const session = await prisma.session.findUnique({
        where: { id: "session-001" },
      });
      expect(session).not.toBeNull();
      expect(session!.userId).toBe("user-123");
      expect(session!.orgId).toBe("org-456");
      expect(session!.model).toBe("claude-sonnet-4-6");

      const prompt = await prisma.prompt.findUnique({
        where: { id: "prompt-001" },
      });
      expect(prompt).not.toBeNull();
      expect(prompt!.sessionId).toBe("session-001");
      expect(prompt!.promptText).toBe("What files are in this directory?");
      expect(prompt!.promptLength).toBe(42);
    });

    it("should create api_request and update aggregates", async () => {
      await request(app)
        .post("/v1/logs")
        .set("Content-Type", "application/json")
        .send(JSON.stringify(sampleLogs));

      const apiRequests = await prisma.apiRequest.findMany({
        where: { promptId: "prompt-001" },
      });
      expect(apiRequests).toHaveLength(1);
      expect(apiRequests[0].inputTokens).toBe(890);
      expect(apiRequests[0].outputTokens).toBe(350);
      expect(apiRequests[0].costUsd).toBeCloseTo(0.0134);

      // Check prompt aggregates
      const prompt = await prisma.prompt.findUnique({
        where: { id: "prompt-001" },
      });
      expect(Number(prompt!.totalInputTokens)).toBe(890);
      expect(prompt!.apiCallCount).toBe(1);
    });

    it("should create tool_result records", async () => {
      await request(app)
        .post("/v1/logs")
        .set("Content-Type", "application/json")
        .send(JSON.stringify(sampleLogs));

      const toolResults = await prisma.toolResult.findMany({
        where: { promptId: "prompt-001" },
      });
      expect(toolResults).toHaveLength(1);
      expect(toolResults[0].toolName).toBe("Bash");
      expect(toolResults[0].success).toBe(true);
      expect(toolResults[0].durationMs).toBe(230);
    });

    it("should create api_error records", async () => {
      await request(app)
        .post("/v1/logs")
        .set("Content-Type", "application/json")
        .send(JSON.stringify(sampleLogs));

      const apiErrors = await prisma.apiError.findMany({
        where: { promptId: "prompt-001" },
      });
      expect(apiErrors).toHaveLength(1);
      expect(apiErrors[0].errorType).toBe("rate_limit");
      expect(apiErrors[0].httpStatusCode).toBe(429);
    });

    it("should create tool_decision records", async () => {
      await request(app)
        .post("/v1/logs")
        .set("Content-Type", "application/json")
        .send(JSON.stringify(sampleLogs));

      const decisions = await prisma.toolDecision.findMany({
        where: { promptId: "prompt-001" },
      });
      expect(decisions).toHaveLength(1);
      expect(decisions[0].toolName).toBe("Bash");
      expect(decisions[0].decision).toBe("accept");
    });

    it("should accept empty resourceLogs", async () => {
      const res = await request(app)
        .post("/v1/logs")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({ resourceLogs: [] }));

      expect(res.status).toBe(200);
    });
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
    it("should accept and return 200", async () => {
      const res = await request(app)
        .post("/v1/traces")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({ resourceSpans: [] }));

      expect(res.status).toBe(200);
    });
  });
});

describe("API Endpoints", () => {
  beforeEach(async () => {
    await prisma.toolDecision.deleteMany();
    await prisma.apiError.deleteMany();
    await prisma.toolResult.deleteMany();
    await prisma.apiRequest.deleteMany();
    await prisma.prompt.deleteMany();
    await prisma.session.deleteMany();

    // Seed data via OTLP ingestion
    await request(app)
      .post("/v1/logs")
      .set("Content-Type", "application/json")
      .send(JSON.stringify(sampleLogs));
  });

  describe("GET /api/sessions", () => {
    it("should list sessions", async () => {
      const res = await request(app).get("/api/sessions");
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe("session-001");
    });
  });

  describe("GET /api/sessions/:id", () => {
    it("should return session detail", async () => {
      const res = await request(app).get("/api/sessions/session-001");
      expect(res.status).toBe(200);
      expect(res.body.id).toBe("session-001");
      expect(res.body.model).toBe("claude-sonnet-4-6");
    });

    it("should return 404 for unknown session", async () => {
      const res = await request(app).get("/api/sessions/unknown");
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/sessions/:id/prompts", () => {
    it("should return prompts for session", async () => {
      const res = await request(app).get("/api/sessions/session-001/prompts");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe("prompt-001");
    });
  });

  describe("GET /api/prompts/:id/events", () => {
    it("should return merged event timeline", async () => {
      const res = await request(app).get("/api/prompts/prompt-001/events");
      expect(res.status).toBe(200);
      // Should have: 1 api_request, 1 tool_result, 1 api_error, 1 tool_decision
      expect(res.body).toHaveLength(4);
      const types = res.body.map((e: any) => e.type);
      expect(types).toContain("api_request");
      expect(types).toContain("tool_result");
      expect(types).toContain("api_error");
      expect(types).toContain("tool_decision");
    });
  });

  describe("GET /api/dashboard/stats", () => {
    it("should return aggregate stats", async () => {
      // Use a large time window since fixture timestamps are from 2023
      const res = await request(app).get("/api/dashboard/stats?hours=100000");
      expect(res.status).toBe(200);
      expect(res.body.totalInputTokens).toBe(890);
      expect(res.body.totalOutputTokens).toBe(350);
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
