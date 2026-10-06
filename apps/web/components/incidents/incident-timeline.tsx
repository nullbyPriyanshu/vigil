"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getApiErrorMessage } from "@/lib/api/errors";
import {
  addIncidentNoteApi,
  getIncidentEventsApi,
  type IncidentEvent,
} from "@/lib/api/incidents";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";

// The dot's colour follows the status colours used everywhere else.
const DOT: Partial<Record<IncidentEvent["type"], string>> = {
  CREATED: "bg-red-500",
  ACKNOWLEDGED: "bg-amber-500",
  RESOLVED: "bg-emerald-500",
};

// Everything that happened to the incident, oldest first, with a box to
// add a comment at the end.
export function IncidentTimeline({
  incidentId,
  canRespond,
  live,
}: {
  incidentId: string;
  canRespond: boolean;
  // Keep checking for new events while the incident is still open.
  live: boolean;
}) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");

  const { data: events } = useQuery({
    queryKey: ["incident-events", incidentId],
    queryFn: async () => (await getIncidentEventsApi(incidentId)).data.data,
    refetchInterval: live ? 10 * 1000 : false,
    staleTime: 0,
  });

  const mutation = useMutation({
    mutationFn: () => addIncidentNoteApi(incidentId, message.trim()),
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["incident-events", incidentId] });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Couldn't add the comment."));
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {!events ? (
          <div className="h-24 animate-pulse rounded-lg bg-black/[0.04] dark:bg-white/[0.04]" />
        ) : (
          <ol>
            {events.map((event, index) => (
              <li key={event.id} className="relative flex gap-3.5 pb-5 last:pb-0">
                {index !== events.length - 1 && (
                  <span className="absolute top-6 bottom-0 left-3 w-px -translate-x-1/2 bg-black/10 dark:bg-white/10" />
                )}

                {event.type === "COMMENT" ? (
                  <UserAvatar
                    name={event.actor?.name ?? "Removed user"}
                    className="size-6 shrink-0 text-[9px]"
                  />
                ) : (
                  <span className="flex size-6 shrink-0 items-center justify-center">
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        DOT[event.type] ?? "bg-zinc-400 dark:bg-zinc-600",
                      )}
                    />
                  </span>
                )}

                <div className="min-w-0 flex-1 pt-0.5">
                  {event.type === "COMMENT" ? (
                    <>
                      <p className="text-sm">
                        <span className="font-medium text-foreground">
                          {event.actor?.name ?? "Removed user"}
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {formatDateTime(event.createdAt)}
                        </span>
                      </p>
                      <p className="mt-1 text-sm break-words whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                        {event.message}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-foreground">
                      {event.message}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {formatDateTime(event.createdAt)}
                      </span>
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}

        {canRespond && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (message.trim()) mutation.mutate();
            }}
            className="mt-5 border-t border-black/[0.06] pt-4 dark:border-white/[0.06]"
          >
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              rows={2}
              aria-label="Add a comment"
              placeholder="Add a comment for the team"
              className="w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
            />
            <div className="mt-2 flex justify-end">
              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={!message.trim() || mutation.isPending}
              >
                {mutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
                Comment
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
