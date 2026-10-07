"use client";

import { useState } from "react";
import { CheckIcon, SearchIcon } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Input } from "@/components/ui/input";
import type { Member } from "@/lib/api/members";
import { ROLE_LABELS } from "@/lib/roles";
import { cn } from "@/lib/utils";

// A scrollable checklist of the organization's members. Used both when
// creating a team and when changing who is on one. The parent owns the
// selection (a list of user ids) and gets told when it changes.
export function MemberPicker({
  members,
  selected,
  onChange,
}: {
  members: Member[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const visible = query
    ? members.filter(
        (member) =>
          member.name.toLowerCase().includes(query) ||
          member.email.toLowerCase().includes(query),
      )
    : members;

  const toggle = (userId: string) =>
    onChange(
      selected.includes(userId)
        ? selected.filter((id) => id !== userId)
        : [...selected, userId],
    );

  return (
    <div className="overflow-hidden rounded-lg border border-black/[0.08] dark:border-white/[0.08]">
      {/* Searching only earns its space once the list is long. */}
      {members.length > 6 && (
        <div className="relative border-b border-black/[0.08] dark:border-white/[0.08]">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            aria-label="Search members"
            className="h-9 rounded-none border-0 pl-8.5 focus-visible:ring-0 dark:bg-transparent"
          />
        </div>
      )}

      <ul className="max-h-60 overflow-y-auto p-1">
        {visible.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">
            Nobody matches &ldquo;{search.trim()}&rdquo;.
          </li>
        )}
        {visible.map((member) => {
          const checked = selected.includes(member.userId);
          return (
            <li key={member.userId}>
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggle(member.userId)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left outline-none transition-colors hover:bg-black/[0.03] focus-visible:bg-black/[0.04] dark:hover:bg-white/[0.04] dark:focus-visible:bg-white/[0.05]"
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                    checked
                      ? "border-emerald-500 bg-emerald-500 text-(--brand-foreground)"
                      : "border-black/25 dark:border-white/25",
                  )}
                >
                  {checked && <CheckIcon className="size-3" strokeWidth={3} />}
                </span>
                <UserAvatar name={member.name} className="size-7 text-[10px]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {member.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {member.email}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {ROLE_LABELS[member.role]}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
