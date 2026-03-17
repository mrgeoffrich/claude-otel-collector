import fs from "fs/promises";
import path from "path";
import { appLogger } from "../lib/logger";

const DATA_DIR = path.resolve(process.cwd(), "data");

/**
 * Write raw OTLP request body to disk before any parsing.
 * Fire-and-forget — errors are logged but don't block the response.
 */
export async function writeRawPayload(
  signal: "logs" | "metrics" | "traces",
  body: string | Buffer,
): Promise<void> {
  try {
    const timestamp = new Date().toISOString().replace(/:/g, "-");
    const dir = path.join(DATA_DIR, "raw", signal);
    const filePath = path.join(dir, `${timestamp}.json`);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, body);
  } catch (err) {
    appLogger.error({ err, signal }, "Failed to write raw payload to disk");
  }
}
