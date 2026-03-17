import { Router, Request, Response, RequestHandler } from "express";
import prisma from "../lib/prisma";

const router = Router();

// GET /api/errors — List all errors with filters
router.get(
  "/",
  (async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const errorType = req.query.errorType as string | undefined;
    const statusCode = req.query.statusCode
      ? parseInt(req.query.statusCode as string)
      : undefined;

    // Get API errors
    const apiErrorWhere: any = {};
    if (errorType) apiErrorWhere.errorType = errorType;
    if (statusCode) apiErrorWhere.httpStatusCode = statusCode;

    const [apiErrors, apiErrorCount] = await Promise.all([
      prisma.apiError.findMany({
        where: apiErrorWhere,
        orderBy: { timestamp: "desc" },
        take: limit,
        skip: offset,
        include: {
          prompt: {
            select: {
              id: true,
              sessionId: true,
              promptText: true,
            },
          },
        },
      }),
      prisma.apiError.count({ where: apiErrorWhere }),
    ]);

    // Get failed tool results
    const failedTools = await prisma.toolResult.findMany({
      where: { success: false },
      orderBy: { timestamp: "desc" },
      take: limit,
      include: {
        prompt: {
          select: {
            id: true,
            sessionId: true,
            promptText: true,
          },
        },
      },
    });

    res.json({
      apiErrors: apiErrors.map((e) => ({ ...e, type: "api_error" })),
      failedTools: failedTools.map((e) => ({ ...e, type: "tool_failure" })),
      total: apiErrorCount + failedTools.length,
    });
  }) as RequestHandler,
);

export default router;
