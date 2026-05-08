import { isProduction } from "./config";

export const logger = {
  debug(message: string, context?: unknown) {
    if (!isProduction) {
      console.debug(message, context ?? "");
    }
  },
  error(message: string, error?: unknown) {
    console.error(message, sanitizeError(error));
  }
};

export function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unexpected error";
}
