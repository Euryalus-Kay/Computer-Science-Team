import { DatabaseNotConfigured } from "@/lib/db";

/** Runs `fn`, mapping a missing database to `null` so pages can show setup help. */
export async function orNotConfigured<T>(fn: () => Promise<T>): Promise<T | typeof NOT_CONFIGURED> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof DatabaseNotConfigured) return NOT_CONFIGURED;
    throw e;
  }
}
export const NOT_CONFIGURED = Symbol("not-configured");
