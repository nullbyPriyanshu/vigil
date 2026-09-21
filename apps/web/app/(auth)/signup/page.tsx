"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";

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
import { AuthBackground } from "@/components/auth/auth-background";

import { signupApi } from "@/lib/api/auth";
import { getApiErrorMessage } from "@/lib/api/errors";

const signupSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters" }),
  organizationName: z
    .string()
    .min(2, { message: "Organization name is required" }),
});

type SignupFormValues = z.infer<typeof signupSchema>;

const fieldClass = "h-11 px-3.5 text-[15px]";

export default function SignupPage() {
  const router = useRouter();

  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      organizationName: "",
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (values: SignupFormValues) => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const response = await signupApi({
        ...values,
        timezone,
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success("Account created. Please log in.");
      router.push("/login");
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(
          error,
          "Couldn't create your account. Please try again.",
        ),
      );
    },
  });

  const onSubmit = (values: SignupFormValues) => {
    signupMutation.mutate(values);
  };

  return (
    <AuthBackground>
      <div className="animate-card-in rounded-2xl border border-border bg-card p-7 shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_24px_48px_-12px_rgba(0,0,0,0.6)] sm:p-9">
        <div className="mb-6 space-y-1.5 text-center">
          <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
            Create your account
          </h1>
          <p className="text-sm text-muted-foreground">
            Set up your organization and start routing alerts to whoever is
            on call.
          </p>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-3.5"
            noValidate // let zod render our own messages instead of the browser's
          >
            {/* Name + organization side by side on wider screens.
                items-start keeps both columns' labels/inputs pinned to the
                top of their row instead of stretching to match whichever
                sibling's error message happens to be taller/wrap further. */}
            <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="!text-foreground">Full name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="John Doe"
                        autoComplete="name"
                        className={fieldClass}
                        {...field}
                      />
                    </FormControl>
                    {/* Fixed-height slot so a sibling field's error doesn't
                        shift this row's alignment or the rows below it. */}
                    <div className="min-h-5">
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="organizationName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="!text-foreground">Organization</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Acme Corp"
                        autoComplete="organization"
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
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="!text-foreground">Work email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="john@acme.com"
                      autoComplete="email"
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
                        placeholder="At least 6 characters"
                        autoComplete="new-password" // hints password managers to suggest a new one
                        className={`${fieldClass} pr-11`}
                        {...field}
                      />
                    </FormControl>
                    <button
                      type="button" // "button" so it doesn't submit the form
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

            <Button
              type="submit"
              disabled={signupMutation.isPending}
              className="mt-2 h-11 w-full cursor-pointer text-[15px] font-medium"
            >
              {signupMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create account"
              )}
            </Button>
          </form>
        </Form>

        <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
          By creating an account, you agree to our{" "}
          <Link
            href="/terms"
            className="text-foreground underline underline-offset-2 hover:text-foreground/80"
          >
            Terms
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            className="text-foreground underline underline-offset-2 hover:text-foreground/80"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </div>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Log in
        </Link>
      </p>
    </AuthBackground>
  );
}
