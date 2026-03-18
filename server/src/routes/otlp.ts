import { Router, Request, Response, RequestHandler } from "express";
import express from "express";
import { writeRawPayload } from "../services/raw-logger";
import { processMetrics } from "../services/metrics-service";
import { processTraces } from "../services/traces-service";
import { decompressGzip } from "../middleware/gzip";
import { appLogger } from "../lib/logger";

const router = Router();

// Use express.raw() for OTLP routes — we need the raw buffer for disk logging
// and then parse JSON manually.
const rawParser = express.raw({
  type: ["application/json", "application/x-protobuf"],
  limit: "10mb",
});

router.post(
  "/v1/metrics",
  rawParser as RequestHandler,
  decompressGzip as unknown as RequestHandler,
  (async (req: Request, res: Response) => {
    const body = (req as any).rawBody || req.body;
    const bodyStr =
      body instanceof Buffer ? body.toString("utf-8") : String(body);

    writeRawPayload("metrics", bodyStr);

    try {
      const parsed = JSON.parse(bodyStr);
      await processMetrics(parsed);
    } catch (err) {
      appLogger.error({ err }, "Failed to parse/process metrics");
    }

    res.status(200).json({});
  }) as RequestHandler,
);

router.post(
  "/v1/traces",
  rawParser as RequestHandler,
  decompressGzip as unknown as RequestHandler,
  (async (req: Request, res: Response) => {
    const body = (req as any).rawBody || req.body;
    const bodyStr =
      body instanceof Buffer ? body.toString("utf-8") : String(body);

    writeRawPayload("traces", bodyStr);

    try {
      const parsed = JSON.parse(bodyStr);
      await processTraces(parsed);
    } catch (err) {
      appLogger.error({ err }, "Failed to parse/process traces");
    }

    res.status(200).json({});
  }) as RequestHandler,
);

export default router;
