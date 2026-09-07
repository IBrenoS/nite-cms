"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NewspaperIcon, UsersIcon, cn } from "@nite/cms-ui";

import { SignOutButton } from "@/components/sign-out-button";

type WorkspaceNavigationProps = {
  displayName: string;
  role: "admin" | "publisher";
};

function getInitials(displayName: string) {
  return displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function WorkspaceNavigation({
  displayName,
  role,
}: WorkspaceNavigationProps) {
  const pathname = usePathname();
  const articlesActive = pathname === "/" || pathname.startsWith("/articles");
  const membershipsActive = pathname.startsWith("/memberships");
  const initials = getInitials(displayName) || "NI";

  return (
    <>
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-[220px] flex-col border-r border-nite-border-subtle bg-nite-surface text-nite-text-primary lg:flex"
        aria-label="Navegação principal"
      >
        <div className="flex h-14 items-center border-b border-nite-border-subtle px-4">
          <Link href="/" className="inline-flex items-center gap-2">
            <span>
              <span className="block text-sm font-semibold tracking-tight text-nite-text-primary">
                NITE CMS
              </span>
              <span className="block text-[11px] font-medium text-nite-brand-primary">
                Redação Digital
              </span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 px-2.5 py-4" aria-label="Seções do CMS">
          <p className="mb-2 px-2.5 text-[11px] font-semibold tracking-wider text-nite-text-secondary uppercase">
            Operação editorial
          </p>
          <div className="space-y-0.5">
            <Link
              href="/"
              aria-current={articlesActive ? "page" : undefined}
              className={cn(
                "flex min-h-9 items-center gap-2.5 rounded-md px-2.5 text-xs font-semibold transition-colors duration-150",
                articlesActive
                  ? "bg-nite-section text-nite-brand-primary"
                  : "text-nite-text-secondary hover:bg-nite-section/60 hover:text-nite-text-primary",
              )}
            >
              <NewspaperIcon className="size-4" aria-hidden="true" />
              <span>Matérias</span>
            </Link>
            {role === "admin" ? (
              <Link
                href="/memberships"
                aria-current={membershipsActive ? "page" : undefined}
                className={cn(
                  "flex min-h-9 items-center gap-2.5 rounded-md px-2.5 text-xs font-medium transition-colors duration-150",
                  membershipsActive
                    ? "bg-nite-section text-nite-brand-primary"
                    : "text-nite-text-secondary hover:bg-nite-section/60 hover:text-nite-text-primary",
                )}
              >
                <UsersIcon className="size-4" aria-hidden="true" />
                <span>Equipe e acessos</span>
              </Link>
            ) : null}
          </div>
        </nav>

        <div className="border-t border-nite-border-subtle p-2.5">
          <div className="mb-2 flex items-center gap-2.5 px-2 py-1">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-nite-section text-xs font-semibold text-nite-text-primary">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-nite-text-primary">
                {displayName}
              </p>
              <p className="text-[11px] text-nite-text-secondary">
                {role === "admin" ? "Administradora" : "Publicador"}
              </p>
            </div>
          </div>
          <SignOutButton sidebar />
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex min-h-14 items-center justify-between border-b border-nite-border-subtle bg-nite-surface px-4 sm:px-6 lg:hidden">
        <Link
          href="/"
          className="inline-flex items-center rounded-lg font-semibold tracking-tight"
        >
          NITE CMS
        </Link>
        <nav className="flex items-center gap-1" aria-label="Navegação móvel">
          <Link
            href="/"
            aria-current={articlesActive ? "page" : undefined}
            className={cn(
              "flex min-h-9 items-center gap-2 rounded-lg px-2.5 text-xs font-semibold",
              articlesActive
                ? "bg-nite-brand-primary text-white"
                : "text-nite-text-secondary hover:bg-nite-section hover:text-nite-text-primary",
            )}
          >
            <NewspaperIcon className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Matérias</span>
          </Link>
          {role === "admin" ? (
            <Link
              href="/memberships"
              aria-label="Equipe e acessos"
              aria-current={membershipsActive ? "page" : undefined}
              className={cn(
                "flex size-9 items-center justify-center rounded-lg",
                membershipsActive
                  ? "bg-nite-brand-primary text-white"
                  : "text-nite-text-secondary hover:bg-nite-section hover:text-nite-text-primary",
              )}
            >
              <UsersIcon className="size-4" aria-hidden="true" />
            </Link>
          ) : null}
        </nav>
      </header>
    </>
  );
}
