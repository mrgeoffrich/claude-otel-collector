import { Router, Request, Response, RequestHandler } from "express";
import { processMessageEnvelopes } from "../services/agent-message-service";
import { appLogger } from "../lib/logger";

const router = Router();

router.post(
  "/messages",
  (async (req: Request, res: Response) => {
    const envelopes = Array.isArray(req.body) ? req.body : [req.body];

    try {
      await processMessageEnvelopes(envelopes);
    } catch (err) {
      appLogger.error({ err }, "Failed to process message envelopes");
    }

    res.status(200).json({});
  }) as RequestHandler,
);

export default router;
