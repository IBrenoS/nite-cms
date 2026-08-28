"use client";

import { useState } from "react";
import { Button } from "@nite/cms-ui";

import { authClient } from "@/lib/auth-client";

export function SignInButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function signIn() {
    setPending(true);
    setError(undefined);
    const result = await authClient.signIn.social({
      provider: "microsoft",
      callbackURL: "/",
    });
    if (result.error) {
      setError("Não foi possível iniciar o acesso com a Microsoft.");
      setPending(false);
    }
  }

  return (
    <div className="grid gap-3">
      <Button type="button" loading={pending} onClick={signIn}>
        Entrar com Microsoft
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-status-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
