import { appLogger } from "../lib/logger";
import config from "../lib/config";
import prisma from "../lib/prisma";

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Delete agent sessions and their messages older than the retention period.
 * Messages are cascade-deleted when their session is removed.
 */
export async function cleanupOldSessions(
  retentionDays: number,
): Promise<{ deleted: number }> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const result = await prisma.agentSession.deleteMany({
    where: { lastSeenAt: { lt: cutoff } },
  });

  return { deleted: result.count };
}

/**
 * Start the periodic cleanup scheduler.
 */
export function startCleanupScheduler(): NodeJS.Timeout {
  appLogger.info(
    { retentionDays: config.rawLogRetentionDays },
    "Starting cleanup scheduler",
  );

  // Run immediately on startup
  cleanupOldSessions(config.rawLogRetentionDays).then(({ deleted }) => {
    if (deleted > 0) {
      appLogger.info({ deleted }, "Initial session cleanup complete");
    }
  });

  // Then run daily
  return setInterval(async () => {
    const { deleted } = await cleanupOldSessions(config.rawLogRetentionDays);
    if (deleted > 0) {
      appLogger.info({ deleted }, "Scheduled session cleanup complete");
    }
  }, CLEANUP_INTERVAL_MS);
}
