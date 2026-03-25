import prisma from "../lib/prisma";
import { appLogger } from "../lib/logger";

/**
 * Upsert an agent session — create on first message, update lastSeenAt and messageCount on subsequent ones.
 */
export async function upsertAgentSession(
  sessionId: string,
  timestamp: Date,
): Promise<void> {
  await prisma.agentSession.upsert({
    where: { id: sessionId },
    create: {
      id: sessionId,
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
      messageCount: 1,
    },
    update: {
      lastSeenAt: timestamp,
      messageCount: { increment: 1 },
    },
  });
}

/**
 * Update session with data from a system:init message.
 */
export async function updateSessionFromInit(
  sessionId: string,
  initMessage: Record<string, unknown>,
): Promise<void> {
  const tools = Array.isArray(initMessage.tools) ? initMessage.tools : null;

  await prisma.agentSession.update({
    where: { id: sessionId },
    data: {
      model: typeof initMessage.model === "string" ? initMessage.model : undefined,
      claudeCodeVersion:
        typeof initMessage.claude_code_version === "string"
          ? initMessage.claude_code_version
          : undefined,
      permissionMode:
        typeof initMessage.permissionMode === "string"
          ? initMessage.permissionMode
          : undefined,
      tools: tools ? JSON.stringify(tools) : undefined,
      toolsCount: tools ? tools.length : undefined,
    },
  });
}

/**
 * Update session with data from a result message.
 */
export async function updateSessionFromResult(
  sessionId: string,
  resultMessage: Record<string, unknown>,
): Promise<void> {
  await prisma.agentSession.update({
    where: { id: sessionId },
    data: {
      totalCostUsd:
        typeof resultMessage.total_cost_usd === "number"
          ? resultMessage.total_cost_usd
          : undefined,
      durationMs:
        typeof resultMessage.duration_ms === "number"
          ? Math.floor(resultMessage.duration_ms)
          : undefined,
      numTurns:
        typeof resultMessage.num_turns === "number"
          ? resultMessage.num_turns
          : undefined,
      isError:
        typeof resultMessage.is_error === "boolean"
          ? resultMessage.is_error
          : undefined,
    },
  });
}

/**
 * Update session status from a session_state_changed message.
 */
export async function updateSessionStatus(
  sessionId: string,
  status: string,
): Promise<void> {
  await prisma.agentSession.update({
    where: { id: sessionId },
    data: { status },
  });
}
