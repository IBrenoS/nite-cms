"use client";

import { useState } from "react";
import { Button } from "@nite/cms-ui";

import { authClient } from "@/lib/auth-client";
import styles from "./auth-shell.module.css";

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
    <div className={styles.signInActions}>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        className={styles.microsoftButton}
        loading={pending}
        onClick={signIn}
      >
        <svg
          className={styles.microsoftLogo}
          viewBox="0 0 23 23"
          aria-hidden="true"
        >
          <path fill="#f25022" d="M0 0h10.9v10.9H0z" />
          <path fill="#7fba00" d="M12.1 0H23v10.9H12.1z" />
          <path fill="#00a4ef" d="M0 12.1h10.9V23H0z" />
          <path fill="#ffb900" d="M12.1 12.1H23V23H12.1z" />
        </svg>
        <span>Continuar com Microsoft</span>
      </Button>
      {error ? (
        <p role="alert" className={styles.signInError}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
