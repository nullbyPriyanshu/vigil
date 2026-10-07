"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckIcon, CopyIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const KEY = "YOUR_API_KEY";

// How to point each tool at this service. `steps` is shown above the
// snippet, and `snippet` is what the Copy button copies.
function buildTabs(baseUrl: string) {
  return [
    {
      id: "curl",
      label: "curl",
      steps: "Run this from a terminal to send a test alert.",
      snippet: `curl -X POST ${baseUrl} \\
  -H "X-Vigil-Key: ${KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{"title": "Disk almost full", "severity": "high", "dedupKey": "disk-db-1"}'`,
    },
    {
      id: "sentry",
      label: "Sentry",
      steps:
        "In Sentry, open Settings, then Integrations, then Webhooks. Add this address, and add the header below under custom headers.",
      snippet: `${baseUrl}/sentry
X-Vigil-Key: ${KEY}`,
    },
    {
      id: "grafana",
      label: "Grafana",
      steps:
        "In Grafana, open Alerting, then Contact points, and add a Webhook contact point with this address and header.",
      snippet: `${baseUrl}/grafana
X-Vigil-Key: ${KEY}`,
    },
    {
      id: "uptimerobot",
      label: "UptimeRobot",
      steps:
        "In UptimeRobot, open Integrations, add a Webhook, and use this address with the header below.",
      snippet: `${baseUrl}/uptimerobot
X-Vigil-Key: ${KEY}`,
    },
  ];
}

// "Connect a tool": copy-and-paste instructions for sending alerts to this
// service, one tab per tool.
export function IntegrationCard() {
  const [active, setActive] = useState("curl");
  const [copied, setCopied] = useState(false);

  // Alerts go to the same address the app is on, under /api.
  const baseUrl =
    typeof window === "undefined"
      ? "/api/alerts"
      : `${window.location.origin}/api/alerts`;
  const tabs = buildTabs(baseUrl);
  const tab = tabs.find((t) => t.id === active) ?? tabs[0];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tab.snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Select the text and copy it by hand.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect a tool</CardTitle>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4">
        <div
          role="tablist"
          aria-label="Tool"
          className="flex w-fit max-w-full overflow-x-auto rounded-lg border border-black/[0.08] p-0.5 dark:border-white/[0.08]"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={t.id === tab.id}
              onClick={() => {
                setActive(t.id);
                setCopied(false);
              }}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60",
                t.id === tab.id
                  ? "bg-black/[0.06] font-medium text-foreground dark:bg-white/[0.08]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">{tab.steps}</p>

        <div className="relative">
          <pre className="rounded-lg bg-black/[0.04] p-3 pr-24 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-zinc-700 dark:bg-white/[0.04] dark:text-zinc-300">
            {tab.snippet}
          </pre>
          <Button
            variant="outline"
            size="sm"
            onClick={copy}
            className="absolute top-2 right-2"
          >
            {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Replace {KEY} with a key from the API keys card. A key is shown only
          once, when you create it.
        </p>
      </CardContent>
    </Card>
  );
}
