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
  isCurrent: boolean;
};

export function MembershipRow({
  membership,
  isLast,
  isCurrent,
}: MembershipRowProps) {
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
        className={`grid grid-cols-1 items-center gap-3 px-4 py-4 transition-colors hover:bg-nite-section/30 sm:grid-cols-[minmax(0,1fr)_auto] md:min-h-16 md:grid-cols-[minmax(180px,1fr)_150px_90px_90px] md:py-2.5 xl:grid-cols-[minmax(240px,1fr)_180px_100px_100px] xl:gap-4 xl:px-5 ${!isLast ? "border-b border-nite-border-subtle" : ""} ${isPending ? "opacity-60" : ""}`}
      >
        {/* Member */}
        <td className="flex min-w-0 items-center gap-2.5">
          <MembershipAvatar displayName={membership.displayName} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-nite-text-primary">
              {membership.displayName}
              {isCurrent ? (
                <span className="ml-2 text-xs font-medium text-nite-brand-accent">
                  Você
                </span>
              ) : null}
            </p>
            <p className="truncate font-mono text-xs text-nite-text-muted">
              {membership.email ?? membership.objectId}
            </p>
          </div>
        </td>

        {/* Role */}
        <td className="grid grid-cols-[88px_1fr] items-center gap-2 text-sm md:block">
          <span className="text-xs font-semibold text-nite-text-secondary md:sr-only">
            Nível
          </span>
          {isCurrent ? (
            <span className="text-sm font-medium text-nite-text-primary">
              {membership.role === "admin"
                ? "Acesso administrativo"
                : "Acesso editorial"}
            </span>
          ) : (
            <select
              aria-label={`Nível de acesso de ${membership.displayName}`}
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
              className="nite-form-field h-10 rounded-md border border-nite-border-subtle bg-transparent px-3 text-sm font-medium text-nite-text-primary focus:outline-none focus:ring-2 focus:ring-nite-brand-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="publisher">Acesso editorial</option>
              <option value="admin">Acesso administrativo</option>
            </select>
          )}
        </td>

        {/* Status */}
        <td className="grid grid-cols-[88px_1fr] items-center gap-2 md:block">
          <span className="text-xs font-semibold text-nite-text-secondary md:sr-only">
            Estado
          </span>
          <MembershipRowStatus active={membership.active} />
        </td>

        {/* Actions */}
        <td className="flex items-center justify-between gap-2 md:justify-end">
          <span className="text-xs font-semibold text-nite-text-secondary md:sr-only">
            Ação
          </span>
          {isCurrent ? (
            <span className="text-xs text-nite-text-secondary">
              Conta atual
            </span>
          ) : (
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
          )}
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
