import express, { Request, Response, RequestHandler } from "express";
import cors from "cors";
import pinoHttp from "pino-http";

import config from "./lib/config";
import { httpLogger } from "./lib/logger";
import { requestIdMiddleware } from "./lib/request-id";
import { errorHandler, notFoundHandler } from "./lib/error-handler";

import messagesRoutes from "./routes/messages";
import agentSessionRoutes from "./routes/agent-sessions";

const app: express.Application = express();

// Request correlation ID middleware (must be first)
app.use(requestIdMiddleware as RequestHandler);

// Pino HTTP logging middleware
app.use(
  pinoHttp({
    logger: httpLogger,
    autoLogging: {
      ignore: (req) => {
        // Don't log message ingestion requests at info level (too noisy)
        const url = (req as any).url || "";
        return url.startsWith("/messages");
      },
    },
  }),
);

// CORS
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  }),
);

// JSON body parsing for API routes and message ingestion
app.use("/api", express.json({ limit: "10mb" }));
app.use("/messages", express.json({ limit: "10mb" }));

// Health check
app.get("/health", ((req: Request, res: Response) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    uptime: process.uptime(),
  });
}) as RequestHandler);

// Message ingestion route (from agent SDK tap)
app.use(messagesRoutes);

// API routes for frontend
app.use("/api/sessions", agentSessionRoutes);

// 404 handler
app.use(notFoundHandler as RequestHandler);

// Error handler (must be last)
app.use(errorHandler);

export default app;
