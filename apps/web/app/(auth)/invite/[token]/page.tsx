"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isAxiosError } from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, TriangleAlert } from "lucide-react";

import { BackToLogin } from "@/components/auth/back-to-login";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";
import { logoutApi, refreshSessionApi } from "@/lib/api/auth";
import { getApiErrorMessage } from "@/lib/api/errors";
import {
  acceptInvitationApi,
  getInvitationPreviewApi,
  type InvitationPreview,
} from "@/lib/api/invitations";
import { ROLE_LABELS } from "@/lib/roles";
import { passwordSchema } from "@/lib/validation/password";

const fieldClass = "h-11 px-3.5 text-[15px]";
const submitClass = "h-11 w-full cursor-pointer text-[15px] font-medium";

// Opened from the invitation email: /invite/{token}
export default function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);

  const { data: preview, error, isLoading } = useQuery({
    queryKey: ["invitation", token],
    queryFn: async () => (await getInvitationPreviewApi(token)).data,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="mt-6 h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    );
  }

  if (!preview) {
    // 410 = the link was real but can't be used any more; the API says why.
    const gone = isAxiosError(error) && error.response?.status === 410;
    return (
      <Unavailable
        title={gone ? "This invitation is no longer valid" : "Invitation not found"}
        message={
          gone
            ? `${getApiErrorMessage(error, "It can't be used any more")}. Ask the person who invited you to send a new one.`
            : "This link doesn't match any invitation. Check that you copied the whole link from the email."
        }
      />
    );
  }

  return (
    <>
      <div className="animate-card-in">
        <div className="mb-8 space-y-1.5">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Join{" "}
            <span className="text-emerald-600 dark:text-emerald-400">
              {preview.organization.name}
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            You&apos;ve been invited to join as{" "}
            {/^[aeiou]/i.test(ROLE_LABELS[preview.role]) ? "an" : "a"}{" "}
            <span className="font-medium text-foreground">
              {ROLE_LABELS[preview.role].toLowerCase()}
            </span>
            . This invitation is for{" "}
            <span className="font-medium text-foreground">{preview.email}</span>
            .
          </p>
        </div>

        {preview.hasAccount ? (
          <ExistingAccount token={token} preview={preview} />
        ) : (
          <NewAccount token={token} />
        )}
      </div>

      {!preview.hasAccount && (
        <p className="mt-6 text-sm text-muted-foreground">
          By joining, you&apos;ll create a Vigil account for {preview.email}.
        </p>
      )}
    </>
  );
}

// After a successful accept the browser holds a session for the new
// organization, so everything cached from before is thrown away.
function useFinishJoining(organizationName: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return async () => {
    await queryClient.resetQueries();
    toast.success(`Welcome to ${organizationName}`);
    router.push("/dashboard");
  };
}

// ---------- No account yet: create one ----------

const newAccountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Name must be at least 2 characters" })
    .max(100, { message: "Name must be at most 100 characters" }),
  password: passwordSchema,
});

type NewAccountValues = z.infer<typeof newAccountSchema>;

function NewAccount({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const organizationName =
    queryClient.getQueryData<InvitationPreview>(["invitation", token])
      ?.organization.name ?? "your team";
  const finish = useFinishJoining(organizationName);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<NewAccountValues>({
    resolver: zodResolver(newAccountSchema),
    defaultValues: { name: "", password: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: NewAccountValues) =>
      acceptInvitationApi(token, {
        name: values.name,
        password: values.password,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    onSuccess: finish,
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Couldn't accept the invitation."));
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        className="space-y-3.5"
        noValidate
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="!text-foreground">Full name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Alex Smith"
                  autoComplete="name"
                  autoFocus
                  className={fieldClass}
                  {...field}
                />
              </FormControl>
              <div className="min-h-5">
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="!text-foreground">Password</FormLabel>
              <div className="relative">
                <FormControl>
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    className={`${fieldClass} pr-11`}
                    {...field}
                  />
                </FormControl>
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center rounded-r-lg text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              <div className="min-h-5">
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        <Button
          type="submit"
          disabled={mutation.isPending}
          className={`mt-2 ${submitClass}`}
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Joining...
            </>
          ) : (
            "Create account and join"
          )}
        </Button>
      </form>
    </Form>
  );
}

// ---------- Already has an account ----------

function ExistingAccount({
  token,
  preview,
}: {
  token: string;
  preview: InvitationPreview;
}) {
  const { session, loading } = useAuth();

  if (loading) return <Skeleton className="h-11 w-full" />;

  if (!session) return <AcceptWithPassword token={token} preview={preview} />;

  if (session.user.email !== preview.email) {
    return <WrongAccount signedInAs={session.user.email} invitedEmail={preview.email} />;
  }

  return <AcceptWhileLoggedIn token={token} preview={preview} />;
}

function AcceptWhileLoggedIn({
  token,
  preview,
}: {
  token: string;
  preview: InvitationPreview;
}) {
  const finish = useFinishJoining(preview.organization.name);

  const mutation = useMutation({
    mutationFn: async () => {
      try {
        return await acceptInvitationApi(token, {});
      } catch (error) {
        // The login token may have expired while this page sat open. Renew
        // it once and try again before giving up.
        if (isAxiosError(error) && error.response?.status === 401) {
          await refreshSessionApi();
          return acceptInvitationApi(token, {});
        }
        throw error;
      }
    },
    onSuccess: finish,
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Couldn't accept the invitation."));
    },
  });

  return (
    <>
      <p className="mb-5 text-sm text-muted-foreground">
        You&apos;re signed in as{" "}
        <span className="font-medium text-foreground">{preview.email}</span>.
      </p>
      <Button
        type="button"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
        className={submitClass}
      >
        {mutation.isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Joining...
          </>
        ) : (
          "Accept invitation"
        )}
      </Button>
    </>
  );
}

const passwordOnlySchema = z.object({
  currentPassword: z.string().min(1, { message: "Enter your password" }),
});

type PasswordOnlyValues = z.infer<typeof passwordOnlySchema>;

function AcceptWithPassword({
  token,
  preview,
}: {
  token: string;
  preview: InvitationPreview;
}) {
  const finish = useFinishJoining(preview.organization.name);

  const form = useForm<PasswordOnlyValues>({
    resolver: zodResolver(passwordOnlySchema),
    defaultValues: { currentPassword: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: PasswordOnlyValues) =>
      acceptInvitationApi(token, { currentPassword: values.currentPassword }),
    onSuccess: finish,
    onError: (error) => {
      const message = getApiErrorMessage(
        error,
        "Couldn't accept the invitation.",
      );
      if (message === "Incorrect password") {
        form.setError("currentPassword", { message }, { shouldFocus: true });
      } else {
        toast.error(message);
      }
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        className="space-y-3.5"
        noValidate
      >
        <p className="text-sm text-muted-foreground">
          You already have a Vigil account. Enter its password to join.
        </p>

        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel className="!text-foreground">Password</FormLabel>
                <Link
                  href="/forgot-password"
                  className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  autoFocus
                  className={fieldClass}
                  {...field}
                />
              </FormControl>
              <div className="min-h-5">
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        <Button
          type="submit"
          disabled={mutation.isPending}
          className={`mt-2 ${submitClass}`}
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Joining...
            </>
          ) : (
            "Accept invitation"
          )}
        </Button>
      </form>
    </Form>
  );
}

function WrongAccount({
  signedInAs,
  invitedEmail,
}: {
  signedInAs: string;
  invitedEmail: string;
}) {
  const queryClient = useQueryClient();

  const logout = useMutation({
    mutationFn: logoutApi,
    // Stay on this page: once logged out it offers the right way to accept.
    onSuccess: () => queryClient.resetQueries(),
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Couldn't log out."));
    },
  });

  return (
    <>
      <p className="mb-5 text-sm text-muted-foreground">
        You&apos;re signed in as{" "}
        <span className="font-medium text-foreground">{signedInAs}</span>, but
        this invitation was sent to{" "}
        <span className="font-medium text-foreground">{invitedEmail}</span>.
        Log out to accept it with the right account.
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={logout.isPending}
        onClick={() => logout.mutate()}
        className={submitClass}
      >
        {logout.isPending && <Loader2 className="size-4 animate-spin" />}
        Log out
      </Button>
    </>
  );
}

function Unavailable({ title, message }: { title: string; message: string }) {
  return (
    <>
      <div className="animate-card-in">
        <div className="mb-6 flex size-11 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
          <TriangleAlert className="size-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
      <BackToLogin />
    </>
  );
}
