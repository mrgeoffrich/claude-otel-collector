import { AnyValue, KeyValue, LogRecord } from "./otlp-types";

export type ParsedAttributes = Record<string, string | number | boolean>;

/**
 * Parse OTLP KeyValue[] attributes into a flat record.
 * Handles: stringValue, intValue (string→number), doubleValue, boolValue.
 */
export function parseAttributes(attrs?: KeyValue[]): ParsedAttributes {
  if (!attrs) return {};

  const result: ParsedAttributes = {};
  for (const kv of attrs) {
    const val = kv.value;
    if (val.stringValue !== undefined) {
      result[kv.key] = val.stringValue;
    } else if (val.intValue !== undefined) {
      result[kv.key] = parseInt(val.intValue, 10);
    } else if (val.doubleValue !== undefined) {
      result[kv.key] = val.doubleValue;
    } else if (val.boolValue !== undefined) {
      result[kv.key] = val.boolValue;
    }
  }
  return result;
}

/**
 * Parse OTLP nanosecond timestamp string to Date.
 * OTLP sends timestamps as strings like "1687820190611267258".
 */
export function parseTimestamp(nanoStr?: string): Date {
  if (!nanoStr) return new Date();
  // Convert nanoseconds to milliseconds
  const ms = Math.floor(parseInt(nanoStr, 10) / 1_000_000);
  return new Date(ms);
}

/**
 * Extract the event name from a LogRecord body.
 * The body is an AnyValue — usually stringValue containing the event name.
 */
export function extractBody(record: LogRecord): string {
  if (!record.body) return "";
  return extractAnyValue(record.body);
}

function extractAnyValue(val: AnyValue): string {
  if (val.stringValue !== undefined) return val.stringValue;
  if (val.intValue !== undefined) return val.intValue;
  if (val.doubleValue !== undefined) return String(val.doubleValue);
  if (val.boolValue !== undefined) return String(val.boolValue);
  return "";
}

/**
 * Get a string attribute or undefined.
 */
export function getStringAttr(
  attrs: ParsedAttributes,
  key: string,
): string | undefined {
  const val = attrs[key];
  return typeof val === "string" ? val : val !== undefined ? String(val) : undefined;
}

/**
 * Get a number attribute or undefined.
 */
export function getNumberAttr(
  attrs: ParsedAttributes,
  key: string,
): number | undefined {
  const val = attrs[key];
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const n = parseFloat(val);
    return isNaN(n) ? undefined : n;
  }
  return undefined;
}

/**
 * Get a boolean attribute or undefined.
 */
export function getBoolAttr(
  attrs: ParsedAttributes,
  key: string,
): boolean | undefined {
  const val = attrs[key];
  if (typeof val === "boolean") return val;
  if (val === "true") return true;
  if (val === "false") return false;
  return undefined;
}
