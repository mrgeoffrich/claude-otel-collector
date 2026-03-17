import { Router, Request, Response, RequestHandler } from "express";
import prisma from "../lib/prisma";

const router = Router();

// GET /api/search/prompts — Search prompts
router.get(
  "/prompts",
  (async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const query = req.query.q as string | undefined;
    const model = req.query.model as string | undefined;
    const minCost = req.query.minCost
      ? parseFloat(req.query.minCost as string)
      : undefined;
    const maxCost = req.query.maxCost
      ? parseFloat(req.query.maxCost as string)
      : undefined;
    const hasErrors = req.query.hasErrors as string | undefined;

    const where: any = {};

    if (query) {
      where.OR = [
        { promptText: { contains: query } },
      ];
    }

    if (model) where.model = model;
    if (minCost !== undefined) {
      where.totalCostUsd = { ...(where.totalCostUsd || {}), gte: minCost };
    }
    if (maxCost !== undefined) {
      where.totalCostUsd = { ...(where.totalCostUsd || {}), lte: maxCost };
    }
    if (hasErrors === "true") {
      where.errorCount = { gt: 0 };
    }

    const [prompts, total] = await Promise.all([
      prisma.prompt.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: limit,
        skip: offset,
        include: {
          session: {
            select: { id: true, model: true },
          },
        },
      }),
      prisma.prompt.count({ where }),
    ]);

    const serialized = prompts.map((p) => ({
      ...p,
      totalInputTokens: Number(p.totalInputTokens),
      totalOutputTokens: Number(p.totalOutputTokens),
      totalCacheReadTokens: Number(p.totalCacheReadTokens),
      totalDurationMs: Number(p.totalDurationMs),
    }));

    res.json({
      data: serialized,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  }) as RequestHandler,
);

export default router;
