"use client";

import { useState } from "react";
import { Button } from "@nite/cms-ui";

import { authClient } from "@/lib/auth-client";

export function AcceptInvitationButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function acceptInvitation() {
    setPending(true);
    setError(undefined);
    const result = await authClient.signIn.social({
      provider: "microsoft",
      callbackURL: "/invitations/complete",
    });
    if (result.error) {
      setError("Não foi possível iniciar a autenticação institucional.");
      setPending(false);
    }
  }

  return (
    <div className="grid gap-3">
      <Button type="button" loading={pending} onClick={acceptInvitation}>
        Aceitar convite
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-status-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
