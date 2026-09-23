"use server";

// Server Functions: the browser calls these like normal async functions, and
// Next.js turns each call into a POST request to the server. Every change to a
// workspace goes through here, so the rules in lib/orbit/actions.ts run where
// the user can't tamper with them.
import { runAction } from "@/lib/orbit/actions";
import { workspaceNow, type OrbitData } from "@/lib/orbit/model";
import { rateLimitWaitSeconds } from "@/lib/rateLimit";
import { currentSessionHash } from "@/lib/server/session";
import { WorkspaceError, loadWorkspace, saveWorkspace } from "@/lib/server/workspaces";

export interface ActionResponse {
  /** Set when the action was refused (e.g. a plan limit); `data` is then unchanged. */
  error: string | null;
  data: OrbitData | null;
  now: number;
  version: number;
}

const MAX_ACTIONS_PER_MINUTE = 60;

export async function performAction(name: string, args: unknown): Promise<ActionResponse> {
  const failed = (error: string): ActionResponse => ({ error, data: null, now: Date.now(), version: 0 });
  try {
    const sessionHash = await currentSessionHash();
    if (sessionHash && rateLimitWaitSeconds(`action:${sessionHash}`, MAX_ACTIONS_PER_MINUTE) > 0) {
      return failed("You're doing that too quickly. Please wait a moment.");
    }
    // Read, apply, save. If another tab saved in between, the save is refused
    // and the action is retried on the fresh data.
    for (let attempt = 0; attempt < 3; attempt++) {
      const workspace = await loadWorkspace();
      const result = runAction(name, workspace.data, workspaceNow(workspace.data), args);
      if (typeof result === "string") {
        return { error: result, data: workspace.data, now: workspaceNow(workspace.data), version: workspace.version };
      }
      if (await saveWorkspace(workspace, result)) {
        return { error: null, data: result, now: workspaceNow(result), version: workspace.version + 1 };
      }
    }
    return failed("Your workspace was changed in another tab. Please try again.");
  } catch (err) {
    if (err instanceof WorkspaceError) return failed(err.message);
    console.error("[action]", name, err);
    return failed("Couldn't save your change. Please try again.");
  }
}
