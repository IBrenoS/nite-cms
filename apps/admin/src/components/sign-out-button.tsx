"use client";

import { Button, LogOutIcon } from "@nite/cms-ui";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton({ sidebar = false }: { sidebar?: boolean }) {
  const router = useRouter();

  return (
    <Button
      type="button"
      size={sidebar ? "sm" : "sm"}
      variant="quiet"
      className={
        sidebar
          ? "min-h-10 w-full justify-start border-transparent px-2.5 text-ui-md text-nite-text-secondary hover:border-transparent hover:bg-nite-section hover:text-nite-text-primary focus-visible:border-transparent"
          : undefined
      }
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
      {sidebar ? <LogOutIcon aria-hidden="true" /> : null}
      Sair
    </Button>
  );
}
