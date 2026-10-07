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
  Avatar,
  AvatarFallback,
  IconButton,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
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
  const mobileNavTriggerRef = useRef<HTMLButtonElement>(null);
  const articlesActive = pathname === "/" || pathname.startsWith("/articles");
  const membershipsActive = pathname.startsWith("/memberships");
  const initials = getInitials(displayName) || "NI";
  const expandedBlockClass = compactRailExpanded
    ? "md:block"
    : "md:hidden inspector-rail:block";
  const expandedInlineClass = compactRailExpanded
    ? "md:inline"
    : "md:hidden inspector-rail:inline";
  const expandedFlexClass = compactRailExpanded
    ? "md:flex"
    : "md:hidden inspector-rail:flex";
  const compactBrandClass = compactRailExpanded
    ? collapsed
      ? "md:hidden inspector-rail:flex"
      : "md:hidden"
    : collapsed
      ? "md:flex"
      : "md:flex inspector-rail:hidden";

  useEffect(() => {
    if (!accountOpen) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setAccountOpen(false);
      accountRestoreFocusRef.current?.focus();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [accountOpen]);

  function setMobileNavigationOpen(open: boolean) {
    setMobileNavOpen(open);
    if (open) {
      setAccountOpen(false);
      return;
    }
    window.setTimeout(() => mobileNavTriggerRef.current?.focus());
  }

  return (
    <>
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-[var(--workspace-sidebar-width)] flex-col border-r border-nite-border-subtle bg-nite-surface text-nite-text-primary md:flex"
        aria-label="Navegação principal"
      >
        <div className="flex h-14 shrink-0 items-center border-b border-nite-border-subtle px-3">
          <div
            className={cn(
              "min-w-0 flex-1 items-center justify-between gap-2",
              expandedFlexClass,
              collapsed && "inspector-rail:hidden",
            )}
          >
            <Link
              href="/"
              aria-label="NITE CMS — Matérias"
              className="inline-flex min-w-0 items-center gap-2.5"
            >
              <img
                src="/nite-editorial-glyph.png"
                alt=""
                width={36}
                height={36}
                className="size-9 shrink-0"
              />
              <span className="min-w-0">
                <span className="block text-ui-md font-semibold tracking-tight text-nite-text-primary">
                  NITE
                </span>
                <span className="block text-ui-xs font-medium text-nite-brand-primary">
                  Redação Digital
                </span>
              </span>
            </Link>
            <IconButton
              type="button"
              onClick={onToggle}
              aria-label="Recolher navegação"
              title="Recolher navegação"
              variant="ghost"
            >
              <PanelLeftCloseIcon aria-hidden="true" />
            </IconButton>
          </div>

          <IconButton
            type="button"
            onClick={onToggle}
            aria-label="Expandir navegação"
            title="Expandir navegação"
            variant="primary"
            size="lg"
            className={cn(
              "group relative text-ui-md font-bold",
              compactBrandClass,
            )}
          >
            <img
              src="/nite-editorial-glyph.png"
              alt=""
              width={36}
              height={36}
              className="size-9 group-hover:hidden group-focus-visible:hidden [@media(pointer:coarse)]:hidden"
            />
            <PanelLeftOpenIcon
              className="hidden group-hover:block group-focus-visible:block [@media(pointer:coarse)]:block"
              aria-hidden="true"
            />
          </IconButton>
        </div>

        <nav className="flex-1 px-2 py-4" aria-label="Seções do CMS">
          <div>
            <p
              className={cn(
                "mb-2 px-2 text-ui-xs font-semibold tracking-wide text-nite-text-secondary uppercase",
                expandedBlockClass,
                collapsed && "inspector-rail:hidden",
              )}
            >
              Redação
            </p>
            <Link
              href="/"
              aria-current={articlesActive ? "page" : undefined}
              title="Matérias"
              className={cn(
                "flex min-h-10 items-center gap-3 rounded-sm border-l-2 px-3 text-ui-md font-semibold transition-colors [transition-duration:var(--motion-duration-normal)]",
                articlesActive
                  ? "border-primary bg-primary-subtle text-primary"
                  : "border-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary",
              )}
            >
              <NewspaperIcon className="size-4" aria-hidden="true" />
              <span
                className={cn(
                  "truncate",
                  expandedInlineClass,
                  collapsed && "inspector-rail:hidden",
                )}
              >
                Matérias
              </span>
            </Link>
          </div>

          {role === "admin" ? (
            <div className="mt-6">
              <p
                className={cn(
                  "mb-2 px-2 text-ui-xs font-semibold tracking-wide text-nite-text-secondary uppercase",
                  expandedBlockClass,
                  collapsed && "inspector-rail:hidden",
                )}
              >
                Gestão
              </p>
              <Link
                href="/memberships"
                aria-current={membershipsActive ? "page" : undefined}
                title="Equipe"
                className={cn(
                  "flex min-h-10 items-center gap-3 rounded-sm border-l-2 px-3 text-ui-md font-medium transition-colors [transition-duration:var(--motion-duration-normal)]",
                  membershipsActive
                    ? "border-primary bg-primary-subtle text-primary"
                    : "border-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary",
                )}
              >
                <UsersIcon className="size-4" aria-hidden="true" />
                <span
                  className={cn(
                    "truncate",
                    expandedInlineClass,
                    collapsed && "inspector-rail:hidden",
                  )}
                >
                  Equipe
                </span>
              </Link>
            </div>
          ) : null}
        </nav>

        <div className="relative border-t border-nite-border-subtle p-2">
          <div className="mb-1 flex min-h-10 items-center gap-2.5 px-2">
            <IconButton
              ref={accountRestoreFocusRef}
              type="button"
              aria-label="Abrir conta"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen((current) => !current)}
              size="sm"
              variant="ghost"
              className="rounded-full p-0"
            >
              <Avatar size="sm">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </IconButton>
            <div
              className={cn(
                "min-w-0 flex-1",
                expandedBlockClass,
                collapsed && "inspector-rail:hidden",
              )}
            >
              <p className="truncate text-ui-md font-semibold text-nite-text-primary">
                {displayName}
              </p>
              <p className="text-ui-xs text-nite-text-secondary">
                {role === "admin"
                  ? "Acesso administrativo"
                  : "Acesso editorial"}
              </p>
            </div>
          </div>
          {accountOpen ? (
            <div className="absolute bottom-14 left-2 hidden w-64 rounded-lg border border-nite-border-subtle bg-nite-surface p-3 shadow-popover md:block">
              <p className="truncate text-ui-md font-semibold text-nite-text-primary">
                {displayName}
              </p>
              <p className="mt-0.5 text-ui-xs text-nite-text-secondary">
                {role === "admin"
                  ? "Acesso administrativo"
                  : "Acesso editorial"}
              </p>
              <div className="mt-3 border-t border-nite-border-subtle pt-2">
                <SignOutButton sidebar />
              </div>
            </div>
          ) : null}
          <div
            className={cn(
              expandedBlockClass,
              collapsed && "inspector-rail:hidden",
            )}
          >
            <SignOutButton sidebar />
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-nite-border-subtle bg-nite-surface px-3 md:hidden">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-md px-1 font-semibold tracking-tight"
        >
          <img
            src="/nite-editorial-glyph.png"
            alt=""
            width={32}
            height={32}
            className="size-8 shrink-0"
          />
          <span>NITE</span>
        </Link>
        <div className="flex items-center gap-1">
          <IconButton
            ref={accountRestoreFocusRef}
            type="button"
            aria-label="Abrir menu da conta"
            aria-expanded={accountOpen}
            onClick={() => setAccountOpen((current) => !current)}
            variant="ghost"
            className="size-11"
          >
            <UserRoundIcon className="size-5" aria-hidden="true" />
          </IconButton>
          <IconButton
            ref={mobileNavTriggerRef}
            type="button"
            aria-label="Abrir navegação"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavigationOpen(true)}
            variant="ghost"
            className="size-11"
          >
            <MenuIcon className="size-5" aria-hidden="true" />
          </IconButton>
        </div>
      </header>

      {accountOpen ? (
        <div className="fixed inset-x-3 top-15 z-50 rounded-lg border border-nite-border-subtle bg-nite-surface p-3 shadow-popover md:hidden">
          <p className="text-ui-md font-semibold text-nite-text-primary">
            {displayName}
          </p>
          <p className="mt-0.5 text-ui-xs text-nite-text-secondary">
            {role === "admin" ? "Acesso administrativo" : "Acesso editorial"}
          </p>
          <div className="mt-3 border-t border-nite-border-subtle pt-2">
            <SignOutButton sidebar />
          </div>
        </div>
      ) : null}

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavigationOpen}>
        <SheetContent
          side="left"
          aria-label="Navegação móvel"
          className="w-full max-w-xs gap-0 p-0 md:hidden"
        >
          <SheetTitle className="sr-only">Navegação do NITE CMS</SheetTitle>
          <SheetDescription className="sr-only">
            Acesse as áreas da Redação Digital e da gestão do CMS.
          </SheetDescription>

          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle px-3">
            <Link
              href="/"
              onClick={() => setMobileNavigationOpen(false)}
              className="inline-flex min-h-11 items-center gap-2 rounded-md px-1 font-semibold tracking-tight"
            >
              <img
                src="/nite-editorial-glyph.png"
                alt=""
                width={32}
                height={32}
                className="size-8 shrink-0"
              />
              <span>NITE</span>
            </Link>
            <IconButton
              type="button"
              aria-label="Fechar navegação"
              variant="ghost"
              className="size-11"
              onClick={() => setMobileNavigationOpen(false)}
            >
              <XIcon className="size-5" aria-hidden="true" />
            </IconButton>
          </div>

          <nav
            className="flex-1 overflow-y-auto p-3"
            aria-label="Seções do CMS"
          >
            <p className="px-3 pb-1.5 text-ui-xs font-semibold tracking-wide text-nite-text-secondary uppercase">
              Redação
            </p>
            <Link
              href="/"
              aria-current={articlesActive ? "page" : undefined}
              onClick={() => setMobileNavigationOpen(false)}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-sm border-l-2 px-3 text-ui-md font-semibold",
                articlesActive
                  ? "border-primary bg-primary-subtle text-primary"
                  : "border-transparent text-text-secondary hover:bg-surface-hover",
              )}
            >
              <NewspaperIcon className="size-5" aria-hidden="true" /> Matérias
            </Link>
            {role === "admin" ? (
              <div className="mt-4 border-t border-border-subtle pt-3">
                <p className="px-3 pb-1.5 text-ui-xs font-semibold tracking-wide text-nite-text-secondary uppercase">
                  Gestão
                </p>
                <Link
                  href="/memberships"
                  aria-current={membershipsActive ? "page" : undefined}
                  onClick={() => setMobileNavigationOpen(false)}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-sm border-l-2 px-3 text-ui-md font-semibold",
                    membershipsActive
                      ? "border-primary bg-primary-subtle text-primary"
                      : "border-transparent text-text-secondary hover:bg-surface-hover",
                  )}
                >
                  <UsersIcon className="size-5" aria-hidden="true" /> Equipe
                </Link>
              </div>
            ) : null}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
