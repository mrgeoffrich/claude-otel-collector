// OTLP JSON encoding types
// Field names are lowerCamelCase per OTLP JSON spec
// 64-bit integers are JSON strings
// Byte fields (traceId, spanId) are lowercase hex strings

export interface AnyValue {
  stringValue?: string;
  intValue?: string; // 64-bit int as string
  doubleValue?: number;
  boolValue?: boolean;
  arrayValue?: { values: AnyValue[] };
  kvlistValue?: { values: KeyValue[] };
  bytesValue?: string;
}

export interface KeyValue {
  key: string;
  value: AnyValue;
}

export interface Resource {
  attributes?: KeyValue[];
  droppedAttributesCount?: number;
}

export interface InstrumentationScope {
  name?: string;
  version?: string;
  attributes?: KeyValue[];
}

// --- Logs ---

export interface LogRecord {
  timeUnixNano?: string;
  observedTimeUnixNano?: string;
  severityNumber?: number;
  severityText?: string;
  body?: AnyValue;
  attributes?: KeyValue[];
  droppedAttributesCount?: number;
  flags?: number;
  traceId?: string;
  spanId?: string;
}

export interface ScopeLogs {
  scope?: InstrumentationScope;
  logRecords?: LogRecord[];
}

export interface ResourceLogs {
  resource?: Resource;
  scopeLogs?: ScopeLogs[];
}

export interface ExportLogsServiceRequest {
  resourceLogs?: ResourceLogs[];
}

// --- Metrics ---

export interface NumberDataPoint {
  startTimeUnixNano?: string;
  timeUnixNano?: string;
  asInt?: string; // 64-bit int as string
  asDouble?: number;
  attributes?: KeyValue[];
}

export interface HistogramDataPoint {
  startTimeUnixNano?: string;
  timeUnixNano?: string;
  count?: string;
  sum?: number;
  bucketCounts?: string[];
  explicitBounds?: number[];
  attributes?: KeyValue[];
}

export interface Sum {
  dataPoints?: NumberDataPoint[];
  aggregationTemporality?: number;
  isMonotonic?: boolean;
}

export interface Gauge {
  dataPoints?: NumberDataPoint[];
}

export interface Histogram {
  dataPoints?: HistogramDataPoint[];
  aggregationTemporality?: number;
}

export interface Metric {
  name?: string;
  description?: string;
  unit?: string;
  sum?: Sum;
  gauge?: Gauge;
  histogram?: Histogram;
}

export interface ScopeMetrics {
  scope?: InstrumentationScope;
  metrics?: Metric[];
}

export interface ResourceMetrics {
  resource?: Resource;
  scopeMetrics?: ScopeMetrics[];
}

export interface ExportMetricsServiceRequest {
  resourceMetrics?: ResourceMetrics[];
}

// --- Traces ---

export interface Span {
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  name?: string;
  kind?: number;
  startTimeUnixNano?: string;
  endTimeUnixNano?: string;
  attributes?: KeyValue[];
  status?: {
    code?: number;
    message?: string;
  };
  events?: SpanEvent[];
}

export interface SpanEvent {
  timeUnixNano?: string;
  name?: string;
  attributes?: KeyValue[];
}

export interface ScopeSpans {
  scope?: InstrumentationScope;
  spans?: Span[];
}

export interface ResourceSpans {
  resource?: Resource;
  scopeSpans?: ScopeSpans[];
}

export interface ExportTraceServiceRequest {
  resourceSpans?: ResourceSpans[];
}
