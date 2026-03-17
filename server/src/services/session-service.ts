import prisma from "../lib/prisma";
import { ParsedAttributes, getStringAttr } from "../lib/otlp-parser";

/**
 * Upsert a session record. Creates a skeleton if it doesn't exist,
 * updates last_seen_at and optional fields if it does.
 */
export async function upsertSession(
  sessionId: string,
  attrs: ParsedAttributes,
  timestamp: Date,
) {
  const userId = getStringAttr(attrs, "user.account_uuid");
  const orgId = getStringAttr(attrs, "organization.id");
  const model = getStringAttr(attrs, "model");
  const appVersion = getStringAttr(attrs, "app.version");

  await prisma.session.upsert({
    where: { id: sessionId },
    create: {
      id: sessionId,
      userId,
      orgId,
      model,
      appVersion,
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
    },
    update: {
      lastSeenAt: timestamp,
      ...(userId && { userId }),
      ...(orgId && { orgId }),
      ...(model && { model }),
      ...(appVersion && { appVersion }),
    },
  });
}

/**
 * Atomically increment session aggregate counters.
 */
export async function updateSessionAggregates(
  sessionId: string,
  deltas: {
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
    costUsd?: number;
    apiCalls?: number;
    toolCalls?: number;
    errors?: number;
  },
) {
  await prisma.session.update({
    where: { id: sessionId },
    data: {
      ...(deltas.inputTokens && {
        totalInputTokens: { increment: deltas.inputTokens },
      }),
      ...(deltas.outputTokens && {
        totalOutputTokens: { increment: deltas.outputTokens },
      }),
      ...(deltas.cacheReadTokens && {
        totalCacheReadTokens: { increment: deltas.cacheReadTokens },
      }),
      ...(deltas.cacheCreationTokens && {
        totalCacheCreationTokens: { increment: deltas.cacheCreationTokens },
      }),
      ...(deltas.costUsd && {
        totalCostUsd: { increment: deltas.costUsd },
      }),
      ...(deltas.apiCalls && {
        totalApiCalls: { increment: deltas.apiCalls },
      }),
      ...(deltas.toolCalls && {
        totalToolCalls: { increment: deltas.toolCalls },
      }),
      ...(deltas.errors && {
        totalErrors: { increment: deltas.errors },
      }),
    },
  });
}
