import { createServer } from "http";
import app from "./app";
import config from "./lib/config";
import { appLogger } from "./lib/logger";
import prisma from "./lib/prisma";
import { startCleanupScheduler } from "./services/cleanup-service";

const startServer = async () => {
  const httpServer = createServer(app);
  let cleanupTimer: NodeJS.Timeout | undefined;

  const server = httpServer.listen(config.port, () => {
    appLogger.info(
      { port: config.port, environment: config.nodeEnv },
      `OTEL Collector server started on port ${config.port}`,
    );

    if (config.nodeEnv === "development") {
      appLogger.info(
        `Health: http://localhost:${config.port}/health`,
      );
      appLogger.info(
        `OTLP endpoint: http://localhost:${config.port}/v1/logs`,
      );
    }
  });

  // Start cleanup scheduler
  cleanupTimer = startCleanupScheduler();

  server.on("error", (error: any) => {
    appLogger.error({ error }, `Failed to start server on port ${config.port}`);
    process.exit(1);
  });

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    appLogger.info(`${signal} received, starting graceful shutdown`);

    if (cleanupTimer) clearInterval(cleanupTimer);

    server.close(async (err) => {
      if (err) {
        appLogger.error({ error: err }, "Error during server shutdown");
        process.exit(1);
      }

      await prisma.$disconnect();
      appLogger.info("Server closed successfully");
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      appLogger.error("Forced shutdown after 10 seconds");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
};

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
