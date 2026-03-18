// Shared API response types used by both server and web

export interface Session {
  id: string;
  userId: string | null;
  orgId: string | null;
  model: string | null;
  appVersion: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheCreationTokens: number;
  totalCostUsd: number;
  totalApiCalls: number;
  totalToolCalls: number;
  totalErrors: number;
  // Included in list responses
  spanCount?: number;
  firstMessage?: string | null;
  firstResponse?: string | null;
}

export interface TraceSpan {
  id: string;
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  sessionId: string;
  spanName: string;
  spanKind: number | null;
  startTime: string;
  endTime: string | null;
  durationMs: number | null;
  model: string | null;
  querySource: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheCreationTokens: number | null;
  success: boolean | null;
  attempt: number | null;
  ttftMs: number | null;
  speed: string | null;
  systemPromptPreview: string | null;
  systemPromptHash: string | null;
  systemPromptLength: number | null;
  tools: string | null;
  toolsCount: number | null;
  newContext: string | null;
  newContextMessageCount: number | null;
  systemReminders: string | null;
  systemRemindersCount: number | null;
  responseModelOutput: string | null;
  responseHasToolCall: boolean | null;
  attributes: string | null;
}

export interface DashboardStats {
  hours: number;
  sessions: number;
  spans: number;
  failedSpans: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheCreationTokens: number;
  cacheHitRate: number;
  avgTtftMs: number | null;
  avgDurationMs: number | null;
}

export interface TokenUsageBucket {
  timestamp: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export interface CostData {
  sessionCosts: Array<{
    id: string;
    model: string | null;
    totalCostUsd: number;
    lastSeenAt: string;
  }>;
  modelDistribution: Record<string, { count: number; cost: number }>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
