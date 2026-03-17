export type {
  Session,
  Prompt,
  TimelineEvent,
  DashboardStats,
  TokenUsageBucket,
  CostData,
  PaginatedResponse,
  ErrorsResponse,
} from "@claude-otel/lib";

import type {
  Session,
  Prompt,
  TimelineEvent,
  DashboardStats,
  TokenUsageBucket,
  CostData,
  PaginatedResponse,
  ErrorsResponse,
} from "@claude-otel/lib";

const BASE_URL = "/api";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
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
