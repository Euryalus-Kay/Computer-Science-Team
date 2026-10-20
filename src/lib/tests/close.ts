import { after } from "next/server";
import { finalizeAttempt } from "./attempts";
import { summarizeAttempt } from "@/lib/integrity/analyze";
import { gradePendingWithAi } from "@/lib/ai/grade";

/**
 * Closes an attempt and, once the response is sent, rebuilds its integrity summary
 * and sends written answers to Claude. Falls back to doing the summary inline when
 * called outside a request.
 */
export async function closeAttempt(attemptId: string, status: "submitted" | "expired") {
  const r = await finalizeAttempt(attemptId, status);
  if (!r || r.already) return r;
  const work = async () => {
    await summarizeAttempt(attemptId);
    if (r.pending.length) await gradePendingWithAi(attemptId);
  };
  try {
    after(work);
  } catch {
    await summarizeAttempt(attemptId);
  }
  return r;
}
