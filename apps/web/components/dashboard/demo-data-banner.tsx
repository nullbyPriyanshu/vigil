"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { seedDemoDataApi } from "@/lib/api/analytics";
import { getApiErrorMessage } from "@/lib/api/errors";
import { getTeamsApi } from "@/lib/api/teams";

// Shown to the owner of a brand-new organization: one click fills it with
// example teams, services, a schedule and a month of incidents.
export function DemoDataBanner() {
  const queryClient = useQueryClient();

  const { data: teams } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => (await getTeamsApi()).data.data,
  });

  const mutation = useMutation({
    mutationFn: async () => (await seedDemoDataApi()).data,
    onSuccess: (result) => {
      // Nearly every screen has new data now.
      queryClient.invalidateQueries();
      toast.success(
        `Added ${result.incidents} incidents, ${result.services} services and ${result.teams} teams`,
      );
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      toast.error(getApiErrorMessage(error, "Couldn't load the demo data."));
    },
  });

  // Only for an organization with nothing in it yet.
  if (!teams || teams.length > 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-dashed border-black/15 px-5 py-4 dark:border-white/15">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">
          Nothing here yet
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Load example teams, services, a schedule and a month of incidents to
          see how everything fits together. No emails are sent.
        </p>
      </div>
      <Button
        variant="outline"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
        className="h-9 shrink-0 px-3.5"
      >
        {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
        Load demo data
      </Button>
    </div>
  );
}
