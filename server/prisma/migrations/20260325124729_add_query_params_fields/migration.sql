-- AlterTable
ALTER TABLE "agent_sessions" ADD COLUMN "cwd" TEXT;
ALTER TABLE "agent_sessions" ADD COLUMN "initialPrompt" TEXT;
ALTER TABLE "agent_sessions" ADD COLUMN "maxBudgetUsd" REAL;
