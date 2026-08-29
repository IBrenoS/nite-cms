"use client";

import { useActionState, useState, useTransition } from "react";
import { Button, Input } from "@nite/cms-ui";

import {
  createMembership,
  updateMembershipActive,
  updateMembershipRole,
  type MembershipActionState,
} from "@/app/(workspace)/memberships/actions";

type Membership = {
  id: string;
  objectId: string;
  displayName: string;
  email: string | null;
  role: "admin" | "publisher";
  active: boolean;
};

const initialState: MembershipActionState = { status: "idle" };

export function MembershipsPanel({
  memberships,
}: {
  memberships: Membership[];
}) {
  const [state, formAction, pending] = useActionState(
    createMembership,
    initialState,
  );
  const [message, setMessage] = useState<string>();
  const [changing, startTransition] = useTransition();

  function report(result: Awaited<ReturnType<typeof updateMembershipRole>>) {
    setMessage(
      result.status === "error" ? result.message : "Membership atualizada.",
    );
  }

  return (
    <div className="grid gap-8">
      <form
        action={formAction}
        className="grid gap-4 rounded-xl border border-nite-border-subtle p-5 sm:grid-cols-2"
      >
        <h2 className="font-heading text-xl font-semibold sm:col-span-2">
          Adicionar membership
        </h2>
        <label className="grid gap-2 text-sm font-medium">
          Object ID do Microsoft Entra
          <Input name="objectId" required maxLength={128} />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Nome de exibição
          <Input name="displayName" required maxLength={160} />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          E-mail institucional (opcional)
          <Input name="email" type="email" maxLength={320} />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Papel
          <select
            name="role"
            defaultValue="publisher"
            className="nite-form-field h-10 rounded-xl border px-3 text-sm"
          >
            <option value="publisher">Publisher</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <Button
          type="submit"
          loading={pending}
          className="sm:col-span-2 sm:justify-self-start"
        >
          Criar e ativar
        </Button>
        {state.status !== "idle" ? (
          <p
            role={state.status === "error" ? "alert" : "status"}
            className="sm:col-span-2 text-sm"
          >
            {state.message}
          </p>
        ) : null}
      </form>

      {memberships.length === 0 ? (
        <p className="rounded-xl border border-dashed border-nite-border-strong p-6 text-nite-text-secondary">
          Não há memberships neste tenant.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-nite-border-subtle">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="bg-nite-section text-nite-text-secondary">
              <tr>
                <th className="p-4">Pessoa</th>
                <th className="p-4">Papel</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((membership) => (
                <tr
                  key={membership.id}
                  className="border-t border-nite-border-subtle"
                >
                  <td className="p-4">
                    <p className="font-medium">{membership.displayName}</p>
                    <p className="text-nite-text-muted">
                      {membership.email ?? membership.objectId}
                    </p>
                  </td>
                  <td className="p-4">
                    <select
                      aria-label={`Papel de ${membership.displayName}`}
                      value={membership.role}
                      disabled={changing}
                      onChange={(event) =>
                        startTransition(async () =>
                          report(
                            await updateMembershipRole({
                              objectId: membership.objectId,
                              role: event.target.value,
                            }),
                          ),
                        )
                      }
                      className="nite-form-field h-9 rounded-lg border px-2"
                    >
                      <option value="publisher">Publisher</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="p-4">
                    {membership.active ? "Ativa" : "Inativa"}
                  </td>
                  <td className="p-4">
                    <Button
                      type="button"
                      size="sm"
                      variant="quiet"
                      loading={changing}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await updateMembershipActive({
                            objectId: membership.objectId,
                            active: !membership.active,
                          });
                          setMessage(
                            result.status === "error"
                              ? result.message
                              : "Membership atualizada.",
                          );
                        })
                      }
                    >
                      {membership.active ? "Desativar" : "Ativar"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {message ? (
        <p role="status" className="text-sm text-nite-text-secondary">
          {message}
        </p>
      ) : null}
    </div>
  );
}
