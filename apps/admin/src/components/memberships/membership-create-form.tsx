"use client";

import { useActionState } from "react";
import { Button, Input } from "@nite/cms-ui";

import {
  createMembershipInvitation,
  type MembershipActionState,
} from "@/app/(workspace)/memberships/actions";

const initialState: MembershipActionState = { status: "idle" };

export function MembershipCreateForm() {
  const [state, formAction, pending] = useActionState(
    createMembershipInvitation,
    initialState,
  );

  return (
    <div className="rounded-lg border border-nite-border-subtle bg-nite-surface">
      <div className="border-b border-nite-border-subtle px-4 py-3">
        <h2 className="text-sm font-semibold text-nite-text-primary">
          Criar convite
        </h2>
        <p className="mt-0.5 text-xs text-nite-text-secondary">
          Autorize uma conta institucional para o primeiro acesso ao CMS.
        </p>
      </div>

      <form
        action={formAction}
        className="grid gap-3 p-4 sm:grid-cols-[1fr_180px_auto] sm:items-end"
      >
        <label className="grid gap-1.5 text-xs font-medium text-nite-text-secondary">
          E-mail institucional
          <Input
            name="email"
            type="email"
            required
            maxLength={320}
            placeholder="matricula@unijorge.com"
            className="h-8 text-sm"
          />
        </label>

        <label className="grid gap-1.5 text-xs font-medium text-nite-text-secondary">
          Nível de acesso
          <select
            name="role"
            defaultValue="publisher"
            className="nite-form-field h-8 rounded-md border border-nite-border-subtle bg-transparent px-2 text-sm text-nite-text-primary focus:outline-none focus:ring-2 focus:ring-nite-brand-accent/40"
          >
            <option value="publisher">Acesso editorial</option>
            <option value="admin">Acesso administrativo</option>
          </select>
        </label>

        <Button
          type="submit"
          loading={pending}
          className="h-8 whitespace-nowrap"
        >
          Criar convite
        </Button>
      </form>
      <p className="px-4 pb-3 text-xs text-nite-text-secondary">
        Nenhum e-mail é enviado automaticamente. Avise a pessoa para acessar o
        CMS com a conta institucional em até 7 dias.
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
