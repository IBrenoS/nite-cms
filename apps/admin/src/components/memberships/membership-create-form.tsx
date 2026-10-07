"use client";

import { useActionState } from "react";
import {
  Alert,
  Button,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  Select,
} from "@nite/cms-ui";

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
        embedded ? "" : "rounded-lg border border-border-subtle bg-surface"
      }
    >
      {!embedded ? (
        <div className="border-b border-border-subtle px-4 py-3">
          <h2 className="text-ui-md font-semibold text-text-primary">
            Criar convite
          </h2>
          <p className="mt-0.5 text-ui-sm text-text-secondary">
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
        <Field>
          <FieldLabel htmlFor="membership-invite-email">
            E-mail institucional
          </FieldLabel>
          <Input
            id="membership-invite-email"
            name="email"
            type="email"
            required
            maxLength={320}
            placeholder="matricula@unijorge.com.br"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="membership-invite-role">
            Nível de acesso
          </FieldLabel>
          <Select
            id="membership-invite-role"
            name="role"
            defaultValue="publisher"
          >
            <option value="publisher">Acesso editorial</option>
            <option value="admin">Acesso administrativo</option>
          </Select>
        </Field>

        <Button
          type="submit"
          loading={pending}
          size="lg"
          className="whitespace-nowrap"
        >
          Criar convite
        </Button>
      </form>

      <FieldDescription className={embedded ? "mt-3" : "px-4 pb-3"}>
        Um e-mail de convite será enviado automaticamente. A pessoa deverá
        aceitar o convite e acessar o CMS com a mesma conta institucional em até
        7 dias.
      </FieldDescription>

      {state.status !== "idle" ? (
        <div
          className={embedded ? "mt-4" : "border-t border-border-subtle p-4"}
        >
          <Alert
            variant={state.status === "error" ? "danger" : "success"}
            role={state.status === "error" ? "alert" : "status"}
            aria-live={state.status === "error" ? "assertive" : "polite"}
          >
            {state.message}
          </Alert>
        </div>
      ) : null}
    </div>
  );
}
