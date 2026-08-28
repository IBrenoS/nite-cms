"use client";

import { Button } from "@nite/cms-ui";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();

  return (
    <Button
      type="button"
      size="sm"
      variant="quiet"
      onClick={() =>
        authClient.signOut({
          fetchOptions: {
            onSuccess: () => {
              router.replace("/login");
              router.refresh();
            },
          },
        })
      }
    >
      Sair
    </Button>
  );
}
