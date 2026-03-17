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
}

export interface Prompt {
  id: string;
  sessionId: string;
  timestamp: string;
  promptLength: number | null;
  promptText: string | null;
  model: string | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCostUsd: number;
  apiCallCount: number;
  toolCallCount: number;
  errorCount: number;
  totalDurationMs: number;
}

export interface TimelineEvent {
  id: string;
  promptId: string;
  sessionId: string;
  timestamp: string;
  type: "api_request" | "tool_result" | "api_error" | "tool_decision";
  // api_request fields
  model?: string;
  durationMs?: number | null;
  costUsd?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  cacheReadInputTokens?: number | null;
  cacheCreationInputTokens?: number | null;
  // tool_result fields
  toolName?: string | null;
  success?: boolean | null;
  error?: string | null;
  decisionSource?: string | null;
  toolResultSizeBytes?: number | null;
  toolParameters?: string | null;
  // api_error fields
  errorType?: string | null;
  httpStatusCode?: number | null;
  retryAttempt?: number | null;
  // tool_decision fields
  decision?: string | null;
  source?: string | null;
  // raw
  attributes?: string | null;
}

export interface DashboardStats {
  hours: number;
  sessions: number;
  prompts: number;
  errors: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheCreationTokens: number;
  totalCostUsd: number;
  cacheHitRate: number;
  avgCostPerPrompt: number;
  totalApiCalls: number;
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

export interface ErrorsResponse {
  apiErrors: Array<TimelineEvent & { prompt: { id: string; sessionId: string; promptText: string | null } }>;
  failedTools: Array<TimelineEvent & { prompt: { id: string; sessionId: string; promptText: string | null } }>;
  total: number;
}
