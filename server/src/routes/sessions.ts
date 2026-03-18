import { Router, Request, Response, RequestHandler } from "express";
import prisma from "../lib/prisma";

const router = Router();

// GET /api/sessions — List sessions with aggregates and first message preview
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
        include: {
          traceSpans: {
            orderBy: { startTime: "asc" },
            select: {
              newContext: true,
              responseModelOutput: true,
              inputTokens: true,
              outputTokens: true,
            },
          },
          _count: { select: { traceSpans: true } },
        },
      }),
      prisma.session.count({ where }),
    ]);

    const serialized = sessions.map((session) => {
      const spans = session.traceSpans;
      const firstSpan = spans[0];
      const spanCount = session._count.traceSpans;

      // Compute token totals from trace spans (more accurate than session aggregates)
      const spanInputTokens = spans.reduce((s, sp) => s + (sp.inputTokens ?? 0), 0);
      const spanOutputTokens = spans.reduce((s, sp) => s + (sp.outputTokens ?? 0), 0);

      const { traceSpans, _count, ...rest } = session;
      const base = serializeSession(rest);

      return {
        ...base,
        // Override token totals with span-derived values when spans exist
        totalInputTokens: spanCount > 0 ? spanInputTokens : base.totalInputTokens,
        totalOutputTokens: spanCount > 0 ? spanOutputTokens : base.totalOutputTokens,
        spanCount,
        firstMessage: firstSpan?.newContext || null,
        firstResponse: firstSpan?.responseModelOutput || null,
      };
    });

    res.json({ data: serialized, total, limit, offset, hasMore: offset + limit < total });
  }) as RequestHandler,
);

// GET /api/sessions/:id — Session detail
router.get(
  "/:id",
  (async (req: Request, res: Response) => {
    const session = await prisma.session.findUnique({
      where: { id: req.params.id as string },
    });

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.json(serializeSession(session));
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

export default router;
