import { Router, Request, Response, RequestHandler } from "express";
import prisma from "../lib/prisma";

const router = Router();

// GET /api/prompts/:id — Prompt detail
router.get(
  "/:id",
  (async (req: Request, res: Response) => {
    const prompt = await prisma.prompt.findUnique({
      where: { id: req.params.id },
      include: {
        _count: {
          select: {
            apiRequests: true,
            toolResults: true,
            apiErrors: true,
            toolDecisions: true,
          },
        },
      },
    });

    if (!prompt) {
      return res.status(404).json({ error: "Prompt not found" });
    }

    res.json(serializePrompt(prompt));
  }) as RequestHandler,
);

// GET /api/prompts/:id/events — Merged timeline of all child events
router.get(
  "/:id/events",
  (async (req: Request, res: Response) => {
    const promptId = req.params.id;

    const [apiRequests, toolResults, apiErrors, toolDecisions] =
      await Promise.all([
        prisma.apiRequest.findMany({
          where: { promptId },
          orderBy: { timestamp: "asc" },
        }),
        prisma.toolResult.findMany({
          where: { promptId },
          orderBy: { timestamp: "asc" },
        }),
        prisma.apiError.findMany({
          where: { promptId },
          orderBy: { timestamp: "asc" },
        }),
        prisma.toolDecision.findMany({
          where: { promptId },
          orderBy: { timestamp: "asc" },
        }),
      ]);

    // Merge all events into a single timeline sorted by timestamp
    const events = [
      ...apiRequests.map((e) => ({ ...e, type: "api_request" as const })),
      ...toolResults.map((e) => ({ ...e, type: "tool_result" as const })),
      ...apiErrors.map((e) => ({ ...e, type: "api_error" as const })),
      ...toolDecisions.map((e) => ({ ...e, type: "tool_decision" as const })),
    ].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    res.json(events);
  }) as RequestHandler,
);

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
