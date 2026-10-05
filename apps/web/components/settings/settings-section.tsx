import type { ReactNode } from "react";

// The heading at the top of each settings page, e.g. "Profile".
export function SettingsPageTitle({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-8 border-b border-black/[0.08] pb-4 dark:border-white/[0.08]">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        {title}
      </h1>
      {description && (
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      )}
    </div>
  );
}

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
    <section className="border-t border-black/[0.08] py-8 first:border-t-0 first:pt-0 dark:border-white/[0.08]">
      <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {title}
      </h2>
      <p className="mt-1 mb-5 text-sm text-zinc-500 dark:text-zinc-400">
        {description}
      </p>
      <div className="max-w-md">{children}</div>
    </section>
  );
}
