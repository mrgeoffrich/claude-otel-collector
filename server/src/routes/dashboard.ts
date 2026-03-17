import { Router, Request, Response, RequestHandler } from "express";
import prisma from "../lib/prisma";

const router = Router();

// GET /api/dashboard/stats — Aggregate stats (default last 24h)
router.get(
  "/stats",
  (async (req: Request, res: Response) => {
    const hours = parseInt(req.query.hours as string) || 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const [sessions, prompts, apiRequests, apiErrors] = await Promise.all([
      prisma.session.count({ where: { lastSeenAt: { gte: since } } }),
      prisma.prompt.count({ where: { timestamp: { gte: since } } }),
      prisma.apiRequest.findMany({
        where: { timestamp: { gte: since } },
        select: {
          inputTokens: true,
          outputTokens: true,
          cacheReadInputTokens: true,
          cacheCreationInputTokens: true,
          costUsd: true,
        },
      }),
      prisma.apiError.count({ where: { timestamp: { gte: since } } }),
    ]);

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCacheReadTokens = 0;
    let totalCacheCreationTokens = 0;
    let totalCostUsd = 0;

    for (const r of apiRequests) {
      totalInputTokens += r.inputTokens || 0;
      totalOutputTokens += r.outputTokens || 0;
      totalCacheReadTokens += r.cacheReadInputTokens || 0;
      totalCacheCreationTokens += r.cacheCreationInputTokens || 0;
      totalCostUsd += r.costUsd || 0;
    }

    const cacheHitRate =
      totalCacheReadTokens + totalInputTokens > 0
        ? totalCacheReadTokens / (totalCacheReadTokens + totalInputTokens)
        : 0;

    const avgCostPerPrompt = prompts > 0 ? totalCostUsd / prompts : 0;

    res.json({
      hours,
      sessions,
      prompts,
      errors: apiErrors,
      totalInputTokens,
      totalOutputTokens,
      totalCacheReadTokens,
      totalCacheCreationTokens,
      totalCostUsd,
      cacheHitRate,
      avgCostPerPrompt,
      totalApiCalls: apiRequests.length,
    });
  }) as RequestHandler,
);

// GET /api/dashboard/token-usage — Time-series token data
router.get(
  "/token-usage",
  (async (req: Request, res: Response) => {
    const hours = parseInt(req.query.hours as string) || 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const apiRequests = await prisma.apiRequest.findMany({
      where: { timestamp: { gte: since } },
      select: {
        timestamp: true,
        inputTokens: true,
        outputTokens: true,
        cacheReadInputTokens: true,
        cacheCreationInputTokens: true,
      },
      orderBy: { timestamp: "asc" },
    });

    // Group by hour
    const buckets = new Map<
      string,
      {
        timestamp: string;
        inputTokens: number;
        outputTokens: number;
        cacheReadTokens: number;
        cacheCreationTokens: number;
      }
    >();

    for (const r of apiRequests) {
      const hourKey = new Date(r.timestamp).toISOString().slice(0, 13) + ":00:00.000Z";
      const existing = buckets.get(hourKey) || {
        timestamp: hourKey,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
      };

      existing.inputTokens += r.inputTokens || 0;
      existing.outputTokens += r.outputTokens || 0;
      existing.cacheReadTokens += r.cacheReadInputTokens || 0;
      existing.cacheCreationTokens += r.cacheCreationInputTokens || 0;
      buckets.set(hourKey, existing);
    }

    res.json(Array.from(buckets.values()));
  }) as RequestHandler,
);

// GET /api/dashboard/cost — Cost analytics
router.get(
  "/cost",
  (async (req: Request, res: Response) => {
    const hours = parseInt(req.query.hours as string) || 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const sessions = await prisma.session.findMany({
      where: { lastSeenAt: { gte: since } },
      select: {
        id: true,
        model: true,
        totalCostUsd: true,
        lastSeenAt: true,
      },
      orderBy: { totalCostUsd: "desc" },
      take: 50,
    });

    // Model distribution
    const modelCounts = new Map<string, { count: number; cost: number }>();
    for (const s of sessions) {
      const model = s.model || "unknown";
      const existing = modelCounts.get(model) || { count: 0, cost: 0 };
      existing.count++;
      existing.cost += s.totalCostUsd;
      modelCounts.set(model, existing);
    }

    res.json({
      sessionCosts: sessions,
      modelDistribution: Object.fromEntries(modelCounts),
    });
  }) as RequestHandler,
);

export default router;
