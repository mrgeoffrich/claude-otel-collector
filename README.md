# Claude OTEL Collector

An OpenTelemetry collector and trace browser for the Claude Agent SDK. Receives OTLP/HTTP telemetry (logs, metrics, traces) from Claude Code and displays sessions, prompts, tool calls, token usage, and costs in a web UI.

## Setup

```bash
# Install dependencies
npm install
cd server && npm install
cd ../web && npm install

# Initialize the database
cd ../server && npx prisma db push
```

Server config is in `server/.env` (already present with working defaults). See `.env.example` for reference.

## Running

```bash
npm run dev
```

This starts both the server (port 4318) and the web UI (port 3110).

## Configuring Claude Code / Agent SDK

Set these environment variables in the shell where you run Claude Code or the Agent SDK so that telemetry is sent to this collector:

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_LOGS_EXPORTER=otlp
export OTEL_METRICS_EXPORTER=otlp
export OTEL_TRACES_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=http/json
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

Optional — capture prompt text and tool names (off by default for privacy):

```bash
export OTEL_LOG_USER_PROMPTS=1
export OTEL_LOG_TOOL_DETAILS=1
```

Once configured, open http://localhost:3110 to view incoming telemetry.
