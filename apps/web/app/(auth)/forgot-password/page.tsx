"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, MailCheck } from "lucide-react";

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

import { forgotPasswordApi } from "@/lib/api/auth";
import { getApiErrorMessage } from "@/lib/api/errors";

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

const fieldClass = "h-11 px-3.5 text-[15px]";

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: async (values: ForgotPasswordFormValues) =>
      (await forgotPasswordApi(values.email)).data,
    onSuccess: (_, values) => setSentTo(values.email),
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Something went wrong. Please try again."),
      );
    },
  });

  if (sentTo) {
    return (
      <>
        <div className="animate-card-in">
          <div className="mb-6 flex size-11 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
            <MailCheck className="size-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Check your email
            </h1>
            {/* The API gives the same answer whether or not the account
                exists, so the copy can't promise that an email was sent. */}
            <p className="text-sm text-muted-foreground">
              If an account exists for{" "}
              <span className="font-medium text-foreground">{sentTo}</span>,
              you&apos;ll get a link to reset your password. It expires in 5
              minutes.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => setSentTo(null)}
            className="mt-8 h-11 w-full cursor-pointer text-[15px] font-medium"
          >
            Use a different email
          </Button>
        </div>

        <BackToLogin />
      </>
    );
  }

  return (
    <>
      <div className="animate-card-in">
        <div className="mb-8 space-y-1.5">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Forgot your{" "}
            <span className="text-emerald-600 dark:text-emerald-400">
              password?
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your work email and we&apos;ll send you a link to reset it.
          </p>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) =>
              forgotPasswordMutation.mutate(values),
            )}
            className="space-y-3.5"
            noValidate
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="!text-foreground">Work email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
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
              disabled={forgotPasswordMutation.isPending}
              className="mt-2 h-11 w-full cursor-pointer text-[15px] font-medium"
            >
              {forgotPasswordMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Sending link...
                </>
              ) : (
                "Send reset link"
              )}
            </Button>
          </form>
        </Form>
      </div>

      <BackToLogin />
    </>
  );
}
