import { Router, Request, Response, RequestHandler } from "express";
import prisma from "../lib/prisma";

const router = Router();

// GET /api/traces — List trace spans with optional filters
router.get(
  "/",
  (async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const sessionId = req.query.sessionId as string | undefined;
    const model = req.query.model as string | undefined;

    const where: any = {};
    if (sessionId) where.sessionId = sessionId;
    if (model) where.model = model;

    const [spans, total] = await Promise.all([
      prisma.traceSpan.findMany({
        where,
        orderBy: { startTime: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.traceSpan.count({ where }),
    ]);

    res.json({ data: spans, total, limit, offset, hasMore: offset + limit < total });
  }) as RequestHandler,
);

// GET /api/traces/:spanId — Single trace span detail
router.get(
  "/:spanId",
  (async (req: Request, res: Response) => {
    const span = await prisma.traceSpan.findUnique({
      where: { spanId: req.params.spanId as string },
    });

    if (!span) {
      return res.status(404).json({ error: "Trace span not found" });
    }

    res.json(span);
  }) as RequestHandler,
);

export default router;
