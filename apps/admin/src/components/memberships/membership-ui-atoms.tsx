"use client";

import { StatusBadge, type StatusBadgeTone } from "@nite/cms-ui";

import type { Membership } from "./memberships.types";

function memberInitials(displayName: string): string {
  return displayName
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();
}

type MembershipAvatarProps = {
  displayName: string;
};

function MembershipAvatar({ displayName }: MembershipAvatarProps) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-full bg-nite-section border border-nite-border-subtle font-mono text-[11px] font-semibold text-nite-text-secondary uppercase"
    >
      {memberInitials(displayName)}
    </span>
  );
}

type MembershipRowStatusProps = {
  active: boolean;
};

function MembershipRowStatus({ active }: MembershipRowStatusProps) {
  const tone: StatusBadgeTone = active ? "validated" : "quiet";
  const status = active ? "validated" : "archived";
  const label = active ? "Ativa" : "Inativa";
  return (
    <StatusBadge
      status={status}
      tone={tone}
      variant="outline"
      size="sm"
      label={label}
    />
  );
}

export { MembershipAvatar, MembershipRowStatus };
