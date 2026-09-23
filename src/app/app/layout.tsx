import type { Metadata } from "next";
import AppShell from "@/components/orbit/AppShell";
import { workspaceNow } from "@/lib/orbit/model";
import { loadWorkspace } from "@/lib/server/workspaces";

export const metadata: Metadata = {
  title: "Orbit",
};

/** Loads this visitor's workspace from the database on the server, for the first render. */
export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const workspace = await loadWorkspace();
  return <AppShell initial={{ data: workspace.data, now: workspaceNow(workspace.data), version: workspace.version }}>{children}</AppShell>;
}
