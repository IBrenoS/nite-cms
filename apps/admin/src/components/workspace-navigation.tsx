"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MenuIcon,
  NewspaperIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  UserRoundIcon,
  UsersIcon,
  XIcon,
  cn,
} from "@nite/cms-ui";
import { useEffect, useRef, useState } from "react";

import { SignOutButton } from "@/components/sign-out-button";

type WorkspaceNavigationProps = {
  displayName: string;
  role: "admin" | "publisher";
  collapsed: boolean;
  compactRailExpanded: boolean;
  onToggle: () => void;
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
  collapsed,
  compactRailExpanded,
  onToggle,
}: WorkspaceNavigationProps) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRestoreFocusRef = useRef<HTMLButtonElement>(null);
  const articlesActive = pathname === "/" || pathname.startsWith("/articles");
  const membershipsActive = pathname.startsWith("/memberships");
  const initials = getInitials(displayName) || "NI";
  const expandedBlockClass = compactRailExpanded
    ? "md:block"
    : "md:hidden xl:block";
  const expandedInlineClass = compactRailExpanded
    ? "md:inline"
    : "md:hidden xl:inline";
  const expandedFlexClass = compactRailExpanded
    ? "md:flex"
    : "md:hidden xl:flex";
  const compactBrandClass = compactRailExpanded
    ? collapsed
      ? "md:hidden xl:flex"
      : "md:hidden"
    : collapsed
      ? "md:flex"
      : "md:flex xl:hidden";

  useEffect(() => {
    if (!accountOpen && !mobileNavOpen) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setAccountOpen(false);
      setMobileNavOpen(false);
      accountRestoreFocusRef.current?.focus();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [accountOpen, mobileNavOpen]);

  return (
    <>
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-[var(--workspace-sidebar-width)] flex-col border-r border-nite-border-subtle bg-nite-surface text-nite-text-primary md:flex"
        aria-label="Navegação principal"
      >
        <div className="flex h-14 shrink-0 items-center border-b border-nite-border-subtle px-3">
          <div className={cn("min-w-0 items-center gap-2", expandedFlexClass)}>
            <Link
              href="/"
              aria-label="NITE CMS — Matérias"
              className="inline-flex min-w-0 items-center gap-2.5"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-nite-brand-primary text-sm font-bold text-white">
                N
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold tracking-tight text-nite-text-primary">
                  NITE CMS
                </span>
                <span className="block text-xs font-medium text-nite-brand-primary">
                  Redação Digital
                </span>
              </span>
            </Link>
            <button
              type="button"
              onClick={onToggle}
              aria-label="Recolher navegação"
              title="Recolher navegação"
              className="flex size-10 shrink-0 items-center justify-center rounded-md text-nite-text-secondary hover:bg-nite-section hover:text-nite-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nite-brand-primary"
            >
              <PanelLeftCloseIcon className="size-4" aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            onClick={onToggle}
            aria-label="Expandir navegação"
            title="Expandir navegação"
            className={cn(
              "group relative size-10 shrink-0 items-center justify-center rounded-md bg-nite-brand-primary text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nite-brand-primary",
              compactBrandClass,
            )}
          >
            <span className="group-hover:hidden group-focus-visible:hidden [@media(pointer:coarse)]:hidden">
              N
            </span>
            <PanelLeftOpenIcon
              className="hidden size-4 group-hover:block group-focus-visible:block [@media(pointer:coarse)]:block"
              aria-hidden="true"
            />
            <span className="sr-only">Expandir navegação</span>
          </button>
        </div>

        <nav className="flex-1 px-2 py-4" aria-label="Seções do CMS">
          <p
            className={cn(
              "mb-2 px-2 text-xs font-semibold tracking-wide text-nite-text-secondary uppercase",
              expandedBlockClass,
              collapsed && "xl:hidden",
            )}
          >
            Operação editorial
          </p>
          <div className="space-y-0.5">
            <Link
              href="/"
              aria-current={articlesActive ? "page" : undefined}
              title="Matérias"
              className={cn(
                "flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors duration-150",
                articlesActive
                  ? "bg-nite-section text-nite-brand-primary"
                  : "text-nite-text-secondary hover:bg-nite-section/60 hover:text-nite-text-primary",
              )}
            >
              <NewspaperIcon className="size-4" aria-hidden="true" />
              <span
                className={cn(
                  "truncate",
                  expandedInlineClass,
                  collapsed && "xl:hidden",
                )}
              >
                Matérias
              </span>
            </Link>
            {role === "admin" ? (
              <Link
                href="/memberships"
                aria-current={membershipsActive ? "page" : undefined}
                title="Equipe e acessos"
                className={cn(
                  "flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-150",
                  membershipsActive
                    ? "bg-nite-section text-nite-brand-primary"
                    : "text-nite-text-secondary hover:bg-nite-section/60 hover:text-nite-text-primary",
                )}
              >
                <UsersIcon className="size-4" aria-hidden="true" />
                <span
                  className={cn(
                    "truncate",
                    expandedInlineClass,
                    collapsed && "xl:hidden",
                  )}
                >
                  Equipe e acessos
                </span>
              </Link>
            ) : null}
          </div>
        </nav>

        <div className="relative border-t border-nite-border-subtle p-2">
          <div className="mb-1 flex min-h-10 items-center gap-2.5 px-2">
            <button
              type="button"
              aria-label="Abrir conta"
              aria-expanded={accountOpen}
              onClick={(event) => {
                accountRestoreFocusRef.current = event.currentTarget;
                setAccountOpen((current) => !current);
              }}
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-nite-section text-xs font-semibold text-nite-text-primary hover:ring-2 hover:ring-nite-brand-primary/20"
            >
              {initials}
            </button>
            <div
              className={cn(
                "min-w-0 flex-1",
                expandedBlockClass,
                collapsed && "xl:hidden",
              )}
            >
              <p className="truncate text-sm font-semibold text-nite-text-primary">
                {displayName}
              </p>
              <p className="text-xs text-nite-text-secondary">
                {role === "admin"
                  ? "Acesso administrativo"
                  : "Acesso editorial"}
              </p>
            </div>
          </div>
          {accountOpen ? (
            <div className="absolute bottom-14 left-2 hidden w-64 rounded-lg border border-nite-border-subtle bg-nite-surface p-3 shadow-lg md:block">
              <p className="truncate text-sm font-semibold text-nite-text-primary">
                {displayName}
              </p>
              <p className="mt-0.5 text-xs text-nite-text-secondary">
                {role === "admin"
                  ? "Acesso administrativo"
                  : "Acesso editorial"}
              </p>
              <div className="mt-3 border-t border-nite-border-subtle pt-2">
                <SignOutButton sidebar />
              </div>
            </div>
          ) : null}
          <div className={cn(expandedBlockClass, collapsed && "xl:hidden")}>
            <SignOutButton sidebar />
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-nite-border-subtle bg-nite-surface px-3 md:hidden">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-md px-1 font-semibold tracking-tight"
        >
          <span className="flex size-8 items-center justify-center rounded-md bg-nite-brand-primary text-sm font-bold text-white">
            N
          </span>
          <span>NITE CMS</span>
        </Link>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Abrir menu da conta"
            aria-expanded={accountOpen}
            onClick={(event) => {
              accountRestoreFocusRef.current = event.currentTarget;
              setAccountOpen((current) => !current);
            }}
            className="flex size-11 items-center justify-center rounded-md text-nite-text-secondary hover:bg-nite-section hover:text-nite-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nite-brand-primary"
          >
            <UserRoundIcon className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={mobileNavOpen ? "Fechar navegação" : "Abrir navegação"}
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((current) => !current)}
            className="flex size-11 items-center justify-center rounded-md text-nite-text-secondary hover:bg-nite-section hover:text-nite-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nite-brand-primary"
          >
            {mobileNavOpen ? (
              <XIcon className="size-5" />
            ) : (
              <MenuIcon className="size-5" />
            )}
          </button>
        </div>
      </header>

      {accountOpen ? (
        <div className="fixed inset-x-3 top-[60px] z-50 rounded-lg border border-nite-border-subtle bg-nite-surface p-3 shadow-lg md:hidden">
          <p className="text-sm font-semibold text-nite-text-primary">
            {displayName}
          </p>
          <p className="mt-0.5 text-xs text-nite-text-secondary">
            {role === "admin" ? "Acesso administrativo" : "Acesso editorial"}
          </p>
          <div className="mt-3 border-t border-nite-border-subtle pt-2">
            <SignOutButton sidebar />
          </div>
        </div>
      ) : null}

      {mobileNavOpen ? (
        <nav
          className="fixed inset-x-0 top-14 z-40 grid gap-1 border-b border-nite-border-subtle bg-nite-surface p-3 shadow-lg md:hidden"
          aria-label="Navegação móvel"
        >
          <Link
            href="/"
            aria-current={articlesActive ? "page" : undefined}
            onClick={() => setMobileNavOpen(false)}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold",
              articlesActive
                ? "bg-nite-section text-nite-brand-primary"
                : "text-nite-text-secondary hover:bg-nite-section",
            )}
          >
            <NewspaperIcon className="size-5" aria-hidden="true" /> Matérias
          </Link>
          {role === "admin" ? (
            <Link
              href="/memberships"
              aria-current={membershipsActive ? "page" : undefined}
              onClick={() => setMobileNavOpen(false)}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold",
                membershipsActive
                  ? "bg-nite-section text-nite-brand-primary"
                  : "text-nite-text-secondary hover:bg-nite-section",
              )}
            >
              <UsersIcon className="size-5" aria-hidden="true" /> Equipe e
              acessos
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
