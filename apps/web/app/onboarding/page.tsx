"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckIcon, Loader2 } from "lucide-react";

import { VigilMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";
import { getApiErrorMessage } from "@/lib/api/errors";
import { createInvitationApi } from "@/lib/api/invitations";
import {
  completeOnboardingApi,
  getOrganizationApi,
} from "@/lib/api/organization";
import { updatePolicyApi } from "@/lib/api/policies";
import { createScheduleApi } from "@/lib/api/schedules";
import {
  createServiceWithDefaultPolicyApi,
  sendTestAlertApi,
} from "@/lib/api/services";
import { createTeamApi } from "@/lib/api/teams";
import { canManageMembers } from "@/lib/roles";
import { cn } from "@/lib/utils";

const STEPS = ["Team", "Service", "Schedule", "Test"];

// "2026-01-05" for a date, as the API wants it.
const toDateInput = (date: Date) =>
  new Intl.DateTimeFormat("en-CA").format(date);

// The first thing a new organization sees: four small steps that end with a
// real alert landing in the person's inbox. Every step can be skipped.
export default function OnboardingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();

  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [teamName, setTeamName] = useState("Platform Team");
  const [invites, setInvites] = useState("");
  const [serviceName, setServiceName] = useState("Checkout API");
  const [handoffTime, setHandoffTime] = useState("10:00");

  // What the earlier steps created, for the later ones to build on.
  const [team, setTeam] = useState<{ id: string; name: string } | null>(null);
  const [service, setService] = useState<{ id: string; name: string } | null>(null);
  const [policyId, setPolicyId] = useState<string | null>(null);
  const [incidentNumber, setIncidentNumber] = useState<number | null>(null);

  const { data: organization } = useQuery({
    queryKey: ["organization"],
    queryFn: async () => (await getOrganizationApi()).data,
  });

  // People who can't set things up, and organizations that already did,
  // don't belong here.
  const allowed = canManageMembers(session?.role);
  const alreadyDone = !!organization?.onboardingCompletedAt;
  useEffect(() => {
    if (session && (!allowed || alreadyDone)) router.replace("/dashboard");
  }, [session, allowed, alreadyDone, router]);

  const finish = useMutation({
    mutationFn: () => completeOnboardingApi(),
    onSettled: () => {
      queryClient.invalidateQueries();
      router.push("/dashboard");
    },
  });

  const next = useMutation({
    mutationFn: async () => {
      const me = session!.user;

      if (step === 0) {
        const created = (
          await createTeamApi({ name: teamName.trim(), memberIds: [me.id] })
        ).data;
        setTeam({ id: created.id, name: created.name });

        const emails = invites
          .split(/[\s,]+/)
          .map((email) => email.trim())
          .filter(Boolean);
        for (const email of emails) {
          // An invite that fails shouldn't block setup; it can be re-sent
          // from the Members page.
          await createInvitationApi(email, "RESPONDER").catch(() =>
            toast.error(`Couldn't invite ${email}`),
          );
        }
      }

      if (step === 1) {
        const created = (
          await createServiceWithDefaultPolicyApi({
            name: serviceName.trim(),
            teamId: team!.id,
          })
        ).data;
        setService(created.service);
        setPolicyId(created.escalationPolicy.id);
      }

      if (step === 2) {
        // Starting a week back means the rotation is already running, so
        // someone is on call straight away.
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const schedule = (
          await createScheduleApi({
            name: `${team!.name} on-call`,
            teamId: team!.id,
            timezone: me.timezone,
            rotationType: "WEEKLY",
            handoffDay: 1,
            handoffTime,
            startDate: toDateInput(weekAgo),
            participantIds: [me.id],
          })
        ).data;

        // Point the service's policy at whoever is on call.
        await updatePolicyApi(policyId!, {
          steps: [
            {
              position: 1,
              delayMinutes: 15,
              targetType: "SCHEDULE",
              targetId: schedule.id,
            },
          ],
        });
      }

      if (step === 3) {
        const result = (await sendTestAlertApi(service!.id)).data;
        setIncidentNumber(result.incidentNumber);
        return;
      }

      setStep(step + 1);
    },
    onMutate: () => setError(null),
    onError: (err) =>
      setError(getApiErrorMessage(err, "That didn't work. Please try again.")),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 0 && teamName.trim().length < 2) {
      setError("Team name must be at least 2 characters");
      return;
    }
    if (step === 1 && serviceName.trim().length < 2) {
      setError("Service name must be at least 2 characters");
      return;
    }
    next.mutate();
  };

  if (!session || !organization || !allowed || alreadyDone) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  const firstName = session.user.name.split(" ")[0];
  const busy = next.isPending || finish.isPending;
  const sent = incidentNumber !== null;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg">
        <p className="flex items-center gap-2 text-[15px] leading-none font-semibold tracking-[0.22em] text-foreground">
          <VigilMark />
          VIGIL
        </p>
        <h1 className="mt-8 text-3xl font-semibold text-foreground">
          Welcome to Vigil, {firstName}
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          Four short steps and you&apos;ll have seen a real alert reach your
          inbox.
        </p>

        <ol className="mt-7 flex items-center">
          {STEPS.map((label, index) => (
            <li
              key={label}
              className={cn("flex items-center", index > 0 && "flex-1")}
            >
              {index > 0 && (
                <span
                  className={cn(
                    "mx-2 h-px flex-1",
                    index <= step ? "bg-emerald-500" : "bg-black/10 dark:bg-white/10",
                  )}
                />
              )}
              <span
                aria-current={index === step ? "step" : undefined}
                className="flex items-center gap-2 text-sm"
              >
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs font-medium",
                    index < step || (index === 3 && sent)
                      ? "bg-emerald-500 text-(--brand-foreground)"
                      : index === step
                        ? "border border-emerald-500 text-foreground"
                        : "border border-black/15 text-muted-foreground dark:border-white/15",
                  )}
                >
                  {index < step || (index === 3 && sent) ? (
                    <CheckIcon className="size-3.5" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className={cn(
                    "hidden sm:inline",
                    index === step ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              </span>
            </li>
          ))}
        </ol>

        <form
          onSubmit={submit}
          noValidate
          className="mt-7 rounded-xl border border-black/[0.08] p-6 dark:border-white/[0.08]"
        >
          <p className="text-xs font-medium text-muted-foreground">
            Step {step + 1} of 4
          </p>

          {step === 0 && (
            <div className="mt-2 space-y-4">
              <StepIntro
                title="Create your first team"
                text="A team is a group of people who share on-call duty."
              />
              <div className="space-y-2">
                <Label htmlFor="team-name">Team name</Label>
                <Input
                  id="team-name"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  autoComplete="off"
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invites">
                  Invite teammates
                  <span className="font-normal text-muted-foreground">
                    optional
                  </span>
                </Label>
                <Input
                  id="invites"
                  value={invites}
                  onChange={(e) => setInvites(e.target.value)}
                  placeholder="rahul@acme.com, sneha@acme.com"
                  autoComplete="off"
                  className="h-9"
                />
                <p className="text-sm text-muted-foreground">
                  Each gets an email with a link to join as a responder.
                </p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="mt-2 space-y-4">
              <StepIntro
                title="Add a service"
                text={`Something that can break: an API, a website, a database. Its alerts go to ${team?.name}.`}
              />
              <div className="space-y-2">
                <Label htmlFor="service-name">Service name</Label>
                <Input
                  id="service-name"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  autoComplete="off"
                  className="h-9"
                />
                <p className="text-sm text-muted-foreground">
                  It gets a simple escalation policy for now. You can change
                  who is notified later.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="mt-2 space-y-4">
              <StepIntro
                title="Set up an on-call rotation"
                text="People take turns being the one who gets the email. It starts with just you; add teammates to the rotation once they've joined."
              />
              <div className="space-y-2">
                <Label htmlFor="handoff-time">Hand over every Monday at</Label>
                <Input
                  id="handoff-time"
                  type="time"
                  value={handoffTime}
                  onChange={(e) => setHandoffTime(e.target.value)}
                  className="h-9 w-32"
                />
                <p className="text-sm text-muted-foreground">
                  In your timezone, {session.user.timezone.replaceAll("_", " ")}.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="mt-2 space-y-4">
              {sent ? (
                <StepIntro
                  title={`INC-${incidentNumber} is open`}
                  text={`Check ${session.user.email}: the email has Acknowledge and Resolve buttons that work without logging in. The incident is also on your dashboard.`}
                />
              ) : (
                <StepIntro
                  title="Send a test alert"
                  text={`This sends a real alert to ${service?.name}, exactly as a monitoring tool would. An incident opens and an email goes to ${session.user.email}.`}
                />
              )}
            </div>
          )}

          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

          <div className="mt-6 flex items-center justify-between gap-3">
            {sent ? (
              <span />
            ) : step === 2 ? (
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => setStep(3)}
                className="h-9 px-3 text-muted-foreground"
              >
                Skip this step
              </Button>
            ) : (
              <span />
            )}

            {sent ? (
              <Button
                type="button"
                disabled={busy}
                onClick={() => finish.mutate()}
                className="h-9 px-4"
              >
                {finish.isPending && <Loader2 className="size-4 animate-spin" />}
                Go to the dashboard
              </Button>
            ) : (
              <Button type="submit" disabled={busy} className="h-9 px-4">
                {next.isPending && <Loader2 className="size-4 animate-spin" />}
                {step === 3 ? "Send a test alert" : "Continue"}
              </Button>
            )}
          </div>
        </form>

        {!sent && (
          <p className="mt-5 text-center text-sm text-muted-foreground">
            <button
              type="button"
              disabled={busy}
              onClick={() => finish.mutate()}
              className="underline underline-offset-4 outline-none hover:text-foreground focus-visible:text-foreground"
            >
              Skip setup
            </button>
          </p>
        )}
      </div>
    </main>
  );
}

function StepIntro({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
