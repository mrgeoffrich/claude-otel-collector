import { MessageEnvelope } from "@claude-otel/lib";
import prisma from "../lib/prisma";
import { appLogger } from "../lib/logger";
import {
  upsertAgentSession,
  updateSessionFromInit,
  updateSessionFromResult,
  updateSessionStatus,
} from "./agent-session-service";
import { reassembleMessage } from "./reassembly-service";

interface ExtractedMetadata {
  model?: string;
  parentToolUseId?: string;
  toolName?: string;
  toolUseId?: string;
  contentPreview?: string;
  costUsd?: number;
  durationMs?: number;
  numTurns?: number;
  isError?: boolean;
}

/**
 * Process one or more message envelopes from the agent SDK tap.
 */
export async function processMessageEnvelopes(
  envelopes: MessageEnvelope[],
): Promise<void> {
  for (const envelope of envelopes) {
    try {
      await processEnvelope(envelope);
    } catch (err) {
      appLogger.error(
        { err, type: envelope.type, uuid: envelope.uuid },
        "Failed to process message envelope",
      );
    }
  }
}

async function processEnvelope(envelope: MessageEnvelope): Promise<void> {
  const timestamp = new Date(envelope.timestamp);
  const msg = envelope.message as Record<string, unknown>;

  // Upsert session
  await upsertAgentSession(envelope.session_id, timestamp);

  // Extract queryable metadata
  const metadata = extractMetadata(envelope.type, envelope.subtype, msg);

  // Upsert message by uuid for idempotent redelivery
  await prisma.agentMessage.upsert({
    where: { uuid: envelope.uuid },
    create: {
      sessionId: envelope.session_id,
      sequence: envelope.sequence,
      timestamp,
      uuid: envelope.uuid,
      type: envelope.type,
      subtype: envelope.subtype,
      rawMessage: JSON.stringify(envelope.message),
      model: metadata.model ?? null,
      parentToolUseId: metadata.parentToolUseId ?? null,
      toolName: metadata.toolName ?? null,
      toolUseId: metadata.toolUseId ?? null,
      contentPreview: metadata.contentPreview ?? null,
      costUsd: metadata.costUsd ?? null,
      durationMs: metadata.durationMs ?? null,
      numTurns: metadata.numTurns ?? null,
      isError: metadata.isError ?? null,
    },
    update: {
      rawMessage: JSON.stringify(envelope.message),
      model: metadata.model ?? undefined,
      contentPreview: metadata.contentPreview ?? undefined,
      costUsd: metadata.costUsd ?? undefined,
      durationMs: metadata.durationMs ?? undefined,
      isError: metadata.isError ?? undefined,
    },
  });

  // Side effects: update session from special message types
  if (envelope.type === "system" && envelope.subtype === "init") {
    await updateSessionFromInit(envelope.session_id, msg);
  } else if (envelope.type === "result") {
    await updateSessionFromResult(envelope.session_id, msg);
  } else if (
    envelope.type === "system" &&
    envelope.subtype === "session_state_changed"
  ) {
    if (typeof msg.state === "string") {
      await updateSessionStatus(envelope.session_id, msg.state);
    }
  }

  // Reassemble into conversation view (non-blocking)
  try {
    await reassembleMessage(envelope);
  } catch (err) {
    appLogger.error(
      { err, type: envelope.type, uuid: envelope.uuid },
      "Failed to reassemble message into conversation",
    );
  }
}

function extractMetadata(
  type: string,
  subtype: string | null,
  msg: Record<string, unknown>,
): ExtractedMetadata {
  switch (type) {
    case "assistant": {
      const inner = msg.message as Record<string, unknown> | undefined;
      const model = typeof inner?.model === "string" ? inner.model : undefined;
      const parentToolUseId =
        typeof msg.parent_tool_use_id === "string"
          ? msg.parent_tool_use_id
          : undefined;
      const contentPreview = extractAssistantContentPreview(inner);
      return { model, parentToolUseId, contentPreview };
    }

    case "user": {
      const parentToolUseId =
        typeof msg.parent_tool_use_id === "string"
          ? msg.parent_tool_use_id
          : undefined;
      const contentPreview = extractUserContentPreview(msg);
      return { parentToolUseId, contentPreview };
    }

    case "result": {
      const costUsd =
        typeof msg.total_cost_usd === "number" ? msg.total_cost_usd : undefined;
      const durationMs =
        typeof msg.duration_ms === "number"
          ? Math.floor(msg.duration_ms)
          : undefined;
      const numTurns =
        typeof msg.num_turns === "number" ? msg.num_turns : undefined;
      const isError =
        typeof msg.is_error === "boolean" ? msg.is_error : undefined;
      return { costUsd, durationMs, numTurns, isError };
    }

    case "stream_event": {
      const parentToolUseId =
        typeof msg.parent_tool_use_id === "string"
          ? msg.parent_tool_use_id
          : undefined;
      return { parentToolUseId };
    }

    case "tool_progress": {
      const toolName =
        typeof msg.tool_name === "string" ? msg.tool_name : undefined;
      const toolUseId =
        typeof msg.tool_use_id === "string" ? msg.tool_use_id : undefined;
      const parentToolUseId =
        typeof msg.parent_tool_use_id === "string"
          ? msg.parent_tool_use_id
          : undefined;
      return { toolName, toolUseId, parentToolUseId };
    }

    case "tool_use_summary": {
      const contentPreview =
        typeof msg.summary === "string"
          ? msg.summary.slice(0, 200)
          : undefined;
      return { contentPreview };
    }

    case "system": {
      if (subtype === "init") {
        const model =
          typeof msg.model === "string" ? msg.model : undefined;
        return { model };
      }
      return {};
    }

    default:
      return {};
  }
}

/**
 * Extract a text preview from an assistant message's content blocks.
 */
function extractAssistantContentPreview(
  inner: Record<string, unknown> | undefined,
): string | undefined {
  if (!inner) return undefined;
  const content = inner.content;
  if (!Array.isArray(content)) return undefined;

  for (const block of content) {
    if (
      block &&
      typeof block === "object" &&
      block.type === "text" &&
      typeof block.text === "string"
    ) {
      return block.text.slice(0, 200);
    }
  }
  return undefined;
}

/**
 * Extract a text preview from a user message.
 */
function extractUserContentPreview(
  msg: Record<string, unknown>,
): string | undefined {
  const message = msg.message;
  if (!message || typeof message !== "object") return undefined;

  const inner = message as Record<string, unknown>;
  const content = inner.content;

  // content can be a string or array of content blocks
  if (typeof content === "string") {
    return content.slice(0, 200);
  }

  if (Array.isArray(content)) {
    for (const block of content) {
      if (
        block &&
        typeof block === "object" &&
        block.type === "text" &&
        typeof block.text === "string"
      ) {
        return block.text.slice(0, 200);
      }
    }
  }

  return undefined;
}
