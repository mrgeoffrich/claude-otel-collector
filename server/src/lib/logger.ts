import pino from "pino";
import config from "./config";

const isTest = config.nodeEnv === "test";
const isDev = config.nodeEnv === "development";

export const appLogger = pino({
  level: isTest ? "silent" : config.logLevel,
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:HH:MM:ss",
          ignore: "pid,hostname",
        },
      }
    : undefined,
});

export const httpLogger = pino({
  level: isTest ? "silent" : config.logLevel,
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:HH:MM:ss",
          ignore: "pid,hostname",
        },
      }
    : undefined,
});
