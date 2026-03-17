import prisma from "../lib/prisma";
import {
  ParsedAttributes,
  getStringAttr,
  getNumberAttr,
} from "../lib/otlp-parser";

/**
 * Upsert a prompt record. Creates a skeleton if it doesn't exist
 * (handles out-of-order events), fills in details from user_prompt event.
 */
export async function upsertPrompt(
  promptId: string,
  sessionId: string,
  attrs: ParsedAttributes,
  timestamp: Date,
) {
  const promptLength = getNumberAttr(attrs, "prompt_length");
  const promptText = getStringAttr(attrs, "prompt");
  const model = getStringAttr(attrs, "model");

  await prisma.prompt.upsert({
    where: { id: promptId },
    create: {
      id: promptId,
      sessionId,
      timestamp,
      promptLength: promptLength ? Math.floor(promptLength) : null,
      promptText: promptText || null,
      model: model || null,
    },
    update: {
      // Fill in fields that may have been missing from a skeleton
      ...(promptLength && { promptLength: Math.floor(promptLength) }),
      ...(promptText && { promptText }),
      ...(model && { model }),
    },
  });
}

/**
 * Ensure a prompt exists (skeleton) for child events that arrive
 * before the user_prompt event.
 */
export async function ensurePrompt(
  promptId: string,
  sessionId: string,
  timestamp: Date,
) {
  const existing = await prisma.prompt.findUnique({
    where: { id: promptId },
  });
  if (!existing) {
    await prisma.prompt.create({
      data: {
        id: promptId,
        sessionId,
        timestamp,
      },
    });
  }
}

/**
 * Atomically increment prompt aggregate counters.
 */
export async function updatePromptAggregates(
  promptId: string,
  deltas: {
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    costUsd?: number;
    apiCalls?: number;
    toolCalls?: number;
    errors?: number;
    durationMs?: number;
  },
) {
  await prisma.prompt.update({
    where: { id: promptId },
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
      ...(deltas.costUsd && {
        totalCostUsd: { increment: deltas.costUsd },
      }),
      ...(deltas.apiCalls && {
        apiCallCount: { increment: deltas.apiCalls },
      }),
      ...(deltas.toolCalls && {
        toolCallCount: { increment: deltas.toolCalls },
      }),
      ...(deltas.errors && {
        errorCount: { increment: deltas.errors },
      }),
      ...(deltas.durationMs && {
        totalDurationMs: { increment: deltas.durationMs },
      }),
    },
  });
}
