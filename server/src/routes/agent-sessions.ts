import { Router, Request, Response, RequestHandler } from "express";
import prisma from "../lib/prisma";
import { PaginatedResponse, AgentSessionResponse, AgentMessageResponse, ConversationMessageResponse } from "@claude-otel/lib";

const router = Router();

// GET /api/sessions — list sessions
router.get(
  "/",
  (async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    const [sessions, total] = await Promise.all([
      prisma.agentSession.findMany({
        orderBy: { lastSeenAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.agentSession.count(),
    ]);

    const data: AgentSessionResponse[] = sessions.map((s) => ({
      id: s.id,
      firstSeenAt: s.firstSeenAt.toISOString(),
      lastSeenAt: s.lastSeenAt.toISOString(),
      model: s.model,
      claudeCodeVersion: s.claudeCodeVersion,
      permissionMode: s.permissionMode,
      cwd: s.cwd,
      initialPrompt: s.initialPrompt,
      maxBudgetUsd: s.maxBudgetUsd,
      tools: s.tools,
      toolsCount: s.toolsCount,
      messageCount: s.messageCount,
      status: s.status,
      totalCostUsd: s.totalCostUsd,
      durationMs: s.durationMs,
      numTurns: s.numTurns,
      isError: s.isError,
    }));

    const response: PaginatedResponse<AgentSessionResponse> = {
      data,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };

    res.json(response);
  }) as RequestHandler,
);

// GET /api/sessions/:id/conversation — reassembled conversation messages
// NOTE: Sub-routes must come before /:id to avoid Express matching "conversation" as an id
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
      taskId: m.taskId,
      taskStatus: m.taskStatus,
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

// GET /api/sessions/:id/messages — raw messages for a session
router.get(
  "/:id/messages",
  (async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 200, 1000);
    const offset = parseInt(req.query.offset as string) || 0;
    const typeFilter = req.query.type as string | undefined;
    const sessionId = String(req.params.id);

    const where: Record<string, unknown> = { sessionId };
    if (typeFilter) {
      where.type = typeFilter;
    }

    const [messages, total] = await Promise.all([
      prisma.agentMessage.findMany({
        where,
        orderBy: { sequence: "asc" },
        take: limit,
        skip: offset,
      }),
      prisma.agentMessage.count({ where }),
    ]);

    const data: AgentMessageResponse[] = messages.map((m) => ({
      id: m.id,
      sessionId: m.sessionId,
      sequence: m.sequence,
      timestamp: m.timestamp.toISOString(),
      uuid: m.uuid,
      type: m.type,
      subtype: m.subtype,
      rawMessage: m.rawMessage,
      model: m.model,
      parentToolUseId: m.parentToolUseId,
      toolName: m.toolName,
      toolUseId: m.toolUseId,
      contentPreview: m.contentPreview,
      costUsd: m.costUsd,
      durationMs: m.durationMs,
      numTurns: m.numTurns,
      isError: m.isError,
    }));

    const response: PaginatedResponse<AgentMessageResponse> = {
      data,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };

    res.json(response);
  }) as RequestHandler,
);

// GET /api/sessions/:id — session detail (must be last to avoid catching sub-routes)
router.get(
  "/:id",
  (async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const session = await prisma.agentSession.findUnique({
      where: { id },
    });

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const data: AgentSessionResponse = {
      id: session.id,
      firstSeenAt: session.firstSeenAt.toISOString(),
      lastSeenAt: session.lastSeenAt.toISOString(),
      model: session.model,
      claudeCodeVersion: session.claudeCodeVersion,
      permissionMode: session.permissionMode,
      cwd: session.cwd,
      initialPrompt: session.initialPrompt,
      maxBudgetUsd: session.maxBudgetUsd,
      tools: session.tools,
      toolsCount: session.toolsCount,
      messageCount: session.messageCount,
      status: session.status,
      totalCostUsd: session.totalCostUsd,
      durationMs: session.durationMs,
      numTurns: session.numTurns,
      isError: session.isError,
    };

    res.json(data);
  }) as RequestHandler,
);

export default router;
