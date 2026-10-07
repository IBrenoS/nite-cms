"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Select, TableCell, TableRow } from "@nite/cms-ui";

import {
  updateMembershipActive,
  updateMembershipRole,
} from "@/app/(workspace)/memberships/actions";
import type { Membership } from "./memberships.types";
import { MembershipAvatar, MembershipRowStatus } from "./membership-ui-atoms";

type MembershipRowProps = {
  membership: Membership;
  isCurrent: boolean;
};

export function MembershipRow({ membership, isCurrent }: MembershipRowProps) {
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
      <TableRow
        className={`grid h-auto min-h-14 grid-cols-1 items-center gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(180px,1fr)_150px_90px_90px] md:py-2.5 xl:grid-cols-[minmax(240px,1fr)_180px_100px_100px] xl:gap-4 xl:px-5 ${isPending ? "opacity-60" : ""}`}
      >
        <TableCell className="flex min-w-0 items-center gap-2.5 p-0">
          <MembershipAvatar displayName={membership.displayName} />
          <div className="min-w-0">
            <p className="truncate text-ui-md font-semibold text-text-primary">
              {membership.displayName}
              {isCurrent ? (
                <span className="ml-2 text-ui-xs font-medium text-primary">
                  Você
                </span>
              ) : null}
            </p>
            <p className="truncate font-mono text-ui-xs text-text-muted">
              {membership.email ?? membership.objectId}
            </p>
          </div>
        </TableCell>

        <TableCell className="grid grid-cols-[88px_1fr] items-center gap-2 p-0 text-ui-md md:block">
          <span className="text-ui-sm font-semibold text-text-secondary md:sr-only">
            Nível
          </span>
          {isCurrent ? (
            <span className="text-ui-md font-medium text-text-primary">
              {membership.role === "admin"
                ? "Acesso administrativo"
                : "Acesso editorial"}
            </span>
          ) : (
            <Select
              aria-label={`Nível de acesso de ${membership.displayName}`}
              value={membership.role}
              disabled={isPending}
              onChange={(event) =>
                startTransition(async () =>
                  handleResult(
                    await updateMembershipRole({
                      objectId: membership.objectId,
                      role: event.target.value,
                    }),
                  ),
                )
              }
              className="font-medium"
            >
              <option value="publisher">Acesso editorial</option>
              <option value="admin">Acesso administrativo</option>
            </Select>
          )}
        </TableCell>

        <TableCell className="grid grid-cols-[88px_1fr] items-center gap-2 p-0 md:block">
          <span className="text-ui-sm font-semibold text-text-secondary md:sr-only">
            Estado
          </span>
          <MembershipRowStatus active={membership.active} />
        </TableCell>

        <TableCell className="flex items-center justify-between gap-2 p-0 md:justify-end">
          <span className="text-ui-sm font-semibold text-text-secondary md:sr-only">
            Ação
          </span>
          {isCurrent ? (
            <span className="text-ui-sm text-text-secondary">Conta atual</span>
          ) : (
            <Button
              type="button"
              size="sm"
              variant={membership.active ? "ghost" : "secondary"}
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
                membership.active ? "text-text-secondary hover:text-danger" : ""
              }
            >
              {membership.active ? "Desativar" : "Ativar"}
            </Button>
          )}
        </TableCell>
      </TableRow>

      {feedback?.type === "error" ? (
        <TableRow role="alert" aria-live="assertive" className="h-auto min-h-0">
          <TableCell colSpan={4} className="px-4 py-2 text-ui-sm text-danger">
            {feedback.message}
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}
