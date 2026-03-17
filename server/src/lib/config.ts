import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const configSchema = z.object({
  port: z.coerce.number().default(4318),
  nodeEnv: z.string().default("development"),
  databaseUrl: z.string().default("file:./prisma/dev.db"),
  logLevel: z.string().default("info"),
  rawLogRetentionDays: z.coerce.number().default(7),
  frontendUrl: z.string().default("http://localhost:3110"),
});

const config = configSchema.parse({
  port: process.env.PORT,
  nodeEnv: process.env.NODE_ENV,
  databaseUrl: process.env.DATABASE_URL,
  logLevel: process.env.LOG_LEVEL,
  rawLogRetentionDays: process.env.RAW_LOG_RETENTION_DAYS,
  frontendUrl: process.env.FRONTEND_URL,
});

export default config;
