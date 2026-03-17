import {
  ExportLogsServiceRequest,
  LogRecord,
} from "../lib/otlp-types";
import {
  parseAttributes,
  parseTimestamp,
  extractBody,
  getStringAttr,
  getNumberAttr,
} from "../lib/otlp-parser";
import { upsertSession, updateSessionAggregates } from "./session-service";
import { upsertPrompt, ensurePrompt, updatePromptAggregates } from "./prompt-service";
import {
  insertApiRequest,
  insertToolResult,
  insertApiError,
  insertToolDecision,
} from "./event-service";
import { appLogger } from "../lib/logger";

/**
 * Route all log records from an OTLP ExportLogsServiceRequest
 * to the appropriate database tables.
 */
export async function routeLogRecords(
  request: ExportLogsServiceRequest,
): Promise<void> {
  const resourceLogs = request.resourceLogs || [];

  for (const rl of resourceLogs) {
    const scopeLogs = rl.scopeLogs || [];

    for (const sl of scopeLogs) {
      const logRecords = sl.logRecords || [];

      for (const record of logRecords) {
        try {
          await routeLogRecord(record);
        } catch (err) {
          appLogger.error(
            { err, record: JSON.stringify(record).slice(0, 500) },
            "Failed to route log record",
          );
        }
      }
    }
  }
}

async function routeLogRecord(record: LogRecord): Promise<void> {
  const eventName = extractBody(record);
  const attrs = parseAttributes(record.attributes);
  const timestamp = parseTimestamp(record.timeUnixNano);
  const promptId = getStringAttr(attrs, "prompt.id");
  const sessionId = getStringAttr(attrs, "session.id");

  if (!sessionId) {
    appLogger.debug({ eventName }, "Log record missing session.id, skipping");
    return;
  }

  // Ensure session exists
  await upsertSession(sessionId, attrs, timestamp);

  switch (eventName) {
    case "claude_code.user_prompt": {
      if (!promptId) return;
      await upsertPrompt(promptId, sessionId, attrs, timestamp);
      break;
    }

    case "claude_code.api_request": {
      if (!promptId) return;
      await ensurePrompt(promptId, sessionId, timestamp);
      await insertApiRequest(promptId, sessionId, attrs, timestamp);

      const inputTokens = getNumberAttr(attrs, "input_tokens") || 0;
      const outputTokens = getNumberAttr(attrs, "output_tokens") || 0;
      const cacheReadTokens =
        getNumberAttr(attrs, "cache_read_input_tokens") || 0;
      const cacheCreationTokens =
        getNumberAttr(attrs, "cache_creation_input_tokens") || 0;
      const costUsd = getNumberAttr(attrs, "cost_usd") || 0;
      const durationMs = getNumberAttr(attrs, "duration_ms") || 0;

      await updatePromptAggregates(promptId, {
        inputTokens,
        outputTokens,
        cacheReadTokens,
        costUsd,
        apiCalls: 1,
        durationMs,
      });

      await updateSessionAggregates(sessionId, {
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheCreationTokens,
        costUsd,
        apiCalls: 1,
      });
      break;
    }

    case "claude_code.api_error": {
      if (!promptId) return;
      await ensurePrompt(promptId, sessionId, timestamp);
      await insertApiError(promptId, sessionId, attrs, timestamp);
      await updatePromptAggregates(promptId, { errors: 1 });
      await updateSessionAggregates(sessionId, { errors: 1 });
      break;
    }

    case "claude_code.tool_result": {
      if (!promptId) return;
      await ensurePrompt(promptId, sessionId, timestamp);
      await insertToolResult(promptId, sessionId, attrs, timestamp);
      const durationMs = getNumberAttr(attrs, "duration_ms") || 0;
      await updatePromptAggregates(promptId, {
        toolCalls: 1,
        durationMs,
      });
      await updateSessionAggregates(sessionId, { toolCalls: 1 });
      break;
    }

    case "claude_code.tool_decision": {
      if (!promptId) return;
      await ensurePrompt(promptId, sessionId, timestamp);
      await insertToolDecision(promptId, sessionId, attrs, timestamp);
      break;
    }

    default:
      appLogger.debug({ eventName }, "Unknown log event type");
  }
}
