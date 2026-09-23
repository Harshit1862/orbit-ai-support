"use client";

import { useOrbit } from "@/components/orbit/OrbitProvider";
import { Badge, Button, Card } from "@/components/orbit/ui";
import type { IntegrationId } from "@/lib/orbit/model";

const INTEGRATIONS: { id: IntegrationId; name: string; description: string; logo: string }[] = [
  { id: "slack", name: "Slack", description: "Get task updates and mentions in your Slack channels.", logo: "from-fuchsia-500 to-amber-400" },
  { id: "drive", name: "Google Drive", description: "Attach Drive files to tasks and projects.", logo: "from-emerald-400 to-sky-500" },
  { id: "github", name: "GitHub", description: "Link pull requests and issues to tasks.", logo: "from-slate-400 to-slate-700" },
  { id: "zapier", name: "Zapier", description: "Connect Orbit to thousands of other apps.", logo: "from-orange-400 to-red-500" },
];

export default function IntegrationsPage() {
  const { data, toggleIntegration } = useOrbit();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {INTEGRATIONS.map((integration) => {
        const connected = data.integrations[integration.id];
        return (
          <Card key={integration.id}>
            <div className="flex items-start gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white ${integration.logo}`}>
                {integration.name[0]}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-medium text-white">{integration.name}</h2>
                  {connected && <Badge tone="green">Connected</Badge>}
                </div>
                <p className="mt-1 text-sm text-slate-400">{integration.description}</p>
              </div>
            </div>
            <Button className="mt-4" variant={connected ? "secondary" : "primary"} onClick={() => toggleIntegration(integration.id)}>
              {connected ? "Disconnect" : "Connect"}
            </Button>
          </Card>
        );
      })}
      <p className="text-sm text-slate-500 sm:col-span-2">Need something else? Only the four integrations above are supported today.</p>
    </div>
  );
}
