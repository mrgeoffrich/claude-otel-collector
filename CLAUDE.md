# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Start both server and web concurrently
npm run dev:server       # Server only (Express on :4318)
npm run dev:web          # Web only (Vite on :3110)

# Server tests (from repo root)
cd server && npm test                    # Run all tests (cleans up test DBs first)
cd server && npx vitest run src/__tests__/otlp-ingestion.test.ts  # Single test file
cd server && npm run test:watch          # Watch mode

# Web lint
cd web && npm run lint

# Prisma
cd server && npx prisma migrate dev      # Create and apply a migration after schema changes
cd server && npx prisma generate         # Regenerate client (runs automatically on dev/build)
```

## Architecture

Monorepo with three npm workspaces (`lib`, `server`, `web`):

**`lib/`** — Shared TypeScript types (`@claude-otel/lib`)
- API response types (Session, TraceSpan, DashboardStats, etc.) used by both server and web
- OTLP protocol type definitions (ExportTraceServiceRequest, etc.)
- Type-only package — build with `npm run build:lib` before server/web (done automatically by dev scripts)

**`server/`** — Express 5 + Prisma + SQLite OTLP collector
- Accepts OTLP/HTTP JSON at `POST /v1/metrics`, `/v1/traces` (port 4318)
- Raw payloads are written to `data/raw/{metrics,traces}/` before any parsing (fire-and-forget via `services/raw-logger.ts`)
- Trace spans are processed by `services/traces-service.ts`:
  - Parses OTLP spans and stores them in the `TraceSpan` table
  - Extracts LLM request metadata (model, tokens, TTFT, duration, success)
  - Extracts rich content (user input, model output, system prompt, tools)
  - Upserts by `spanId` for idempotent redelivery handling
  - Updates Session aggregate counters (tokens, API calls, errors)
- Correlation: `session.id` groups trace spans into conversations
- REST API under `/api/` serves the frontend: sessions, traces, dashboard stats
- Config validated with Zod (`lib/config.ts`), logging via pino (`lib/logger.ts`)
- OTLP parsing helpers in `lib/otlp-parser.ts`

**`web/`** — React 19 + Vite 7 + Tailwind v4 + shadcn/ui dashboard
- Pages: Sessions list → Session detail (conversation view + performance tab) → Traces explorer → Dashboard (token/TTFT charts via Recharts)
- Session detail shows a chat-like conversation view using trace span `newContext` (user input) and `responseModelOutput` (model response), with expandable per-span metrics
- Vite proxies `/api` requests to the server at `http://localhost:4318`
- API client in `lib/api.ts` with typed fetch wrappers; types re-exported from `@claude-otel/lib`

## Prisma

Never use `prisma db push`. Always create migrations with `prisma migrate dev --name <description>` when changing the schema. This ensures schema changes are tracked, reviewable, and reproducible.

## OTLP JSON Encoding Gotchas

- Field names are lowerCamelCase (`startTimeUnixNano`, not `start_time_unix_nano`)
- 64-bit integers are JSON strings: `"intValue": "1240"`
- Byte fields (traceId, spanId) are lowercase hex strings, not base64
- Default/zero values may be omitted entirely

## Testing

- Vitest with supertest for integration tests against the Express app
- Tests use a separate `test.db` (set via `DATABASE_URL=file:./test.db`)
- Test setup (`__tests__/setup.ts`) runs `prisma db push` to create the test DB schema
- Test fixtures in `__tests__/fixtures/`
