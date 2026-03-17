import { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { appLogger } from "./logger";
import { getRequestId } from "./request-id";
import config from "./config";

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler: ErrorRequestHandler = (
  error: AppError | ZodError | Error,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const requestId = getRequestId(req);

  if (error instanceof ZodError) {
    appLogger.warn(
      { requestId, path: req.path, errors: error.issues },
      "Validation error",
    );
    return res.status(400).json({
      error: "Validation failed",
      details: error.issues,
      requestId,
    });
  }

  if (error instanceof AppError && error.isOperational) {
    appLogger.warn(
      { requestId, path: req.path, message: error.message },
      "Operational error",
    );
    return res.status(error.statusCode).json({
      error: error.message,
      requestId,
    });
  }

  appLogger.error(
    { requestId, path: req.path, err: error },
    `Unexpected error: ${error.message}`,
  );

  const message =
    config.nodeEnv === "production" ? "Internal server error" : error.message;

  return res.status(500).json({ error: message, requestId });
};

export const notFoundHandler = (req: Request, res: Response) => {
  const requestId = getRequestId(req);
  res.status(404).json({ error: "Route not found", requestId });
};
