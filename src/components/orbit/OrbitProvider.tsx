"use client";

// Gives every Orbit screen the current workspace and the actions that change it.
//
// The data lives in Postgres; the server loads it for the first render
// (src/app/app/layout.tsx), and each action is sent to the server
// (src/app/app/actions.ts), which applies it and returns the saved result.
// Simple, predictable changes, like dragging a task, are also applied here
// straight away so the screen doesn't wait for the network.
import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import { performAction } from "@/app/app/actions";
import { ACTIONS, runAction, type ActionArgs, type ActionName } from "@/lib/orbit/actions";
import type { OrbitData } from "@/lib/orbit/model";

/** Actions whose outcome the browser can predict exactly (no limits, money or random values). */
const INSTANT: ReadonlySet<ActionName> = new Set([
  "updateTask",
  "deleteTask",
  "deleteProject",
  "toggleIntegration",
  "setTicketStatus",
  "acceptInvite",
  "renameWorkspace",
]);

type Actions = { [N in ActionName]: (...args: ActionArgs<N>) => Promise<string | null> };

type OrbitValue = { data: OrbitData; now: number } & Actions;

const OrbitContext = createContext<OrbitValue | null>(null);

interface WorkspaceState {
  data: OrbitData;
  /** The workspace's clock, which the demo can skip forward. */
  now: number;
  /** The saved version this data came from; older server replies are ignored. */
  version: number;
}

/** False during the server render, true in the browser. */
function useIsBrowser(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function OrbitProvider({ initial, children }: { initial: WorkspaceState; children: ReactNode }) {
  const [state, setState] = useState(initial);
  const isBrowser = useIsBrowser();

  /** Sends an action to the server; resolves to an error message to show, or null. */
  async function act(name: ActionName, args: unknown[]): Promise<string | null> {
    if (INSTANT.has(name)) {
      setState((s) => {
        const next = runAction(name, s.data, s.now, args);
        return typeof next === "string" ? s : { ...s, data: next };
      });
    }
    const response = await performAction(name, args);
    const { data } = response;
    if (data) {
      // Replies can arrive out of order; never replace newer data with older.
      setState((s) => (response.version >= s.version ? { data, now: response.now, version: response.version } : s));
    }
    return response.error;
  }

  const actions = Object.fromEntries(
    (Object.keys(ACTIONS) as ActionName[]).map((name) => [name, (...args: unknown[]) => act(name, args)]),
  ) as Actions;

  // The app shows dates and "Good morning" in the user's own timezone, which
  // the server (UTC on Vercel) doesn't know. Rendering the screens only in the
  // browser keeps the two from disagreeing (a React hydration error). The data
  // itself was already loaded on the server, so there's no extra request.
  if (!isBrowser) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#070812]">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-400" aria-label="Loading" />
      </div>
    );
  }

  return <OrbitContext.Provider value={{ data: state.data, now: state.now, ...actions }}>{children}</OrbitContext.Provider>;
}

export function useOrbit(): OrbitValue {
  const value = useContext(OrbitContext);
  if (!value) throw new Error("useOrbit must be used inside <OrbitProvider>");
  return value;
}
