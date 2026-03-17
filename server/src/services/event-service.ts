import prisma from "../lib/prisma";
import {
  ParsedAttributes,
  getStringAttr,
  getNumberAttr,
  getBoolAttr,
} from "../lib/otlp-parser";

export async function insertApiRequest(
  promptId: string,
  sessionId: string,
  attrs: ParsedAttributes,
  timestamp: Date,
) {
  await prisma.apiRequest.create({
    data: {
      promptId,
      sessionId,
      timestamp,
      model: getStringAttr(attrs, "model"),
      durationMs: getNumberAttr(attrs, "duration_ms")
        ? Math.floor(getNumberAttr(attrs, "duration_ms")!)
        : null,
      costUsd: getNumberAttr(attrs, "cost_usd"),
      inputTokens: getNumberAttr(attrs, "input_tokens")
        ? Math.floor(getNumberAttr(attrs, "input_tokens")!)
        : null,
      outputTokens: getNumberAttr(attrs, "output_tokens")
        ? Math.floor(getNumberAttr(attrs, "output_tokens")!)
        : null,
      cacheReadInputTokens: getNumberAttr(attrs, "cache_read_input_tokens")
        ? Math.floor(getNumberAttr(attrs, "cache_read_input_tokens")!)
        : null,
      cacheCreationInputTokens: getNumberAttr(
        attrs,
        "cache_creation_input_tokens",
      )
        ? Math.floor(getNumberAttr(attrs, "cache_creation_input_tokens")!)
        : null,
      attributes: JSON.stringify(attrs),
    },
  });
}

export async function insertToolResult(
  promptId: string,
  sessionId: string,
  attrs: ParsedAttributes,
  timestamp: Date,
) {
  await prisma.toolResult.create({
    data: {
      promptId,
      sessionId,
      timestamp,
      toolName: getStringAttr(attrs, "tool_name"),
      success: getBoolAttr(attrs, "success"),
      durationMs: getNumberAttr(attrs, "duration_ms")
        ? Math.floor(getNumberAttr(attrs, "duration_ms")!)
        : null,
      error: getStringAttr(attrs, "error"),
      decisionSource: getStringAttr(attrs, "decision_source"),
      toolResultSizeBytes: getNumberAttr(attrs, "tool_result_size_bytes")
        ? Math.floor(getNumberAttr(attrs, "tool_result_size_bytes")!)
        : null,
      toolParameters: getStringAttr(attrs, "tool_parameters"),
      attributes: JSON.stringify(attrs),
    },
  });
}

export async function insertApiError(
  promptId: string,
  sessionId: string,
  attrs: ParsedAttributes,
  timestamp: Date,
) {
  await prisma.apiError.create({
    data: {
      promptId,
      sessionId,
      timestamp,
      errorType: getStringAttr(attrs, "error_type"),
      httpStatusCode: getNumberAttr(attrs, "http_status_code")
        ? Math.floor(getNumberAttr(attrs, "http_status_code")!)
        : null,
      retryAttempt: getNumberAttr(attrs, "retry_attempt")
        ? Math.floor(getNumberAttr(attrs, "retry_attempt")!)
        : null,
      model: getStringAttr(attrs, "model"),
      attributes: JSON.stringify(attrs),
    },
  });
}

export async function insertToolDecision(
  promptId: string,
  sessionId: string,
  attrs: ParsedAttributes,
  timestamp: Date,
) {
  await prisma.toolDecision.create({
    data: {
      promptId,
      sessionId,
      timestamp,
      toolName: getStringAttr(attrs, "tool_name"),
      decision: getStringAttr(attrs, "decision"),
      source: getStringAttr(attrs, "source"),
      attributes: JSON.stringify(attrs),
    },
  });
}
