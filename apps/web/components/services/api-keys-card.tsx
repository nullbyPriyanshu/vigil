"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";

import { CreateApiKeyDialog } from "@/components/services/create-api-key-dialog";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getApiKeysApi,
  revokeApiKeyApi,
  type ApiKey,
} from "@/lib/api/services";
import { formatDate, timeAgo } from "@/lib/time";

// The service's API keys. Only rendered for owners and admins.
export function ApiKeysCard({ serviceId }: { serviceId: string }) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<ApiKey | null>(null);

  const { data: keys } = useQuery({
    queryKey: ["api-keys", serviceId],
    queryFn: async () => (await getApiKeysApi(serviceId)).data.data,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>API keys</CardTitle>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreating(true)}
            className="cursor-pointer"
          >
            <PlusIcon className="size-3.5" />
            New key
          </Button>
        </CardAction>
      </CardHeader>

      {!keys ? (
        <CardContent>
          <div className="h-12 animate-pulse rounded-lg bg-black/[0.04] dark:bg-white/[0.04]" />
        </CardContent>
      ) : keys.length === 0 ? (
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No keys yet. Create one to let a monitoring tool send alerts for
            this service.
          </p>
        </CardContent>
      ) : (
        <ul className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
          {keys.map((key) => (
            <li
              key={key.id}
              className="flex items-center gap-4 px-(--card-spacing) py-3"
            >
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-sm font-medium ${key.revokedAt ? "text-muted-foreground line-through" : "text-foreground"}`}
                >
                  {key.name}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  <span className="font-mono">vgl_live_{key.prefix}…</span>
                  {" · "}
                  {key.revokedAt
                    ? `Revoked ${formatDate(key.revokedAt)}`
                    : key.lastUsedAt
                      ? `Used ${timeAgo(key.lastUsedAt)}`
                      : "Never used"}
                </p>
              </div>
              {!key.revokedAt && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRevoking(key)}
                  className="shrink-0 cursor-pointer text-muted-foreground"
                >
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <CreateApiKeyDialog
          serviceId={serviceId}
          onClose={() => setCreating(false)}
        />
      )}
      {revoking && (
        <ConfirmDeleteDialog
          name={revoking.name}
          title={`Revoke ${revoking.name}?`}
          description="Anything still sending alerts with this key is refused straight away. This can't be undone; you'd create a new key instead."
          actionLabel="Revoke key"
          onDelete={() => revokeApiKeyApi(serviceId, revoking.id)}
          onDeleted={() => {
            queryClient.invalidateQueries({ queryKey: ["api-keys", serviceId] });
            toast.success(`${revoking.name} revoked`);
            setRevoking(null);
          }}
          onClose={() => setRevoking(null)}
        />
      )}
    </Card>
  );
}
