import { MessageEnvelope } from "@claude-otel/lib";
import prisma from "../lib/prisma";

const CONVERSATION_TYPES = new Set(["assistant", "user", "result", "tool_use_summary"]);

/**
 * Reassemble a message envelope into a ConversationMessage if it's conversation-relevant.
 * Called after raw message storage. Failures are logged but non-blocking.
 */
export async function reassembleMessage(
  envelope: MessageEnvelope,
): Promise<void> {
  // Filter: only conversation-relevant types
  const isSystemInit =
    envelope.type === "system" && envelope.subtype === "init";
  if (!CONVERSATION_TYPES.has(envelope.type) && !isSystemInit) {
    return;
  }

  const msg = envelope.message as Record<string, unknown>;
  const timestamp = new Date(envelope.timestamp);

  const fields = extractConversationFields(envelope.type, envelope.subtype, msg);

  await prisma.conversationMessage.upsert({
    where: { uuid: envelope.uuid },
    create: {
      sessionId: envelope.session_id,
      sequence: envelope.sequence,
      timestamp,
      uuid: envelope.uuid,
      ...fields,
    },
    update: {
      ...fields,
    },
  });
}

interface ConversationFields {
  role: string;
  userContent?: string | null;
  textContent?: string | null;
  toolCalls?: string | null;
  toolCallCount?: number | null;
  model?: string | null;
  stopReason?: string | null;
  costUsd?: number | null;
  durationMs?: number | null;
  numTurns?: number | null;
  isError?: boolean | null;
  resultText?: string | null;
  toolSummary?: string | null;
  parentToolUseId?: string | null;
}

function extractConversationFields(
  type: string,
  subtype: string | null,
  msg: Record<string, unknown>,
): ConversationFields {
  switch (type) {
    case "assistant":
      return extractAssistantFields(msg);
    case "user":
      return extractUserFields(msg);
    case "result":
      return extractResultFields(msg);
    case "tool_use_summary":
      return extractToolSummaryFields(msg);
    case "system":
      if (subtype === "init") return extractSystemInitFields(msg);
      return { role: "system" };
    default:
      return { role: type };
  }
}

function extractAssistantFields(msg: Record<string, unknown>): ConversationFields {
  const inner = msg.message as Record<string, unknown> | undefined;
  const content = inner?.content;
  const parentToolUseId =
    typeof msg.parent_tool_use_id === "string" ? msg.parent_tool_use_id : null;

  let textContent: string | null = null;
  const toolCalls: Array<{ id: string; name: string; input: unknown }> = [];

  if (Array.isArray(content)) {
    const textParts: string[] = [];
    for (const block of content) {
      if (block?.type === "text" && typeof block.text === "string") {
        textParts.push(block.text);
      } else if (block?.type === "tool_use") {
        toolCalls.push({
          id: block.id ?? "",
          name: block.name ?? "",
          input: block.input ?? {},
        });
      }
    }
    if (textParts.length > 0) {
      textContent = textParts.join("\n");
    }
  }

  return {
    role: "assistant",
    textContent,
    toolCalls: toolCalls.length > 0 ? JSON.stringify(toolCalls) : null,
    toolCallCount: toolCalls.length,
    model: typeof inner?.model === "string" ? inner.model : null,
    stopReason: typeof inner?.stop_reason === "string" ? inner.stop_reason : null,
    parentToolUseId,
  };
}

function extractUserFields(msg: Record<string, unknown>): ConversationFields {
  const parentToolUseId =
    typeof msg.parent_tool_use_id === "string" ? msg.parent_tool_use_id : null;

  const message = msg.message as Record<string, unknown> | undefined;
  let userContent: string | null = null;

  if (message) {
    const content = message.content;
    if (typeof content === "string") {
      userContent = content;
    } else if (Array.isArray(content)) {
      const textParts: string[] = [];
      for (const block of content) {
        if (block?.type === "text" && typeof block.text === "string") {
          textParts.push(block.text);
        }
      }
      if (textParts.length > 0) {
        userContent = textParts.join("\n");
      }
    }
  }

  return {
    role: "user",
    userContent,
    parentToolUseId,
  };
}

function extractResultFields(msg: Record<string, unknown>): ConversationFields {
  const costUsd =
    typeof msg.total_cost_usd === "number" ? msg.total_cost_usd : null;
  const durationMs =
    typeof msg.duration_ms === "number" ? Math.floor(msg.duration_ms) : null;
  const numTurns =
    typeof msg.num_turns === "number" ? msg.num_turns : null;
  const isError =
    typeof msg.is_error === "boolean" ? msg.is_error : null;

  let resultText: string | null = null;
  if (typeof msg.result === "string") {
    resultText = msg.result;
  } else if (Array.isArray(msg.errors)) {
    resultText = msg.errors
      .filter((e: unknown) => typeof e === "string")
      .join("; ");
  }

  return {
    role: "result",
    costUsd,
    durationMs,
    numTurns,
    isError,
    resultText,
  };
}

function extractToolSummaryFields(msg: Record<string, unknown>): ConversationFields {
  return {
    role: "tool_summary",
    toolSummary: typeof msg.summary === "string" ? msg.summary : null,
  };
}

function extractSystemInitFields(msg: Record<string, unknown>): ConversationFields {
  return {
    role: "system",
    textContent: "Session started",
    model: typeof msg.model === "string" ? msg.model : null,
  };
}
