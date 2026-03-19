# Claude OTEL Collector

See exactly what your AI agent is doing under the hood. Claude OTEL Collector is a local OpenTelemetry collector and trace browser designed primarily for the Claude Agent SDK — it captures every LLM call, tool invocation, and token spent, then displays sessions, prompts, performance metrics, and costs in a web UI.

## Setup

```bash
# Install dependencies
npm install

# Initialize the database
cd server && npx prisma migrate dev
```

Server config is in `server/.env` (already present with working defaults). See `.env.example` for reference.

## Running

```bash
npm run dev
```

This starts both the server (port 4318) and the web UI (port 3110).

## Configuring Claude Code

Set these environment variables in the shell where you run Claude Code so that telemetry is sent to this collector:

```bash
export BETA_TRACING_ENDPOINT=http://localhost:4318
export ENABLE_BETA_TRACING_DETAILED=true
```

Once configured, open http://localhost:3110 to view incoming telemetry.
