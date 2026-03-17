import { randomUUID } from "crypto";
import { Request, Response, NextFunction } from "express";

const REQUEST_ID_HEADER = "x-request-id";

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const requestId =
    (req.headers[REQUEST_ID_HEADER] as string) || randomUUID();
  (req as any).requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}

export function getRequestId(req: Request): string {
  return (req as any).requestId || "unknown";
}
