import { ExportTraceServiceRequest } from "@claude-otel/lib";
import { parseAttributes, parseTimestamp, getStringAttr } from "../lib/otlp-parser";
import { upsertSession } from "./session-service";
import { appLogger } from "../lib/logger";

/**
 * Process traces from an OTLP ExportTraceServiceRequest.
 * Correlates spans with existing sessions/prompts.
 * The log-event approach is the primary data source — traces supplement hierarchy info.
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
          const attrs = parseAttributes(span.attributes);
          const sessionId = getStringAttr(attrs, "session.id");
          const timestamp = parseTimestamp(span.startTimeUnixNano);

          // If this span has a session.id, ensure the session exists
          if (sessionId) {
            await upsertSession(sessionId, attrs, timestamp);
          }
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
