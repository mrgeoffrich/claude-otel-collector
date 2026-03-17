-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "orgId" TEXT,
    "model" TEXT,
    "appVersion" TEXT,
    "firstSeenAt" DATETIME NOT NULL,
    "lastSeenAt" DATETIME NOT NULL,
    "totalInputTokens" BIGINT NOT NULL DEFAULT 0,
    "totalOutputTokens" BIGINT NOT NULL DEFAULT 0,
    "totalCacheReadTokens" BIGINT NOT NULL DEFAULT 0,
    "totalCacheCreationTokens" BIGINT NOT NULL DEFAULT 0,
    "totalCostUsd" REAL NOT NULL DEFAULT 0,
    "totalApiCalls" INTEGER NOT NULL DEFAULT 0,
    "totalToolCalls" INTEGER NOT NULL DEFAULT 0,
    "totalErrors" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "prompts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "promptLength" INTEGER,
    "promptText" TEXT,
    "model" TEXT,
    "totalInputTokens" BIGINT NOT NULL DEFAULT 0,
    "totalOutputTokens" BIGINT NOT NULL DEFAULT 0,
    "totalCacheReadTokens" BIGINT NOT NULL DEFAULT 0,
    "totalCostUsd" REAL NOT NULL DEFAULT 0,
    "apiCallCount" INTEGER NOT NULL DEFAULT 0,
    "toolCallCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "totalDurationMs" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "prompts_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "api_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "promptId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "model" TEXT,
    "durationMs" INTEGER,
    "costUsd" REAL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "cacheReadInputTokens" INTEGER,
    "cacheCreationInputTokens" INTEGER,
    "attributes" TEXT,
    CONSTRAINT "api_requests_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "prompts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tool_results" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "promptId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "toolName" TEXT,
    "success" BOOLEAN,
    "durationMs" INTEGER,
    "error" TEXT,
    "decisionSource" TEXT,
    "toolResultSizeBytes" INTEGER,
    "toolParameters" TEXT,
    "attributes" TEXT,
    CONSTRAINT "tool_results_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "prompts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "api_errors" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "promptId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "errorType" TEXT,
    "httpStatusCode" INTEGER,
    "retryAttempt" INTEGER,
    "model" TEXT,
    "attributes" TEXT,
    CONSTRAINT "api_errors_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "prompts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tool_decisions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "promptId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "toolName" TEXT,
    "decision" TEXT,
    "source" TEXT,
    "attributes" TEXT,
    CONSTRAINT "tool_decisions_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "prompts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "metric_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL,
    "metricName" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "attributes" TEXT
);

-- CreateIndex
CREATE INDEX "sessions_lastSeenAt_idx" ON "sessions"("lastSeenAt" DESC);

-- CreateIndex
CREATE INDEX "prompts_sessionId_idx" ON "prompts"("sessionId");

-- CreateIndex
CREATE INDEX "prompts_timestamp_idx" ON "prompts"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "api_requests_promptId_idx" ON "api_requests"("promptId");

-- CreateIndex
CREATE INDEX "tool_results_promptId_idx" ON "tool_results"("promptId");

-- CreateIndex
CREATE INDEX "api_errors_promptId_idx" ON "api_errors"("promptId");

-- CreateIndex
CREATE INDEX "tool_decisions_promptId_idx" ON "tool_decisions"("promptId");

-- CreateIndex
CREATE INDEX "metric_snapshots_metricName_timestamp_idx" ON "metric_snapshots"("metricName", "timestamp" DESC);
