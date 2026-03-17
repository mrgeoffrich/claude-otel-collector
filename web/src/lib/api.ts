const BASE_URL = "/api";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// --- Types ---

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

// --- API Functions ---

export function getSessions(params?: {
  limit?: number;
  offset?: number;
  model?: string;
  hasErrors?: boolean;
}): Promise<PaginatedResponse<Session>> {
  const search = new URLSearchParams();
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.offset) search.set("offset", String(params.offset));
  if (params?.model) search.set("model", params.model);
  if (params?.hasErrors) search.set("hasErrors", "true");
  const qs = search.toString();
  return fetchJson(`/sessions${qs ? `?${qs}` : ""}`);
}

export function getSession(id: string): Promise<Session> {
  return fetchJson(`/sessions/${id}`);
}

export function getSessionPrompts(sessionId: string): Promise<Prompt[]> {
  return fetchJson(`/sessions/${sessionId}/prompts`);
}

export function getPrompt(id: string): Promise<Prompt> {
  return fetchJson(`/prompts/${id}`);
}

export function getPromptEvents(promptId: string): Promise<TimelineEvent[]> {
  return fetchJson(`/prompts/${promptId}/events`);
}

export function getDashboardStats(
  hours?: number,
): Promise<DashboardStats> {
  return fetchJson(`/dashboard/stats${hours ? `?hours=${hours}` : ""}`);
}

export function getTokenUsage(hours?: number): Promise<TokenUsageBucket[]> {
  return fetchJson(`/dashboard/token-usage${hours ? `?hours=${hours}` : ""}`);
}

export function getCostData(hours?: number): Promise<CostData> {
  return fetchJson(`/dashboard/cost${hours ? `?hours=${hours}` : ""}`);
}

export function getErrors(): Promise<ErrorsResponse> {
  return fetchJson("/errors");
}

export function searchPrompts(params?: {
  q?: string;
  model?: string;
  minCost?: number;
  maxCost?: number;
  hasErrors?: boolean;
  limit?: number;
  offset?: number;
}): Promise<PaginatedResponse<Prompt & { session: { id: string; model: string | null } }>> {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.model) search.set("model", params.model);
  if (params?.minCost !== undefined) search.set("minCost", String(params.minCost));
  if (params?.maxCost !== undefined) search.set("maxCost", String(params.maxCost));
  if (params?.hasErrors) search.set("hasErrors", "true");
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.offset) search.set("offset", String(params.offset));
  const qs = search.toString();
  return fetchJson(`/search/prompts${qs ? `?${qs}` : ""}`);
}
