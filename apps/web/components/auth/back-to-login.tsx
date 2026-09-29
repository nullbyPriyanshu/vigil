import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function BackToLogin() {
  return (
    <Link
      href="/login"
      className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Back to log in
    </Link>
  );
}
