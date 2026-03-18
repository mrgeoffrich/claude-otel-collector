export type {
  Session,
  TraceSpan,
  DashboardStats,
  TokenUsageBucket,
  CostData,
  PaginatedResponse,
} from "@claude-otel/lib";

import type {
  Session,
  TraceSpan,
  DashboardStats,
  TokenUsageBucket,
  CostData,
  PaginatedResponse,
} from "@claude-otel/lib";

const BASE_URL = "/api";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// --- Sessions ---

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

export function getSessionTraces(sessionId: string): Promise<TraceSpan[]> {
  return fetchJson(`/sessions/${sessionId}/traces`);
}

// --- Traces ---

export function getTraces(params?: {
  limit?: number;
  offset?: number;
  sessionId?: string;
  model?: string;
}): Promise<PaginatedResponse<TraceSpan>> {
  const search = new URLSearchParams();
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.offset) search.set("offset", String(params.offset));
  if (params?.sessionId) search.set("sessionId", params.sessionId);
  if (params?.model) search.set("model", params.model);
  const qs = search.toString();
  return fetchJson(`/traces${qs ? `?${qs}` : ""}`);
}

export function getTraceSpan(spanId: string): Promise<TraceSpan> {
  return fetchJson(`/traces/${spanId}`);
}

// --- Dashboard ---

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
