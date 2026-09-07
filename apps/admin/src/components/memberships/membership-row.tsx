"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@nite/cms-ui";

import {
  updateMembershipActive,
  updateMembershipRole,
} from "@/app/(workspace)/memberships/actions";
import type { Membership } from "./memberships.types";
import { MembershipAvatar, MembershipRowStatus } from "./membership-ui-atoms";

type MembershipRowProps = {
  membership: Membership;
  isLast: boolean;
};

export function MembershipRow({ membership, isLast }: MembershipRowProps) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);
  const router = useRouter();

  function handleResult(result: { status: string; message?: string }) {
    if (result.status === "success") {
      setFeedback(null);
      router.refresh();
    } else {
      setFeedback({
        type: "error",
        message: result.message ?? "Erro desconhecido.",
      });
    }
  }

  return (
    <>
      <tr
        className={`grid grid-cols-[1fr_130px_90px_90px] items-center gap-3 px-4 py-3 transition-colors hover:bg-nite-section/30 ${!isLast ? "border-b border-nite-border-subtle" : ""} ${isPending ? "opacity-60" : ""}`}
      >
        {/* Member */}
        <td className="flex min-w-0 items-center gap-2.5">
          <MembershipAvatar displayName={membership.displayName} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-nite-text-primary">
              {membership.displayName}
            </p>
            <p className="truncate font-mono text-[11px] text-nite-text-muted">
              {membership.email ?? membership.objectId}
            </p>
          </div>
        </td>

        {/* Role */}
        <td>
          <select
            aria-label={`Papel de ${membership.displayName}`}
            value={membership.role}
            disabled={isPending}
            onChange={(e) =>
              startTransition(async () =>
                handleResult(
                  await updateMembershipRole({
                    objectId: membership.objectId,
                    role: e.target.value,
                  }),
                ),
              )
            }
            className="nite-form-field h-8 rounded-md border border-nite-border-subtle bg-transparent px-2 text-xs font-medium text-nite-text-primary focus:outline-none focus:ring-2 focus:ring-nite-brand-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="publisher">Publisher</option>
            <option value="admin">Admin</option>
          </select>
        </td>

        {/* Status */}
        <td>
          <MembershipRowStatus active={membership.active} />
        </td>

        {/* Actions */}
        <td className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant={membership.active ? "quiet" : "secondary"}
            loading={isPending}
            onClick={() =>
              startTransition(async () =>
                handleResult(
                  await updateMembershipActive({
                    objectId: membership.objectId,
                    active: !membership.active,
                  }),
                ),
              )
            }
            className={
              membership.active
                ? "text-nite-text-secondary hover:text-status-error hover:border-status-error/40"
                : ""
            }
          >
            {membership.active ? "Desativar" : "Ativar"}
          </Button>
        </td>
      </tr>

      {/* Inline error feedback for this row */}
      {feedback?.type === "error" ? (
        <tr role="alert" aria-live="assertive" className="block">
          <td colSpan={4} className="block px-4 pb-2 text-xs text-status-error">
            {feedback.message}
          </td>
        </tr>
      ) : null}
    </>
  );
}
