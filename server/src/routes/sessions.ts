import { Router, Request, Response, RequestHandler } from "express";
import prisma from "../lib/prisma";

const router = Router();

// GET /api/sessions — List sessions with aggregates
router.get(
  "/",
  (async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const model = req.query.model as string | undefined;
    const hasErrors = req.query.hasErrors as string | undefined;

    const where: any = {};
    if (model) where.model = model;
    if (hasErrors === "true") where.totalErrors = { gt: 0 };

    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where,
        orderBy: { lastSeenAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.session.count({ where }),
    ]);

    // Convert BigInt to Number for JSON serialization
    const serialized = sessions.map(serializeSession);

    res.json({ data: serialized, total, limit, offset, hasMore: offset + limit < total });
  }) as RequestHandler,
);

// GET /api/sessions/:id — Session detail
router.get(
  "/:id",
  (async (req: Request, res: Response) => {
    const session = await prisma.session.findUnique({
      where: { id: req.params.id as string },
      include: {
        _count: {
          select: { prompts: true },
        },
      },
    });

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.json(serializeSession(session));
  }) as RequestHandler,
);

// GET /api/sessions/:id/prompts — Prompts for a session
router.get(
  "/:id/prompts",
  (async (req: Request, res: Response) => {
    const prompts = await prisma.prompt.findMany({
      where: { sessionId: req.params.id as string },
      orderBy: { timestamp: "asc" },
    });

    res.json(prompts.map(serializePrompt));
  }) as RequestHandler,
);

// GET /api/sessions/:id/traces — Trace spans for a session
router.get(
  "/:id/traces",
  (async (req: Request, res: Response) => {
    const spans = await prisma.traceSpan.findMany({
      where: { sessionId: req.params.id as string },
      orderBy: { startTime: "asc" },
    });

    res.json(spans);
  }) as RequestHandler,
);

function serializeSession(session: any) {
  return {
    ...session,
    totalInputTokens: Number(session.totalInputTokens),
    totalOutputTokens: Number(session.totalOutputTokens),
    totalCacheReadTokens: Number(session.totalCacheReadTokens),
    totalCacheCreationTokens: Number(session.totalCacheCreationTokens),
  };
}

function serializePrompt(prompt: any) {
  return {
    ...prompt,
    totalInputTokens: Number(prompt.totalInputTokens),
    totalOutputTokens: Number(prompt.totalOutputTokens),
    totalCacheReadTokens: Number(prompt.totalCacheReadTokens),
    totalDurationMs: Number(prompt.totalDurationMs),
  };
}

export default router;
