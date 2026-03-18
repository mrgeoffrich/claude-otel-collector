import { ExportTraceServiceRequest, Span } from "@claude-otel/lib";
import {
  parseAttributes,
  parseTimestamp,
  getStringAttr,
  getNumberAttr,
  getBoolAttr,
} from "../lib/otlp-parser";
import { upsertSession, updateSessionAggregates } from "./session-service";
import { appLogger } from "../lib/logger";
import prisma from "../lib/prisma";

/**
 * Process traces from an OTLP ExportTraceServiceRequest.
 * Parses spans and stores them in the trace_spans table.
 */
export async function processTraces(
  request: ExportTraceServiceRequest,
): Promise<void> {
  const resourceSpans = request.resourceSpans || [];

  for (const rs of resourceSpans) {
    const scopeSpans = rs.scopeSpans || [];

    for (const ss of scopeSpans) {
      const spans = ss.spans || [];

      for (const span of spans) {
        try {
          await processSpan(span);
        } catch (err) {
          appLogger.error(
            { err, spanName: span.name },
            "Failed to process trace span",
          );
        }
      }
    }
  }
}

async function processSpan(span: Span): Promise<void> {
  const attrs = parseAttributes(span.attributes);
  const sessionId = getStringAttr(attrs, "session.id");

  if (!sessionId) {
    appLogger.debug({ spanName: span.name }, "Trace span missing session.id, skipping");
    return;
  }

  const startTime = parseTimestamp(span.startTimeUnixNano);
  const endTime = span.endTimeUnixNano ? parseTimestamp(span.endTimeUnixNano) : null;

  // Ensure session exists
  await upsertSession(sessionId, attrs, startTime);

  // Check if this span already exists (for redelivery detection)
  const existingSpan = await prisma.traceSpan.findUnique({
    where: { spanId: span.spanId || "" },
    select: { id: true },
  });

  // Upsert by spanId to handle redelivery
  await prisma.traceSpan.upsert({
    where: { spanId: span.spanId || "" },
    create: {
      traceId: span.traceId || "",
      spanId: span.spanId || "",
      parentSpanId: span.parentSpanId || null,
      sessionId,
      spanName: span.name || "unknown",
      spanKind: span.kind ?? null,
      startTime,
      endTime,
      durationMs: getNumberAttr(attrs, "duration_ms")
        ? Math.floor(getNumberAttr(attrs, "duration_ms")!)
        : null,

      // LLM request fields
      model: getStringAttr(attrs, "model"),
      querySource: getStringAttr(attrs, "query_source"),
      inputTokens: getNumberAttr(attrs, "input_tokens")
        ? Math.floor(getNumberAttr(attrs, "input_tokens")!)
        : null,
      outputTokens: getNumberAttr(attrs, "output_tokens")
        ? Math.floor(getNumberAttr(attrs, "output_tokens")!)
        : null,
      cacheReadTokens: getNumberAttr(attrs, "cache_read_tokens")
        ? Math.floor(getNumberAttr(attrs, "cache_read_tokens")!)
        : null,
      cacheCreationTokens: getNumberAttr(attrs, "cache_creation_tokens")
        ? Math.floor(getNumberAttr(attrs, "cache_creation_tokens")!)
        : null,
      success: getBoolAttr(attrs, "success"),
      attempt: getNumberAttr(attrs, "attempt")
        ? Math.floor(getNumberAttr(attrs, "attempt")!)
        : null,
      ttftMs: getNumberAttr(attrs, "ttft_ms")
        ? Math.floor(getNumberAttr(attrs, "ttft_ms")!)
        : null,
      speed: getStringAttr(attrs, "speed"),

      // Rich content
      systemPromptPreview: getStringAttr(attrs, "system_prompt_preview"),
      systemPromptHash: getStringAttr(attrs, "system_prompt_hash"),
      systemPromptLength: getNumberAttr(attrs, "system_prompt_length")
        ? Math.floor(getNumberAttr(attrs, "system_prompt_length")!)
        : null,
      tools: getStringAttr(attrs, "tools"),
      toolsCount: getNumberAttr(attrs, "tools_count")
        ? Math.floor(getNumberAttr(attrs, "tools_count")!)
        : null,
      newContext: getStringAttr(attrs, "new_context"),
      newContextMessageCount: getNumberAttr(attrs, "new_context_message_count")
        ? Math.floor(getNumberAttr(attrs, "new_context_message_count")!)
        : null,
      systemReminders: getStringAttr(attrs, "system_reminders"),
      systemRemindersCount: getNumberAttr(attrs, "system_reminders_count")
        ? Math.floor(getNumberAttr(attrs, "system_reminders_count")!)
        : null,
      responseModelOutput: getStringAttr(attrs, "response.model_output"),
      responseHasToolCall: getBoolAttr(attrs, "response.has_tool_call"),

      attributes: JSON.stringify(attrs),
    },
    update: {
      // On redelivery, update with latest data
      endTime,
      durationMs: getNumberAttr(attrs, "duration_ms")
        ? Math.floor(getNumberAttr(attrs, "duration_ms")!)
        : undefined,
      success: getBoolAttr(attrs, "success") ?? undefined,
      responseModelOutput: getStringAttr(attrs, "response.model_output") ?? undefined,
      responseHasToolCall: getBoolAttr(attrs, "response.has_tool_call") ?? undefined,
      attributes: JSON.stringify(attrs),
    },
  });

  // Update session aggregates only for new spans (not redeliveries)
  if (!existingSpan) {
    const inputTokens = getNumberAttr(attrs, "input_tokens");
    const outputTokens = getNumberAttr(attrs, "output_tokens");
    const cacheReadTokens = getNumberAttr(attrs, "cache_read_tokens");
    const cacheCreationTokens = getNumberAttr(attrs, "cache_creation_tokens");
    const success = getBoolAttr(attrs, "success");

    await updateSessionAggregates(sessionId, {
      inputTokens: inputTokens ? Math.floor(inputTokens) : undefined,
      outputTokens: outputTokens ? Math.floor(outputTokens) : undefined,
      cacheReadTokens: cacheReadTokens ? Math.floor(cacheReadTokens) : undefined,
      cacheCreationTokens: cacheCreationTokens ? Math.floor(cacheCreationTokens) : undefined,
      apiCalls: 1,
      errors: success === false ? 1 : undefined,
    });
  }
}
