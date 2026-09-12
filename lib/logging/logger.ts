/**
 * Structured server-side logging skeleton (architecture §14; security.md §21).
 *
 * Phase 0 provides the shape only — one JSON line per event, carrying
 * correlation identifiers and never content. There is no domain logic here.
 *
 * Hard rule this module exists to make easy: log identifiers, not content.
 * Never media bytes, signed URLs, tokens, the service-role key, caption or
 * comment text, or email addresses.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  /** Correlates one request across layers. */
  requestId?: string;
  /** The acting user, where one is established. */
  userId?: string;
  /** The batch a request concerns, where one applies. */
  batchId?: string;
  /** Additional identifiers only — never user content. */
  [key: string]: string | number | boolean | undefined;
}

export interface LogEvent extends LogContext {
  level: LogLevel;
  event: string;
  timestamp: string;
}

export function buildLogEvent(
  level: LogLevel,
  event: string,
  context: LogContext = {},
  now: Date = new Date(),
): LogEvent {
  const entries = Object.entries(context).filter(
    ([, value]) => value !== undefined,
  );

  return {
    ...Object.fromEntries(entries),
    level,
    event,
    timestamp: now.toISOString(),
  };
}

function emit(level: LogLevel, event: string, context?: LogContext): void {
  const line = JSON.stringify(buildLogEvent(level, event, context));
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

export const logger = {
  debug: (event: string, context?: LogContext) => emit("debug", event, context),
  info: (event: string, context?: LogContext) => emit("info", event, context),
  warn: (event: string, context?: LogContext) => emit("warn", event, context),
  error: (event: string, context?: LogContext) => emit("error", event, context),
};
