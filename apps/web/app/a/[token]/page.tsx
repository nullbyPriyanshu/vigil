"use client";

import { use, useState } from "react";
import Link from "next/link";
import { isAxiosError } from "axios";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { StatusLabel } from "@/components/incidents/status-label";
import { SeverityBadge } from "@/components/shared/severity-badge";
import { Button } from "@/components/ui/button";
import {
  getActionLinkApi,
  performActionLinkApi,
  type ActionResult,
} from "@/lib/api/action-links";
import { getApiErrorMessage } from "@/lib/api/errors";

// Where the Acknowledge and Resolve buttons in an incident email lead. No
// login: the long token in the address is what proves who you are. Opening
// the page does nothing; only pressing the button performs the action.
export default function ActionLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [done, setDone] = useState<ActionResult | null>(null);
  // Set when the API refuses, e.g. someone else already acknowledged it.
  const [refused, setRefused] = useState<string | null>(null);

  const { data: link, error, isLoading } = useQuery({
    queryKey: ["action-link", token],
    queryFn: async () => (await getActionLinkApi(token)).data,
    retry: false,
    staleTime: Infinity,
  });

  const mutation = useMutation({
    mutationFn: async () => (await performActionLinkApi(token)).data,
    onSuccess: setDone,
    onError: (err) =>
      setRefused(getApiErrorMessage(err, "That didn't work. Please try again.")),
  });

  const verb = link?.action === "RESOLVE" ? "Resolve" : "Acknowledge";

  let body;
  if (isLoading) {
    body = <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />;
  } else if (!link) {
    const status = isAxiosError(error) ? error.response?.status : undefined;
    body = (
      <Message
        title={status === 410 ? "This link can't be used any more" : "This link isn't valid"}
        text={
          status === 410
            ? getApiErrorMessage(error, "It has expired or was already used.")
            : "Check that you opened the whole link from the email."
        }
      />
    );
  } else if (done) {
    body = (
      <Message
        title={`INC-${done.incident.number} ${done.incident.status === "RESOLVED" ? "resolved" : "acknowledged"}`}
        text={
          done.incident.status === "RESOLVED"
            ? "The incident is closed."
            : "Everyone can see you're on it. Escalation has stopped for you."
        }
        href={`/incidents/${done.incident.number}`}
      />
    );
  } else if (refused) {
    body = (
      <Message
        title={refused}
        text="Nothing was changed."
        href={`/incidents/${link.incident.number}`}
      />
    );
  } else {
    body = (
      <>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-sm text-zinc-500">
              INC-{link.incident.number}
            </span>
            <StatusLabel status={link.incident.status} />
            <SeverityBadge severity={link.incident.severity} />
          </div>
          <h1 className="text-lg font-semibold tracking-tight break-words text-foreground">
            {link.incident.title}
          </h1>
          <p className="text-sm text-muted-foreground">{link.incident.service}</p>
        </div>

        <Button
          variant={link.action === "ACKNOWLEDGE" ? "brand" : "default"}
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
          className="h-10 w-full"
        >
          {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
          {verb} incident
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          This will be recorded as done by {link.user.name}.
        </p>
      </>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center text-sm font-semibold tracking-[0.2em] text-foreground">
          VIGIL
        </p>
        <div className="space-y-5 rounded-xl border border-black/[0.08] p-6 dark:border-white/[0.08]">
          {body}
        </div>
      </div>
    </main>
  );
}

function Message({
  title,
  text,
  href,
}: {
  title: string;
  text: string;
  href?: string;
}) {
  return (
    <div className="space-y-4 text-center">
      <div className="space-y-1.5">
        <h1 className="text-base font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
      {href && (
        <Button variant="outline" className="h-9 px-4" render={<Link href={href} />}>
          Open the incident
        </Button>
      )}
    </div>
  );
}
