import type { ReactNode } from "react";

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-x-10 gap-y-4 border-t border-black/[0.08] py-8 first:border-t-0 first:pt-0 md:grid-cols-[220px_minmax(0,1fr)] dark:border-white/[0.08]">
      <div className="space-y-1">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {title}
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
      </div>
      <div className="max-w-md">{children}</div>
    </section>
  );
}
