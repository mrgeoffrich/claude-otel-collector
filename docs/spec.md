# Building an OTEL Collector & Trace Browser for Claude Agent SDK (TypeScript)

## The Signals: Metrics, Log Events, and Traces

The Claude Agent SDK (TypeScript: `@anthropic-ai/claude-agent-sdk`) wraps the Claude Code CLI. Its native OTEL telemetry emits **metrics** (counters/gauges), **log events**, and **trace spans**.

This means your service needs to:

1. Accept **OTLP/HTTP logs** at `/v1/logs`
2. Accept **OTLP/HTTP metrics** at `/v1/metrics`
3. Accept **OTLP/HTTP traces** at `/v1/traces`
4. **Correlate events** using `prompt.id` and `session.id`

---

## Part 1: OTLP/HTTP Ingestion — What Your Service Receives

### Endpoints & Content Types

| Endpoint | Signal | Content-Type Options |
|---|---|---|
| `POST /v1/logs` | Log events | `application/x-protobuf`, `application/json` |
| `POST /v1/metrics` | Metrics | `application/x-protobuf`, `application/json` |
| `POST /v1/traces` | Traces | `application/x-protobuf`, `application/json` |

The SDK uses standard OTEL env vars to configure export:

```bash
CLAUDE_CODE_ENABLE_TELEMETRY=1
OTEL_LOGS_EXPORTER=otlp
OTEL_METRICS_EXPORTER=otlp
OTEL_TRACES_EXPORTER=otlp
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf   # or http/json, or grpc
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

**Recommendation:** Support `application/json` (OTLP JSON encoding) for simplicity. You can add protobuf later. Support `Content-Encoding: gzip`.

### OTLP JSON Encoding Gotchas

- **Field names** are lowerCamelCase (`startTimeUnixNano`, not `start_time_unix_nano`)
- **64-bit integers** are JSON strings: `"startTimeUnixNano": "1687820190611267258"`
- **Byte fields** (traceId, spanId) are lowercase hex strings (not base64)
- **`intValue`** in attributes is also a string: `{"key": "tokens", "value": {"intValue": "1240"}}`
- **Default/zero values may be omitted** entirely from the JSON

### Log Event Payload Structure (what you'll actually receive)

```
ExportLogsServiceRequest
└── resourceLogs[]
    ├── resource
    │   └── attributes[]          # service.name, telemetry.sdk.*, etc.
    └── scopeLogs[]
        ├── scope                  # instrumentationScope name/version
        └── logRecords[]
            ├── timeUnixNano       # string, nanosecond timestamp
            ├── severityNumber     # int
            ├── severityText       # "INFO", "ERROR", etc.
            ├── body               # AnyValue — usually the event name or message
            ├── attributes[]       # KeyValue[] — THE GOOD STUFF
            ├── traceId            # hex string (may be empty)
            ├── spanId             # hex string (may be empty)
            └── flags              # uint32
```

### Metrics Payload Structure

```
ExportMetricsServiceRequest
└── resourceMetrics[]
    ├── resource
    │   └── attributes[]
    └── scopeMetrics[]
        ├── scope
        └── metrics[]
            ├── name               # e.g. "claude_code.token.usage"
            ├── description
            ├── unit
            └── sum / gauge / histogram
                └── dataPoints[]
                    ├── startTimeUnixNano
                    ├── timeUnixNano
                    ├── asInt / asDouble
                    └── attributes[]
```

---

## Part 2: What the Claude Agent SDK Actually Emits

### The 5 Log Event Types

All events are emitted as OTEL log records. The event name is in the `body` field. All events within a single user prompt share the same `prompt.id` attribute, which is your primary correlation key.

#### 1. `claude_code.user_prompt`
Fired when the user submits a prompt.

| Attribute | Type | Description |
|---|---|---|
| `prompt.id` | string | Unique ID for this prompt — **the join key** |
| `session.id` | string | Session identifier |
| `prompt_length` | int | Character length of the prompt |
| `prompt` | string | Actual prompt text (**only if `OTEL_LOG_USER_PROMPTS=1`**) |
| `model` | string | Model name |
| `user.account_uuid` | string | User identifier |
| `organization.id` | string | Org identifier |
| `app.version` | string | Claude Code version |

#### 2. `claude_code.api_request`
Fired after each Claude API call completes.

| Attribute | Type | Description |
|---|---|---|
| `prompt.id` | string | Correlates to the triggering prompt |
| `session.id` | string | Session identifier |
| `model` | string | Model used for this request |
| `cost_usd` | double | Estimated cost in USD |
| `duration_ms` | int | API call duration |
| `input_tokens` | int | Input tokens consumed |
| `output_tokens` | int | Output tokens generated |
| `cache_read_input_tokens` | int | Tokens read from cache |
| `cache_creation_input_tokens` | int | Tokens written to cache |
| `user.account_uuid` | string | User identifier |
| `organization.id` | string | Org identifier |

#### 3. `claude_code.api_error`
Fired when an API request fails.

| Attribute | Type | Description |
|---|---|---|
| `prompt.id` | string | Correlates to the triggering prompt |
| `session.id` | string | Session identifier |
| `error_type` | string | Error classification |
| `http_status_code` | int | HTTP status code |
| `retry_attempt` | int | Which retry attempt this was |
| `model` | string | Model that was targeted |

#### 4. `claude_code.tool_result`
Fired after tool execution completes.

| Attribute | Type | Description |
|---|---|---|
| `prompt.id` | string | Correlates to the triggering prompt |
| `session.id` | string | Session identifier |
| `tool_name` | string | Tool name (**only if `OTEL_LOG_TOOL_DETAILS=1`**) |
| `success` | bool | Whether the tool succeeded |
| `duration_ms` | int | Tool execution time |
| `error` | string | Error message if failed |
| `decision_source` | string | "config", "hook", "user_permanent", "user_temporary", "user_abort", "user_reject" |
| `tool_result_size_bytes` | int | Size of the tool result |
| `tool_parameters` | string | Tool input params (may contain bash commands, file paths) |

#### 5. `claude_code.tool_decision`
Fired when a tool permission decision is made.

| Attribute | Type | Description |
|---|---|---|
| `prompt.id` | string | Correlates to the triggering prompt |
| `session.id` | string | Session identifier |
| `tool_name` | string | Tool being decided on |
| `decision` | string | "accept" or "reject" |
| `source` | string | "config", "hook", "user_permanent", "user_temporary", "user_abort", "user_reject" |

### The 8 Metric Counters

| Metric Name | Unit | Key Attributes | Description |
|---|---|---|---|
| `claude_code.session` | count | `model`, `session.id`, `user.account_uuid` | Session start counter |
| `claude_code.token.usage` | tokens | `type` (input/output/cacheRead/cacheCreation), `model` | Token consumption by type |
| `claude_code.cost.usage` | USD | `model` | Estimated cost |
| `claude_code.lines_of_code` | lines | `model` | Lines of code changed |
| `claude_code.commits` | count | `model` | Git commits made |
| `claude_code.pull_requests` | count | `model` | PRs created |
| `claude_code.edit_decisions` | count | `source`, `language` | Accept/reject of edits |
| `claude_code.active_time_seconds` | seconds | `model` | Active usage time |

### Common Resource Attributes (on all signals)

| Attribute | Description |
|---|---|
| `service.name` | Typically "claude-code" |
| `telemetry.sdk.language` | "nodejs" |
| `telemetry.sdk.name` | "@opentelemetry/sdk-node" or similar |
| `telemetry.sdk.version` | OTel SDK version |

---

## Part 3: Data Storage Design

### Database Schema (SQLite for dev, PostgreSQL for prod)

The key insight is that `prompt.id` is the unit of work (like a trace), and `session.id` groups prompts into conversations.

```sql
-- Sessions (top-level grouping, like a conversation)
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,                    -- session.id
    user_id TEXT,                           -- user.account_uuid
    org_id TEXT,                            -- organization.id
    model TEXT,
    app_version TEXT,
    first_seen_at TIMESTAMP NOT NULL,
    last_seen_at TIMESTAMP NOT NULL,
    -- Aggregated stats (updated as events arrive)
    total_input_tokens BIGINT DEFAULT 0,
    total_output_tokens BIGINT DEFAULT 0,
    total_cache_read_tokens BIGINT DEFAULT 0,
    total_cache_creation_tokens BIGINT DEFAULT 0,
    total_cost_usd DOUBLE PRECISION DEFAULT 0,
    total_api_calls INT DEFAULT 0,
    total_tool_calls INT DEFAULT 0,
    total_errors INT DEFAULT 0
);

-- Prompts (like traces — one user action triggering a cascade)
CREATE TABLE prompts (
    id TEXT PRIMARY KEY,                    -- prompt.id
    session_id TEXT NOT NULL REFERENCES sessions(id),
    timestamp TIMESTAMP NOT NULL,
    prompt_length INT,
    prompt_text TEXT,                       -- null unless OTEL_LOG_USER_PROMPTS=1
    model TEXT,
    -- Aggregated per-prompt stats
    total_input_tokens BIGINT DEFAULT 0,
    total_output_tokens BIGINT DEFAULT 0,
    total_cache_read_tokens BIGINT DEFAULT 0,
    total_cost_usd DOUBLE PRECISION DEFAULT 0,
    api_call_count INT DEFAULT 0,
    tool_call_count INT DEFAULT 0,
    error_count INT DEFAULT 0,
    total_duration_ms BIGINT DEFAULT 0
);

-- API Requests (like LLM call spans)
CREATE TABLE api_requests (
    id SERIAL PRIMARY KEY,
    prompt_id TEXT NOT NULL REFERENCES prompts(id),
    session_id TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    model TEXT,
    duration_ms INT,
    cost_usd DOUBLE PRECISION,
    input_tokens INT,
    output_tokens INT,
    cache_read_input_tokens INT,
    cache_creation_input_tokens INT,
    -- Raw attributes JSON for anything else
    attributes JSONB
);

-- Tool Executions (like tool call spans)
CREATE TABLE tool_results (
    id SERIAL PRIMARY KEY,
    prompt_id TEXT NOT NULL REFERENCES prompts(id),
    session_id TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    tool_name TEXT,                          -- null unless OTEL_LOG_TOOL_DETAILS=1
    success BOOLEAN,
    duration_ms INT,
    error TEXT,
    decision_source TEXT,
    tool_result_size_bytes INT,
    tool_parameters TEXT,                    -- may contain sensitive data
    attributes JSONB
);

-- API Errors
CREATE TABLE api_errors (
    id SERIAL PRIMARY KEY,
    prompt_id TEXT NOT NULL REFERENCES prompts(id),
    session_id TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    error_type TEXT,
    http_status_code INT,
    retry_attempt INT,
    model TEXT,
    attributes JSONB
);

-- Tool Decisions (permission events)
CREATE TABLE tool_decisions (
    id SERIAL PRIMARY KEY,
    prompt_id TEXT NOT NULL REFERENCES prompts(id),
    session_id TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    tool_name TEXT,
    decision TEXT,                           -- "accept" or "reject"
    source TEXT,
    attributes JSONB
);

-- Raw metrics snapshots (for time-series queries)
CREATE TABLE metric_snapshots (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL,
    metric_name TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    attributes JSONB                        -- model, session.id, type, etc.
);

-- Indexes for common query patterns
CREATE INDEX idx_prompts_session ON prompts(session_id);
CREATE INDEX idx_prompts_timestamp ON prompts(timestamp DESC);
CREATE INDEX idx_api_requests_prompt ON api_requests(prompt_id);
CREATE INDEX idx_tool_results_prompt ON tool_results(prompt_id);
CREATE INDEX idx_api_errors_prompt ON api_errors(prompt_id);
CREATE INDEX idx_sessions_last_seen ON sessions(last_seen_at DESC);
CREATE INDEX idx_metric_snapshots_name_ts ON metric_snapshots(metric_name, timestamp DESC);
```

### Event Routing Logic (pseudocode)

```typescript
function routeLogRecord(record: OTLPLogRecord) {
    const eventName = extractBody(record);  // the event name
    const attrs = parseAttributes(record.attributes);
    const promptId = attrs['prompt.id'];
    const sessionId = attrs['session.id'];
    
    // Ensure session exists (upsert)
    upsertSession(sessionId, attrs);
    
    switch (eventName) {
        case 'claude_code.user_prompt':
            // Creates the "trace root" — a new prompt
            upsertPrompt(promptId, sessionId, attrs);
            break;
            
        case 'claude_code.api_request':
            // Child of prompt — an LLM call
            insertApiRequest(promptId, sessionId, attrs);
            updatePromptAggregates(promptId, attrs);
            updateSessionAggregates(sessionId, attrs);
            break;
            
        case 'claude_code.api_error':
            insertApiError(promptId, sessionId, attrs);
            break;
            
        case 'claude_code.tool_result':
            insertToolResult(promptId, sessionId, attrs);
            updatePromptAggregates(promptId, attrs);
            break;
            
        case 'claude_code.tool_decision':
            insertToolDecision(promptId, sessionId, attrs);
            break;
    }
}
```

---

## Part 4: UI Design — What Views Are Most Useful

Based on patterns proven across Langfuse, Phoenix (Arize), LangSmith, and Jaeger, here are the views that matter most for debugging Claude Agent SDK applications, ordered by priority.

### View 1: Session List (Home Page)

The entry point. Shows all sessions reverse-chronologically.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Sessions                                            [Filter] [⟳]  │
├─────────────────────────────────────────────────────────────────────┤
│  ● session-abc123          2 min ago     claude-sonnet-4-6         │
│    12 prompts · 45,230 tokens · $0.34 · 8 tool calls · 0 errors   │
├─────────────────────────────────────────────────────────────────────┤
│  ● session-def456          15 min ago    claude-sonnet-4-6         │
│    3 prompts · 12,100 tokens · $0.09 · 2 tool calls · 1 error     │
├─────────────────────────────────────────────────────────────────────┤
│  ○ session-ghi789          1 hour ago    claude-opus-4-6           │
│    28 prompts · 234,500 tokens · $4.12 · 42 tool calls · 0 errors │
└─────────────────────────────────────────────────────────────────────┘
```

Key columns: session ID (clickable), last activity, model, prompt count, total tokens, cost, tool calls, error count. Color-code errors red. Sort by recency. Filter by model, date range, error status.

### View 2: Session Detail — Prompt Timeline (The "Trace" View)

This is the most important view. When you click a session, you see every prompt as a chronological "turn" — each prompt expands into its API calls and tool executions like a waterfall.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Session abc123 · claude-sonnet-4-6 · Started 2 min ago            │
│  Total: 45,230 tokens · $0.34 · 8 tool calls · 0 errors           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ▼ Prompt 1  "What files are in this directory?"   [12:34:01]       │
│  │  1,240 tokens in · 350 out · $0.02 · 820ms                      │
│  │                                                                  │
│  ├── 🤖 API Call    sonnet-4-6   890→350 tokens  $0.01  420ms      │
│  ├── 🔧 Bash        "ls -la"    ✅ 230ms                            │
│  ├── 🤖 API Call    sonnet-4-6   1200→180 tokens  $0.01  400ms     │
│  │                                                                  │
│  ▼ Prompt 2  "Create a hello.py file"              [12:34:15]       │
│  │  2,800 tokens in · 520 out · $0.04 · 1.2s                       │
│  │                                                                  │
│  ├── 🤖 API Call    sonnet-4-6   2100→400 tokens  $0.03  600ms     │
│  ├── 🛡️ Decision   Write → accept (config)                         │
│  ├── 🔧 Write       "hello.py"  ✅ 45ms                             │
│  ├── 🤖 API Call    sonnet-4-6   2400→120 tokens  $0.01  350ms     │
│  │                                                                  │
│  ▶ Prompt 3  "Run the tests"                       [12:34:28]       │
│     3,100 tokens in · 680 out · $0.05 · 2.1s · ⚠️ 1 retry         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Design notes:**
- Each prompt is a collapsible row (the "trace root")
- Child events (API calls, tool results, decisions) nest underneath
- Inline badges: token counts, cost, duration, status
- Color coding: 🤖 blue for LLM calls, 🔧 green for tools, 🔴 red for errors, 🛡️ grey for decisions
- Clicking any event opens the **Detail Panel** (View 3)

### View 3: Event Detail Panel (Right Sidebar)

When clicking an API call or tool result, a side panel shows all attributes.

**For an API Request:**
```
┌──────────────────────────────────┐
│  API Request Detail              │
├──────────────────────────────────┤
│  Model:     claude-sonnet-4-6    │
│  Duration:  420ms                │
│  Cost:      $0.0134              │
│                                  │
│  Token Breakdown:                │
│  ┌─────────────────────────────┐ │
│  │ Input        890            │ │
│  │ Output       350            │ │
│  │ Cache Read   2,400          │ │
│  │ Cache Create 0              │ │
│  │ Cache Hit %  73%            │ │
│  └─────────────────────────────┘ │
│                                  │
│  Raw Attributes:     [Copy JSON] │
│  { ... }                         │
└──────────────────────────────────┘
```

**For a Tool Result:**
```
┌──────────────────────────────────┐
│  Tool Execution Detail           │
├──────────────────────────────────┤
│  Tool:      Bash                 │
│  Status:    ✅ Success           │
│  Duration:  230ms                │
│  Result Size: 1,420 bytes        │
│  Decision:  config (auto-allow)  │
│                                  │
│  Parameters:                     │
│  ┌─────────────────────────────┐ │
│  │ command: "ls -la"           │ │
│  └─────────────────────────────┘ │
│                                  │
│  Raw Attributes:     [Copy JSON] │
└──────────────────────────────────┘
```

### View 4: Token & Cost Dashboard

Aggregated analytics across sessions. This is where metrics data shines.

**Top row: Summary cards**
- Total tokens (24h) — with input/output/cache breakdown
- Total cost (24h)  
- Cache hit rate (%)
- Average cost per prompt

**Charts:**
- **Token usage over time** — stacked area: input, output, cache_read, cache_creation
- **Cost per session** — bar chart, clickable to navigate to session
- **Cache efficiency trend** — line chart: `cache_read / (cache_read + input)` over time
- **Model distribution** — donut chart showing which models are used
- **Tool call frequency** — bar chart of tool names by usage count
- **Error rate** — line chart of errors over time

### View 5: Prompt Explorer (Search & Filter)

Full-text search across prompt text (when captured) and tool parameters. 

Filters: model, date range, min/max cost, min/max tokens, has errors, tool name used. This is critical for finding "that prompt where it spent $2 on tokens and failed."

### View 6: Error Analysis

Dedicated view showing all `api_error` and failed `tool_result` events. Group by error type, show retry patterns, highlight sessions with unusual error rates. Link each error back to its prompt context.

---

## Part 5: Recommended Architecture

```
┌──────────────────┐     OTLP/HTTP (JSON)     ┌───────────────────┐
│  Claude Agent SDK │ ──── /v1/logs ─────────▶ │                   │
│  (TypeScript)     │ ──── /v1/metrics ──────▶ │  Your HTTP Server │
│                   │                           │  (Node/Express    │
│  env:             │                           │   or Fastify)     │
│  OTEL_*_EXPORTER  │                           │                   │
│  =otlp            │                           └───────┬───────────┘
│  OTEL_EXPORTER_   │                                   │
│  OTLP_PROTOCOL    │                           ┌───────▼───────────┐
│  =http/json       │                           │  Event Router     │
│  OTEL_EXPORTER_   │                           │  (parse events,   │
│  OTLP_ENDPOINT    │                           │   correlate by    │
│  =http://your-svc │                           │   prompt.id)      │
└──────────────────┘                           └───────┬───────────┘
                                                       │
                                               ┌───────▼───────────┐
                                               │  SQLite / Postgres│
                                               │  (sessions,       │
                                               │   prompts,        │
                                               │   api_requests,   │
                                               │   tool_results)   │
                                               └───────┬───────────┘
                                                       │
                                               ┌───────▼───────────┐
                                               │  React UI         │
                                               │  (Next.js +       │
                                               │   shadcn/ui +     │
                                               │   Tailwind)       │
                                               └───────────────────┘
```

### Tech Stack Recommendation (for your setup)

- **Server**: Node.js + Fastify (fast JSON parsing, good for OTLP)
- **Database**: SQLite with better-sqlite3 for dev, PostgreSQL for prod
- **Frontend**: Next.js + shadcn/ui + Tailwind (your usual stack)
- **Charting**: Recharts for the token/cost dashboards
- **Container**: Docker (fits your mini-infra approach)

### Key Environment Variables for the SDK

```bash
# Required
CLAUDE_CODE_ENABLE_TELEMETRY=1
OTEL_LOGS_EXPORTER=otlp
OTEL_METRICS_EXPORTER=otlp
OTEL_TRACES_EXPORTER=otlp

# Point at your service
OTEL_EXPORTER_OTLP_PROTOCOL=http/json    # easiest to parse
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# Optional but recommended for debugging
OTEL_LOG_USER_PROMPTS=1                   # capture actual prompt text
OTEL_LOG_TOOL_DETAILS=1                   # capture tool names
OTEL_METRIC_EXPORT_INTERVAL=10000         # 10s (default 60s)
OTEL_LOGS_EXPORT_INTERVAL=5000            # 5s (default 5s)
```

### Privacy Notes

- Prompt text is NOT collected by default (only length). Set `OTEL_LOG_USER_PROMPTS=1` to capture it.
- Tool names are NOT logged by default. Set `OTEL_LOG_TOOL_DETAILS=1`.
- `tool_parameters` may contain bash commands, file paths, and potentially secrets.
- When using OAuth, `user.email` is included in telemetry attributes.
- Raw file contents and code snippets are never included.

---

## Part 6: Traces

`OTEL_TRACES_EXPORTER=otlp`. Your service accepts `POST /v1/traces`. The span hierarchy is:

```
session (root span, long-lived)
└── user_prompt (per prompt)
    ├── api_request (LLM call)
    ├── tool_execution
    │   ├── tool_decision
    │   └── tool_result
    ├── api_request (follow-up LLM call)
    └── ...
```

The log-event-based approach maps cleanly to this — `session.id` → root span, `prompt.id` → child span, individual events → leaf spans. You can ingest traces alongside the log events, or use them as the primary source of hierarchy.

---

## Part 7: Raw Request Logging to Disk

Every inbound OTLP request should be written to disk **before** any parsing or routing occurs. This provides a complete replay log — if a request can't be parsed, the raw payload is available to feed back into Claude Code to fix the parser.

### Directory Layout

```
data/raw/
├── logs/
│   ├── 2026-03-17T12-34-01.234Z.json
│   ├── 2026-03-17T12-34-06.891Z.json
│   └── ...
├── metrics/
│   ├── 2026-03-17T12-34-02.456Z.json
│   └── ...
└── traces/
    ├── 2026-03-17T12-34-03.789Z.json
    └── ...
```

Each file contains the full raw request body as received (after decompression if gzip). Filenames are ISO timestamps for easy sorting. The signal type (`logs`, `metrics`, `traces`) is determined by which endpoint received the request.

### Implementation

```typescript
// Runs as the first middleware, before JSON parsing or event routing
async function rawRequestLogger(signal: 'logs' | 'metrics' | 'traces', body: Buffer | string) {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const dir = path.join(DATA_DIR, 'raw', signal);
    const filePath = path.join(dir, `${timestamp}.json`);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, body);
}
```

### Retention & Cleanup

- **Default retention**: 7 days. Configurable via `RAW_LOG_RETENTION_DAYS` env var.
- A periodic cleanup task (runs daily) deletes files older than the retention period.
- **Disk usage estimate**: at typical Claude Agent SDK usage (~1-5 requests/second), raw logs consume roughly 50-200 MB/day. Monitor `data/raw/` size.

### When This Saves You

- The OTLP JSON encoding has subtle gotchas (string-encoded ints, omitted zero values, camelCase vs snake_case). When parsing breaks on an unexpected payload shape, grab the raw file and use it as a test fixture.
- Protobuf payloads can be logged as raw binary files (`.bin` extension instead of `.json`) for the same purpose — decode offline with `protoc` or feed to Claude Code for analysis.
- The raw log also serves as an audit trail of exactly what the SDK sent, independent of any processing bugs.
