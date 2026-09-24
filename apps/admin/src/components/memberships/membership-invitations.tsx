"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@nite/cms-ui";

import {
  replaceMembershipInvitation,
  revokeMembershipInvitation,
} from "@/app/(workspace)/memberships/actions";
import type { MembershipInvitation } from "./memberships.types";

export function MembershipInvitations({
  invitations,
}: {
  invitations: MembershipInvitation[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function complete(result: { status: string; message?: string }) {
    if (result.status === "success") {
      setError(null);
      setEditingId(null);
      router.refresh();
      return;
    }
    setError(result.message ?? "Não foi possível atualizar o convite.");
  }

  if (invitations.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-lg border border-nite-border-subtle bg-nite-surface">
      <div className="border-b border-nite-border-subtle px-4 py-3">
        <h2 className="text-sm font-semibold text-nite-text-primary">
          Convites pendentes
        </h2>
      </div>
      <ul className="divide-y divide-nite-border-subtle">
        {invitations.map((invitation) => {
          const expiration = new Date(invitation.expiresAt);
          return (
            <li key={invitation.id} className="grid gap-3 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-nite-text-primary">
                    {invitation.email}
                  </p>
                  <p className="mt-0.5 text-[13px] text-nite-text-secondary">
                    {invitation.role === "admin"
                      ? "Acesso administrativo"
                      : "Acesso editorial"}
                    {" · "}
                    {invitation.expired ? "Expirado" : "Expira em"}{" "}
                    {new Intl.DateTimeFormat("pt-BR").format(expiration)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setEditingId(invitation.id)}
                  >
                    Corrigir
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="quiet"
                    loading={pending}
                    onClick={() =>
                      startTransition(async () =>
                        complete(
                          await revokeMembershipInvitation({
                            invitationId: invitation.id,
                          }),
                        ),
                      )
                    }
                  >
                    Revogar
                  </Button>
                </div>
              </div>
              {editingId === invitation.id ? (
                <form
                  aria-label={`Corrigir convite de ${invitation.email}`}
                  className="grid gap-2 rounded-md bg-nite-section/60 p-3 sm:grid-cols-[1fr_180px_auto] sm:items-end"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    startTransition(async () =>
                      complete(
                        await replaceMembershipInvitation({
                          invitationId: invitation.id,
                          email: data.get("email"),
                          role: data.get("role"),
                        }),
                      ),
                    );
                  }}
                >
                  <label className="grid gap-1.5 text-sm font-medium text-nite-text-secondary">
                    E-mail institucional
                    <Input
                      name="email"
                      type="email"
                      required
                      defaultValue={invitation.email}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium text-nite-text-secondary">
                    Nível de acesso
                    <select
                      name="role"
                      defaultValue={invitation.role}
                      className="nite-form-field h-10 rounded-md border border-nite-border-subtle bg-transparent px-3 text-sm"
                    >
                      <option value="publisher">Acesso editorial</option>
                      <option value="admin">Acesso administrativo</option>
                    </select>
                  </label>
                  <Button type="submit" loading={pending}>
                    Substituir convite
                  </Button>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>
      {error ? (
        <p
          role="alert"
          className="border-t border-nite-border-subtle px-4 py-2 text-xs text-status-error"
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}
