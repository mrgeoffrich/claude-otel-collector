import fs from "fs/promises";
import path from "path";
import { appLogger } from "../lib/logger";
import config from "../lib/config";

const DATA_DIR = path.resolve(process.cwd(), "data");
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Delete raw log files older than the configured retention period.
 */
export async function cleanupRawFiles(
  retentionDays: number,
): Promise<{ deleted: number }> {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let deleted = 0;
  const signals: Array<"logs" | "metrics" | "traces"> = [
    "logs",
    "metrics",
    "traces",
  ];

  for (const signal of signals) {
    const dir = path.join(DATA_DIR, "raw", signal);
    try {
      const files = await fs.readdir(dir);
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const filePath = path.join(dir, file);
        const stat = await fs.stat(filePath);
        if (stat.mtimeMs < cutoff) {
          await fs.unlink(filePath);
          deleted++;
        }
      }
    } catch (err: any) {
      if (err.code !== "ENOENT") {
        appLogger.error({ err, signal }, "Error during raw file cleanup");
      }
    }
  }

  return { deleted };
}

/**
 * Start the periodic cleanup scheduler.
 */
export function startCleanupScheduler(): NodeJS.Timeout {
  appLogger.info(
    { retentionDays: config.rawLogRetentionDays },
    "Starting raw file cleanup scheduler",
  );

  // Run immediately on startup
  cleanupRawFiles(config.rawLogRetentionDays).then(({ deleted }) => {
    if (deleted > 0) {
      appLogger.info({ deleted }, "Initial raw file cleanup complete");
    }
  });

  // Then run daily
  return setInterval(async () => {
    const { deleted } = await cleanupRawFiles(config.rawLogRetentionDays);
    if (deleted > 0) {
      appLogger.info({ deleted }, "Scheduled raw file cleanup complete");
    }
  }, CLEANUP_INTERVAL_MS);
}
