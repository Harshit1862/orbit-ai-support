// Loads and saves the current visitor's workspace in Postgres.
import { headers } from "next/headers";
import { applyDueBilling, seedData, workspaceNow, type OrbitData } from "@/lib/orbit/model";
import { rateLimitWaitSeconds } from "@/lib/rateLimit";
import { sql } from "./db";
import { currentSessionHash } from "./session";

export interface StoredWorkspace {
  id: string;
  data: OrbitData;
  version: number;
}

/** A message that is safe to show to the user. */
export class WorkspaceError extends Error {}

/** New demo workspaces allowed per IP per minute, so a script can't fill the database. */
const MAX_NEW_WORKSPACES_PER_MINUTE = 10;

/**
 * The current visitor's workspace, created from the demo data on their first
 * visit. Renewals, scheduled downgrades and cancellations that fell due since
 * the last visit are applied (and saved) on the way.
 */
export async function loadWorkspace(): Promise<StoredWorkspace> {
  const sessionHash = await currentSessionHash();
  if (!sessionHash) throw new WorkspaceError("Your session has expired. Please reload the page.");

  let workspace = await findWorkspace(sessionHash);
  if (!workspace) {
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (rateLimitWaitSeconds(`new-workspace:${ip}`, MAX_NEW_WORKSPACES_PER_MINUTE) > 0) {
      throw new WorkspaceError("Too many new demo workspaces from your network. Please wait a minute and reload.");
    }
    // ON CONFLICT: two parallel first requests can't create two workspaces.
    await sql()`
      INSERT INTO workspaces (session_hash, data)
      VALUES (${sessionHash}, ${JSON.stringify(seedData(Date.now()))})
      ON CONFLICT (session_hash) DO NOTHING`;
    workspace = await findWorkspace(sessionHash);
    if (!workspace) throw new Error("Workspace was not created");
  }

  const due = applyDueBilling(workspace.data, workspaceNow(workspace.data));
  if (due !== workspace.data && (await saveWorkspace(workspace, due))) {
    workspace = { ...workspace, data: due, version: workspace.version + 1 };
  }
  return workspace;
}

/** The current visitor's workspace if they have one; never creates one. */
export async function currentWorkspace(): Promise<StoredWorkspace | null> {
  const sessionHash = await currentSessionHash();
  return sessionHash ? findWorkspace(sessionHash) : null;
}

async function findWorkspace(sessionHash: string): Promise<StoredWorkspace | null> {
  const rows = await sql()`
    UPDATE workspaces
    SET last_seen_at = now()
    WHERE session_hash = ${sessionHash}
    RETURNING id, data, version`;
  const row = rows[0];
  return row ? { id: row.id, data: row.data as OrbitData, version: row.version } : null;
}

/**
 * Saves new data only if nobody else saved since `workspace` was read
 * (optimistic concurrency). Returns false if it lost that race.
 */
export async function saveWorkspace(workspace: StoredWorkspace, data: OrbitData): Promise<boolean> {
  const rows = await sql()`
    UPDATE workspaces
    SET data = ${JSON.stringify(data)}, version = version + 1, updated_at = now()
    WHERE id = ${workspace.id} AND version = ${workspace.version}
    RETURNING version`;
  return rows.length === 1;
}
