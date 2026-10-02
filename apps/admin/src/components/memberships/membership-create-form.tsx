"use client";

import { useActionState } from "react";
import { Button, Input } from "@nite/cms-ui";

import {
  createMembershipInvitation,
  type MembershipActionState,
} from "@/app/(workspace)/memberships/actions";

const initialState: MembershipActionState = { status: "idle" };

export function MembershipCreateForm({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    createMembershipInvitation,
    initialState,
  );

  return (
    <div
      className={
        embedded
          ? ""
          : "rounded-lg border border-nite-border-subtle bg-nite-surface"
      }
    >
      {!embedded ? (
        <div className="border-b border-nite-border-subtle px-4 py-3">
          <h2 className="text-sm font-semibold text-nite-text-primary">
            Criar convite
          </h2>
          <p className="mt-0.5 text-xs text-nite-text-secondary">
            Autorize uma conta institucional para o primeiro acesso ao CMS.
          </p>
        </div>
      ) : null}

      <form
        action={formAction}
        className={
          embedded
            ? "grid gap-4"
            : "grid gap-3 p-4 sm:grid-cols-[1fr_180px_auto] sm:items-end"
        }
      >
        <label className="grid gap-1.5 text-sm font-medium text-nite-text-secondary">
          E-mail institucional
          <Input
            name="email"
            type="email"
            required
            maxLength={320}
            placeholder="matricula@unijorge.com.br"
            className="h-10 text-sm"
          />
        </label>

        <label className="grid gap-1.5 text-sm font-medium text-nite-text-secondary">
          Nível de acesso
          <select
            name="role"
            defaultValue="publisher"
            className="nite-form-field h-10 rounded-md border border-nite-border-subtle bg-transparent px-3 text-sm text-nite-text-primary focus:outline-none focus:ring-2 focus:ring-nite-brand-accent/40"
          >
            <option value="publisher">Acesso editorial</option>
            <option value="admin">Acesso administrativo</option>
          </select>
        </label>

        <Button
          type="submit"
          loading={pending}
          className="min-h-10 whitespace-nowrap max-sm:min-h-11"
        >
          Criar convite
        </Button>
      </form>
      <p
        className={
          embedded
            ? "mt-3 text-xs leading-5 text-nite-text-secondary"
            : "px-4 pb-3 text-xs text-nite-text-secondary"
        }
      >
        Um e-mail de convite será enviado automaticamente. A pessoa deverá
        aceitar o convite e acessar o CMS com a mesma conta institucional em
        até 7 dias.
      </p>

      {state.status !== "idle" ? (
        <div
          role={state.status === "error" ? "alert" : "status"}
          aria-live={state.status === "error" ? "assertive" : "polite"}
          className={`border-t border-nite-border-subtle px-4 py-2.5 text-xs ${
            state.status === "error"
              ? "text-status-error"
              : "text-status-validated"
          }`}
        >
          {state.message}
        </div>
      ) : null}
    </div>
  );
}
