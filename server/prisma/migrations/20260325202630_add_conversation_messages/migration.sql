-- CreateTable
CREATE TABLE "conversation_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "uuid" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "userContent" TEXT,
    "textContent" TEXT,
    "toolCalls" TEXT,
    "toolCallCount" INTEGER,
    "model" TEXT,
    "stopReason" TEXT,
    "costUsd" REAL,
    "durationMs" INTEGER,
    "numTurns" INTEGER,
    "isError" BOOLEAN,
    "resultText" TEXT,
    "toolSummary" TEXT,
    "parentToolUseId" TEXT,
    CONSTRAINT "conversation_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "agent_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "conversation_messages_uuid_key" ON "conversation_messages"("uuid");

-- CreateIndex
CREATE INDEX "conversation_messages_sessionId_sequence_idx" ON "conversation_messages"("sessionId", "sequence");

