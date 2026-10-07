"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, FieldLabel, Input, Select } from "@nite/cms-ui";

import {
  replaceMembershipInvitation,
  revokeMembershipInvitation,
} from "@/app/(workspace)/memberships/actions";
import type { MembershipInvitation } from "./memberships.types";

const deliveryStatusLabels = {
  pending: "Aguardando envio",
  sent: "Enviado",
  delivered: "Entregue",
  bounced: "Devolvido",
  complained: "Marcado como spam",
  failed: "Falha no envio",
} satisfies Record<NonNullable<MembershipInvitation["deliveryStatus"]>, string>;

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
    <section className="overflow-hidden rounded-lg border border-border-subtle bg-surface">
      <div className="border-b border-border-subtle px-4 py-3">
        <h2 className="text-ui-md font-semibold text-text-primary">
          Convites pendentes
        </h2>
      </div>
      <ul className="divide-y divide-border-subtle">
        {invitations.map((invitation) => {
          const expiration = new Date(invitation.expiresAt);
          const deliveryLabel = invitation.deliveryStatus
            ? deliveryStatusLabels[invitation.deliveryStatus]
            : deliveryStatusLabels.pending;
          return (
            <li key={invitation.id} className="grid gap-3 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-ui-md font-semibold text-text-primary">
                    {invitation.email}
                  </p>
                  <p className="mt-0.5 text-ui-sm text-text-secondary">
                    {invitation.role === "admin"
                      ? "Acesso administrativo"
                      : "Acesso editorial"}
                    {" · "}
                    {invitation.expired ? "Expirado" : "Expira em"}{" "}
                    {new Intl.DateTimeFormat("pt-BR").format(expiration)}
                  </p>
                  <p className="mt-0.5 text-ui-sm text-text-secondary">
                    Entrega: <span>{deliveryLabel}</span>
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
                    variant="ghost"
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
                  className="grid gap-3 rounded-md bg-surface-subtle p-3 sm:grid-cols-[1fr_180px_auto] sm:items-end"
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
                  <Field>
                    <FieldLabel htmlFor={`invite-email-${invitation.id}`}>
                      E-mail institucional
                    </FieldLabel>
                    <Input
                      id={`invite-email-${invitation.id}`}
                      name="email"
                      type="email"
                      required
                      defaultValue={invitation.email}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`invite-role-${invitation.id}`}>
                      Nível de acesso
                    </FieldLabel>
                    <Select
                      id={`invite-role-${invitation.id}`}
                      name="role"
                      defaultValue={invitation.role}
                    >
                      <option value="publisher">Acesso editorial</option>
                      <option value="admin">Acesso administrativo</option>
                    </Select>
                  </Field>
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
        <div className="border-t border-border-subtle p-3">
          <Alert variant="danger" role="alert">
            {error}
          </Alert>
        </div>
      ) : null}
    </section>
  );
}
