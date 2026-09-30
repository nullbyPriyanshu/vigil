"use client";

import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/shared/page-header";
import { SettingsSection } from "@/components/settings/settings-section";
import { ProfileForm } from "@/components/settings/profile-form";
import { PasswordForm } from "@/components/settings/password-form";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";
import { getProfileApi } from "@/lib/api/users";

const ROLE_LABELS = {
  OWNER: "Owner",
  ADMIN: "Admin",
  RESPONDER: "Responder",
  VIEWER: "Viewer",
} as const;

export default function ProfileSettingsPage() {
  const { session } = useAuth();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => (await getProfileApi()).data,
  });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Profile"
        description="Your name, timezone and password."
      />

      <div>
        <SettingsSection
          title="Personal details"
          description="How you appear to your team in schedules and incident timelines."
        >
          {isLoading || !profile ? (
            <div className="space-y-5">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : (
            <ProfileForm profile={profile} />
          )}
        </SettingsSection>

        <SettingsSection
          title="Password"
          description="Changing it signs you out on every other device."
        >
          <PasswordForm />
        </SettingsSection>

        <SettingsSection
          title="Account"
          description="Read-only. Ask an owner if your role needs to change."
        >
          <dl className="divide-y divide-black/[0.06] text-sm dark:divide-white/[0.06]">
            <Row label="Organization" value={session?.organization.name} />
            <Row label="Role" value={session ? ROLE_LABELS[session.role] : undefined} />
            <Row
              label="Member since"
              value={
                profile &&
                new Date(profile.createdAt).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              }
            />
          </dl>
        </SettingsSection>
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
