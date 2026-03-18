import express, { Request, Response, RequestHandler } from "express";
import cors from "cors";
import pinoHttp from "pino-http";

import config from "./lib/config";
import { httpLogger } from "./lib/logger";
import { requestIdMiddleware } from "./lib/request-id";
import { errorHandler, notFoundHandler } from "./lib/error-handler";

import otlpRoutes from "./routes/otlp";
import sessionRoutes from "./routes/sessions";
import promptRoutes from "./routes/prompts";
import dashboardRoutes from "./routes/dashboard";
import errorRoutes from "./routes/errors";
import searchRoutes from "./routes/search";
import traceRoutes from "./routes/traces";

const app: express.Application = express();

// Request correlation ID middleware (must be first)
app.use(requestIdMiddleware as RequestHandler);

// Pino HTTP logging middleware
app.use(
  pinoHttp({
    logger: httpLogger,
    autoLogging: {
      ignore: (req) => {
        // Don't log OTLP ingestion requests at info level (too noisy)
        const url = (req as any).url || "";
        return url.startsWith("/v1/");
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

// JSON body parsing for API routes (OTLP routes use express.raw() instead)
app.use("/api", express.json({ limit: "10mb" }));

// Health check
app.get("/health", ((req: Request, res: Response) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    uptime: process.uptime(),
  });
}) as RequestHandler);

// OTLP ingestion routes (at root, not under /api)
app.use(otlpRoutes);

// API routes for frontend
app.use("/api/sessions", sessionRoutes);
app.use("/api/prompts", promptRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/errors", errorRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/traces", traceRoutes);

// 404 handler
app.use(notFoundHandler as RequestHandler);

// Error handler (must be last)
app.use(errorHandler);

export default app;
