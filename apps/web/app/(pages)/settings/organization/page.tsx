"use client";

import { useQuery } from "@tanstack/react-query";

import {
  SettingsPageTitle,
  SettingsSection,
} from "@/components/settings/settings-section";
import { OrganizationForm } from "@/components/settings/organization-form";
import { DeleteOrganizationDialog } from "@/components/settings/delete-organization-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";
import { getOrganizationApi } from "@/lib/api/organization";

export default function OrganizationSettingsPage() {
  const { session } = useAuth();
  const { data: organization, isLoading } = useQuery({
    queryKey: ["organization"],
    queryFn: async () => (await getOrganizationApi()).data,
  });

  const role = session?.role;
  const canEdit = role === "OWNER" || role === "ADMIN";
  const isOwner = role === "OWNER";

  return (
    <div>
      <SettingsPageTitle
        title="Your organization"
        description="Its name, details and ownership."
      />

      <div>
        <SettingsSection
          title="General"
          description="The name your team sees across Vigil."
        >
          {isLoading || !organization ? (
            <div className="space-y-5">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : (
            <OrganizationForm organization={organization} canEdit={canEdit} />
          )}
        </SettingsSection>

        <SettingsSection
          title="Details"
          description="Read-only information about this organization."
        >
          <dl className="divide-y divide-black/[0.06] text-sm dark:divide-white/[0.06]">
            <Row
              label="Members"
              value={organization && String(organization.memberCount)}
            />
            <Row
              label="Created"
              value={
                organization &&
                new Date(organization.createdAt).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              }
            />
          </dl>
        </SettingsSection>

        {isOwner && organization && (
          <SettingsSection
            title="Danger zone"
            description="Only the owner can do these. Take care, they affect everyone."
          >
            <div className="divide-y divide-red-500/15 rounded-lg border border-red-500/25">
              <DangerRow
                title="Transfer ownership"
                description={
                  organization.memberCount < 2
                    ? "You're the only member. Invite someone before you can hand over ownership."
                    : "Make another member the owner. You'll become an admin."
                }
              >
                {/* Needs a list of members to pick from, which arrives with
                    the members API. transferOwnershipApi is ready for it. */}
                <Button variant="outline" disabled className="h-9 px-4">
                  Transfer
                </Button>
              </DangerRow>

              <DangerRow
                title="Delete this organization"
                description="Permanently removes the organization and all of its data."
              >
                <DeleteOrganizationDialog name={organization.name} />
              </DangerRow>
            </div>
          </SettingsSection>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 first:pt-0">
      <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="text-zinc-900 dark:text-zinc-100">{value ?? "—"}</dd>
    </div>
  );
}

function DangerRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 p-4">
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {title}
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
      </div>
      {children}
    </div>
  );
}
