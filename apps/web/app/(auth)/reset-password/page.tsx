"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, TriangleAlert } from "lucide-react";

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
import { BackToLogin } from "@/components/auth/back-to-login";

import { resetPasswordApi } from "@/lib/api/auth";
import { getApiErrorMessage } from "@/lib/api/errors";
import { passwordSchema } from "@/lib/validation/password";

const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

const fieldClass = "h-11 px-3.5 text-[15px]";

// Opened from the email link: /reset-password?token=...
export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { token } = use(searchParams);

  if (typeof token !== "string" || !token) {
    return <InvalidLink />;
  }

  return <ResetPasswordForm token={token} />;
}

function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [linkExpired, setLinkExpired] = useState(false);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (values: ResetPasswordFormValues) =>
      (await resetPasswordApi(token, values.password)).data,
    onSuccess: () => {
      toast.success("Password updated. Please log in with your new password.");
      router.push("/login");
    },
    onError: (error) => {
      const message = getApiErrorMessage(
        error,
        "Couldn't reset your password. Please try again.",
      );
      // Expired or already-used links can't be retried, so swap the form
      // for a way to request a new one.
      if (message.toLowerCase().includes("expired")) {
        setLinkExpired(true);
      } else {
        toast.error(message);
      }
    },
  });

  if (linkExpired) return <InvalidLink />;

  return (
    <>
      <div className="animate-card-in">
        <div className="mb-8 space-y-1.5">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Set a new{" "}
            <span className="text-emerald-600 dark:text-emerald-400">
              password
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            You&apos;ll be logged out on every device once it&apos;s changed.
          </p>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) =>
              resetPasswordMutation.mutate(values),
            )}
            className="space-y-3.5"
            noValidate
          >
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="!text-foreground">
                    New password
                  </FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="At least 8 characters"
                        autoComplete="new-password"
                        autoFocus
                        className={`${fieldClass} pr-11`}
                        {...field}
                      />
                    </FormControl>
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center rounded-r-lg text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
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

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="!text-foreground">
                    Confirm password
                  </FormLabel>
                  <FormControl>
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Type it again"
                      autoComplete="new-password"
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
              disabled={resetPasswordMutation.isPending}
              className="mt-2 h-11 w-full cursor-pointer text-[15px] font-medium"
            >
              {resetPasswordMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Updating password...
                </>
              ) : (
                "Update password"
              )}
            </Button>
          </form>
        </Form>
      </div>

      <BackToLogin />
    </>
  );
}

function InvalidLink() {
  return (
    <>
      <div className="animate-card-in">
        <div className="mb-6 flex size-11 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
          <TriangleAlert className="size-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            This link has expired
          </h1>
          <p className="text-sm text-muted-foreground">
            Reset links work once and expire after 5 minutes. Request a new one
            and use it right away.
          </p>
        </div>

        <Button
          render={<Link href="/forgot-password" />}
          nativeButton={false}
          className="mt-8 h-11 w-full cursor-pointer text-[15px] font-medium"
        >
          Request a new link
        </Button>
      </div>

      <BackToLogin />
    </>
  );
}
