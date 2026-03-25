-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "metric_snapshots";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "sessions";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "trace_spans";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "agent_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstSeenAt" DATETIME NOT NULL,
    "lastSeenAt" DATETIME NOT NULL,
    "model" TEXT,
    "claudeCodeVersion" TEXT,
    "permissionMode" TEXT,
    "tools" TEXT,
    "toolsCount" INTEGER,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT,
    "totalCostUsd" REAL,
    "durationMs" INTEGER,
    "numTurns" INTEGER,
    "isError" BOOLEAN
);

-- CreateTable
CREATE TABLE "agent_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "uuid" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subtype" TEXT,
    "rawMessage" TEXT NOT NULL,
    "model" TEXT,
    "parentToolUseId" TEXT,
    "toolName" TEXT,
    "toolUseId" TEXT,
    "contentPreview" TEXT,
    "costUsd" REAL,
    "durationMs" INTEGER,
    "numTurns" INTEGER,
    "isError" BOOLEAN,
    CONSTRAINT "agent_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "agent_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "agent_sessions_lastSeenAt_idx" ON "agent_sessions"("lastSeenAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "agent_messages_uuid_key" ON "agent_messages"("uuid");

-- CreateIndex
CREATE INDEX "agent_messages_sessionId_idx" ON "agent_messages"("sessionId");

-- CreateIndex
CREATE INDEX "agent_messages_type_idx" ON "agent_messages"("type");

-- CreateIndex
CREATE INDEX "agent_messages_timestamp_idx" ON "agent_messages"("timestamp" DESC);

