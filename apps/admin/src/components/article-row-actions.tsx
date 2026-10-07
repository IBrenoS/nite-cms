"use client";

import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EllipsisIcon,
  iconButtonVariants,
} from "@nite/cms-ui";

export function ArticleRowActions({ articleId }: { articleId: string }) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Ações da matéria"
        className={iconButtonVariants({ variant: "ghost", size: "sm" })}
      >
        <EllipsisIcon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem
          onClick={() => router.push(`/articles/${articleId}/edit`)}
        >
          Editar matéria
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
