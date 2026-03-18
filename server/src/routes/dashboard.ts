import { Router, Request, Response, RequestHandler } from "express";
import prisma from "../lib/prisma";

const router = Router();

// GET /api/dashboard/stats — Aggregate stats (default last 24h)
router.get(
  "/stats",
  (async (req: Request, res: Response) => {
    const hours = parseInt(req.query.hours as string) || 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const [sessions, spans, failedSpans] = await Promise.all([
      prisma.session.count({ where: { lastSeenAt: { gte: since } } }),
      prisma.traceSpan.findMany({
        where: { startTime: { gte: since } },
        select: {
          inputTokens: true,
          outputTokens: true,
          cacheReadTokens: true,
          cacheCreationTokens: true,
          ttftMs: true,
          durationMs: true,
        },
      }),
      prisma.traceSpan.count({
        where: { startTime: { gte: since }, success: false },
      }),
    ]);

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCacheReadTokens = 0;
    let totalCacheCreationTokens = 0;
    let ttftSum = 0;
    let ttftCount = 0;
    let durationSum = 0;
    let durationCount = 0;

    for (const s of spans) {
      totalInputTokens += s.inputTokens || 0;
      totalOutputTokens += s.outputTokens || 0;
      totalCacheReadTokens += s.cacheReadTokens || 0;
      totalCacheCreationTokens += s.cacheCreationTokens || 0;
      if (s.ttftMs != null) {
        ttftSum += s.ttftMs;
        ttftCount++;
      }
      if (s.durationMs != null) {
        durationSum += s.durationMs;
        durationCount++;
      }
    }

    const cacheHitRate =
      totalCacheReadTokens + totalInputTokens > 0
        ? totalCacheReadTokens / (totalCacheReadTokens + totalInputTokens)
        : 0;

    res.json({
      hours,
      sessions,
      spans: spans.length,
      failedSpans,
      totalInputTokens,
      totalOutputTokens,
      totalCacheReadTokens,
      totalCacheCreationTokens,
      cacheHitRate,
      avgTtftMs: ttftCount > 0 ? Math.round(ttftSum / ttftCount) : null,
      avgDurationMs: durationCount > 0 ? Math.round(durationSum / durationCount) : null,
    });
  }) as RequestHandler,
);

// GET /api/dashboard/token-usage — Time-series token data
router.get(
  "/token-usage",
  (async (req: Request, res: Response) => {
    const hours = parseInt(req.query.hours as string) || 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const spans = await prisma.traceSpan.findMany({
      where: { startTime: { gte: since } },
      select: {
        startTime: true,
        inputTokens: true,
        outputTokens: true,
        cacheReadTokens: true,
        cacheCreationTokens: true,
      },
      orderBy: { startTime: "asc" },
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

    for (const s of spans) {
      const hourKey = new Date(s.startTime).toISOString().slice(0, 13) + ":00:00.000Z";
      const existing = buckets.get(hourKey) || {
        timestamp: hourKey,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
      };

      existing.inputTokens += s.inputTokens || 0;
      existing.outputTokens += s.outputTokens || 0;
      existing.cacheReadTokens += s.cacheReadTokens || 0;
      existing.cacheCreationTokens += s.cacheCreationTokens || 0;
      buckets.set(hourKey, existing);
    }

    res.json(Array.from(buckets.values()));
  }) as RequestHandler,
);

// GET /api/dashboard/cost — Model distribution and session analytics
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
