# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Start both server and web concurrently
npm run dev:server       # Server only (Express on :4318)
npm run dev:web          # Web only (Vite on :3110)

# Server tests (from repo root)
cd server && npm test                    # Run all tests (cleans up test DBs first)
cd server && npx vitest run src/__tests__/message-ingestion.test.ts  # Single test file
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
- API response types (AgentSessionResponse, ConversationMessageResponse, PaginatedResponse, etc.) used by both server and web
- Type-only package — build with `npm run build:lib` before server/web (done automatically by dev scripts)

**`server/`** — Express 5 + Prisma + SQLite agent message collector
- Accepts Agent SDK message envelopes at `POST /messages` (port 4318)
- Messages are processed by `services/agent-message-service.ts`:
  - Stores raw messages in the `AgentMessage` table
  - Extracts metadata (model, cost, duration, tool calls)
  - Upserts by message `uuid` for idempotent redelivery handling
  - Upserts `AgentSession` with aggregate stats
- `services/reassembly-service.ts` assembles streaming message chunks into `ConversationMessage` records (user, assistant, result, tool_summary roles)
- `services/agent-session-service.ts` provides session queries for the API
- REST API under `/api/sessions/` serves the frontend: session list, session detail, conversation messages
- Config validated with Zod (`lib/config.ts`), logging via pino (`lib/logger.ts`)

**`web/`** — React 19 + Vite 7 + Tailwind v4 + shadcn/ui dashboard
- Pages: Sessions list → Session detail (conversation view with role-based message components)
- Conversation components in `components/conversation/` render user, assistant, result, tool summary, and system messages
- Vite proxies `/api` requests to the server at `http://localhost:4318`
- API client in `lib/api.ts` with typed fetch wrappers; types re-exported from `@claude-otel/lib`

## Prisma

The dev database is at `server/prisma/prisma/dev.db` (note the double `prisma` — Prisma resolves `file:./prisma/dev.db` relative to the schema file location in `server/prisma/`).

Never use `prisma db push`. Always create migrations with `prisma migrate dev --name <description>` when changing the schema. This ensures schema changes are tracked, reviewable, and reproducible.

## Configuring Claude Code

To send agent messages to this collector, set this env var in the shell running Claude Code:

```bash
export CLAUDE_CODE_MESSAGE_ENDPOINT=http://localhost:4318/messages
```

## Testing

- Vitest with supertest for integration tests against the Express app
- Tests use a separate `test.db` (set via `DATABASE_URL=file:./test.db`)
- Test setup (`__tests__/setup.ts`) runs `prisma db push` to create the test DB schema
- Test fixtures in `__tests__/fixtures/`
