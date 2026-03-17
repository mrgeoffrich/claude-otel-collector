import { PrismaClient } from "@prisma/client";
import Database from "better-sqlite3";
import path from "path";

// Enable WAL journal mode for better concurrent read/write performance
try {
  const dbUrl = process.env.DATABASE_URL || "file:./prisma/dev.db";
  const dbPath = dbUrl.replace("file:", "");
  const resolvedPath = path.resolve(dbPath);
  const db = new Database(resolvedPath);
  db.pragma("journal_mode = WAL");
  db.close();
} catch (err) {
  console.warn("[STARTUP] Failed to set SQLite WAL mode:", err);
}

declare global {
  var prisma: PrismaClient | undefined;
}

const prisma =
  globalThis.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "test" ? [] : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;

export default prisma;
