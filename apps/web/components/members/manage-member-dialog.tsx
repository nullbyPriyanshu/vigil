"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/api/errors";
import { updateMemberRoleApi, type Member } from "@/lib/api/members";
import {
  ASSIGNABLE_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type AssignableRole,
} from "@/lib/roles";

const ROLE_ITEMS = ASSIGNABLE_ROLES.map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
}));

// Opened from the pencil button on a member's row. Changes their role, and
// is the way in to removing them.
export function ManageMemberDialog({
  member,
  onClose,
  onRemove,
}: {
  member: Member;
  onClose: () => void;
  onRemove: () => void;
}) {
  const queryClient = useQueryClient();
  const [role, setRole] = useState(member.role as AssignableRole);

  const mutation = useMutation({
    mutationFn: () => updateMemberRoleApi(member.userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success(`${member.name} is now ${ROLE_LABELS[role].toLowerCase()}`);
      onClose();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Couldn't change the role."));
    },
  });

  const changed = role !== member.role;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage member</DialogTitle>
          <DialogDescription>
            Change what this person can do, or remove them.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-lg border border-black/[0.08] px-3 py-2.5 dark:border-white/[0.08]">
          <UserAvatar name={member.name} className="size-9 text-xs" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {member.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {member.email}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="member-role">Role</Label>
          <Select
            items={ROLE_ITEMS}
            value={role}
            onValueChange={(value) => setRole(value as AssignableRole)}
          >
            <SelectTrigger
              id="member-role"
              className="w-full data-[size=default]:h-9"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {ROLE_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            {ROLE_DESCRIPTIONS[role]}
          </p>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-black/[0.08] pt-4 dark:border-white/[0.08]">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Remove member</p>
            <p className="text-sm text-muted-foreground">
              They lose access to this organization.
            </p>
          </div>
          <Button
            type="button"
            variant="destructive"
            onClick={onRemove}
            className="h-9 shrink-0 px-4"
          >
            Remove
          </Button>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" className="h-9 px-4" />}>
            Cancel
          </DialogClose>
          <Button
            type="button"
            disabled={!changed || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="h-9 px-4"
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Save role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
