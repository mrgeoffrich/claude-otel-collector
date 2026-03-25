import type {
  AgentSessionResponse,
  ConversationMessageResponse,
  PaginatedResponse,
} from "@claude-otel/lib";

export type { AgentSessionResponse, ConversationMessageResponse, PaginatedResponse };

const BASE_URL = "/api";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export function getSessions(params?: {
  limit?: number;
  offset?: number;
}): Promise<PaginatedResponse<AgentSessionResponse>> {
  const search = new URLSearchParams();
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.offset) search.set("offset", String(params.offset));
  const qs = search.toString();
  return fetchJson(`/sessions${qs ? `?${qs}` : ""}`);
}

export function getSession(id: string): Promise<AgentSessionResponse> {
  return fetchJson(`/sessions/${id}`);
}

export function getConversation(
  id: string,
  params?: { limit?: number; offset?: number; role?: string },
): Promise<PaginatedResponse<ConversationMessageResponse>> {
  const search = new URLSearchParams();
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.offset) search.set("offset", String(params.offset));
  if (params?.role) search.set("role", params.role);
  const qs = search.toString();
  return fetchJson(`/sessions/${id}/conversation${qs ? `?${qs}` : ""}`);
}
