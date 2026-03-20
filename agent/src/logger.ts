export function log(
  level: "info" | "warn" | "error",
  message: string,
  data?: Record<string, unknown>
): void {
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg: message,
  };
  if (data !== undefined) {
    entry["data"] = data;
  }
  process.stdout.write(JSON.stringify(entry) + "\n");
}

export const logger = {
  info(message: string, data?: Record<string, unknown>): void {
    log("info", message, data);
  },
  warn(message: string, data?: Record<string, unknown>): void {
    log("warn", message, data);
  },
  error(message: string, data?: Record<string, unknown>): void {
    log("error", message, data);
  },
};
