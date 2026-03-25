// Shared API response types used by both server and web

export interface MessageEnvelope {
  sequence: number;
  timestamp: string;
  type: string;
  subtype: string | null;
  session_id: string;
  uuid: string;
  message: unknown;
}

export interface AgentSessionResponse {
  id: string;
  firstSeenAt: string;
  lastSeenAt: string;
  model: string | null;
  claudeCodeVersion: string | null;
  permissionMode: string | null;
  tools: string | null;
  toolsCount: number | null;
  messageCount: number;
  status: string | null;
  totalCostUsd: number | null;
  durationMs: number | null;
  numTurns: number | null;
  isError: boolean | null;
}

export interface AgentMessageResponse {
  id: string;
  sessionId: string;
  sequence: number;
  timestamp: string;
  uuid: string;
  type: string;
  subtype: string | null;
  rawMessage: string;
  model: string | null;
  parentToolUseId: string | null;
  toolName: string | null;
  toolUseId: string | null;
  contentPreview: string | null;
  costUsd: number | null;
  durationMs: number | null;
  numTurns: number | null;
  isError: boolean | null;
}

export interface ToolCallEntry {
  id: string;
  name: string;
  input: unknown;
}

export interface ConversationMessageResponse {
  id: string;
  sessionId: string;
  sequence: number;
  timestamp: string;
  uuid: string;
  role: string;
  userContent: string | null;
  textContent: string | null;
  toolCalls: string | null;
  toolCallCount: number | null;
  model: string | null;
  stopReason: string | null;
  costUsd: number | null;
  durationMs: number | null;
  numTurns: number | null;
  isError: boolean | null;
  resultText: string | null;
  toolSummary: string | null;
  parentToolUseId: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
