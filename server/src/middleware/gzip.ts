import { Request, Response, NextFunction } from "express";
import zlib from "zlib";
import { promisify } from "util";

const gunzip = promisify(zlib.gunzip);

/**
 * Middleware to decompress gzip-encoded request bodies.
 * Runs on OTLP routes before body parsing.
 */
export async function decompressGzip(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.headers["content-encoding"] === "gzip") {
    try {
      const rawBody = req.body as Buffer;
      const decompressed = await gunzip(rawBody);
      (req as any).rawBody = decompressed;
      req.body = decompressed;
      delete req.headers["content-encoding"];
    } catch (err) {
      return res.status(400).json({ error: "Failed to decompress gzip body" });
    }
  } else {
    (req as any).rawBody = req.body;
  }
  next();
}
