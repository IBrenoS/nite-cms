"use client";

import {
  Avatar,
  AvatarFallback,
  StatusBadge,
  type StatusBadgeTone,
} from "@nite/cms-ui";

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
    <Avatar size="md" aria-hidden="true">
      <AvatarFallback className="font-mono uppercase">
        {memberInitials(displayName)}
      </AvatarFallback>
    </Avatar>
  );
}

type MembershipRowStatusProps = {
  active: boolean;
};

function MembershipRowStatus({ active }: MembershipRowStatusProps) {
  const tone: StatusBadgeTone = active ? "done" : "quiet";
  const status = active ? "done" : "archived";
  const label = active ? "Ativa" : "Inativa";
  return <StatusBadge status={status} tone={tone} size="sm" label={label} />;
}

export { MembershipAvatar, MembershipRowStatus };
