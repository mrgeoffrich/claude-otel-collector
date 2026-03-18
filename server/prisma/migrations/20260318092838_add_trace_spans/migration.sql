-- CreateTable
CREATE TABLE "trace_spans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "traceId" TEXT NOT NULL,
    "spanId" TEXT NOT NULL,
    "parentSpanId" TEXT,
    "sessionId" TEXT NOT NULL,
    "spanName" TEXT NOT NULL,
    "spanKind" INTEGER,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "durationMs" INTEGER,
    "model" TEXT,
    "querySource" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "cacheReadTokens" INTEGER,
    "cacheCreationTokens" INTEGER,
    "success" BOOLEAN,
    "attempt" INTEGER,
    "ttftMs" INTEGER,
    "speed" TEXT,
    "systemPromptPreview" TEXT,
    "systemPromptHash" TEXT,
    "systemPromptLength" INTEGER,
    "tools" TEXT,
    "toolsCount" INTEGER,
    "newContext" TEXT,
    "newContextMessageCount" INTEGER,
    "systemReminders" TEXT,
    "systemRemindersCount" INTEGER,
    "responseModelOutput" TEXT,
    "responseHasToolCall" BOOLEAN,
    "attributes" TEXT,
    CONSTRAINT "trace_spans_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "trace_spans_spanId_key" ON "trace_spans"("spanId");

-- CreateIndex
CREATE INDEX "trace_spans_sessionId_idx" ON "trace_spans"("sessionId");

-- CreateIndex
CREATE INDEX "trace_spans_traceId_idx" ON "trace_spans"("traceId");

-- CreateIndex
CREATE INDEX "trace_spans_startTime_idx" ON "trace_spans"("startTime" DESC);
