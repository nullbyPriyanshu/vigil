"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon, ServerIcon } from "lucide-react";

import { ServiceFormDialog } from "@/components/services/service-form-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/context/auth-context";
import { getServicesApi } from "@/lib/api/services";
import { canManageMembers } from "@/lib/roles";

export default function ServicesPage() {
  const { session } = useAuth();
  const [creating, setCreating] = useState(false);

  const { data: services, isLoading } = useQuery({
    queryKey: ["services"],
    queryFn: async () => (await getServicesApi()).data.data,
  });

  const canManage = canManageMembers(session?.role);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Services"
        description="The things that can break. Each one belongs to a team and follows an escalation policy."
        action={
          canManage ? (
            <Button onClick={() => setCreating(true)} className="h-9 px-3.5">
              <PlusIcon className="size-4" />
              New service
            </Button>
          ) : undefined
        }
      />

      {isLoading || !services ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : services.length === 0 ? (
        <EmptyState
          icon={ServerIcon}
          title="No services yet"
          description={
            canManage
              ? "Add the first thing you want to be alerted about. You'll need a team and an escalation policy for it."
              : "An owner or admin can add services. They'll show up here."
          }
        />
      ) : (
        <Card className="gap-0 py-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-10 px-(--card-spacing) text-xs font-medium text-muted-foreground">
                  Service
                </TableHead>
                <TableHead className="h-10 px-3 text-xs font-medium text-muted-foreground">
                  Team
                </TableHead>
                <TableHead className="h-10 px-3 text-xs font-medium text-muted-foreground">
                  Escalation policy
                </TableHead>
                <TableHead className="h-10 px-(--card-spacing) text-right text-xs font-medium text-muted-foreground">
                  Open incidents
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service) => (
                <TableRow key={service.id}>
                  <TableCell className="max-w-72 px-(--card-spacing) py-3">
                    <Link
                      href={`/services/${service.id}`}
                      className="block truncate rounded-sm font-medium text-foreground outline-none hover:underline hover:underline-offset-4 focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                    >
                      {service.name}
                    </Link>
                    {service.description && (
                      <p className="mt-0.5 truncate text-muted-foreground">
                        {service.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-3 text-zinc-700 dark:text-zinc-300">
                    {service.team.name}
                  </TableCell>
                  <TableCell className="px-3 py-3 text-zinc-700 dark:text-zinc-300">
                    {service.escalationPolicy.name}
                  </TableCell>
                  <TableCell className="px-(--card-spacing) py-3 text-right text-muted-foreground tabular-nums">
                    {service.openIncidentCount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {creating && <ServiceFormDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
