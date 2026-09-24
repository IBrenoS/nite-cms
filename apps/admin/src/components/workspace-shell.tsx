"use client";

import type { ReactNode } from "react";
import { useState, useSyncExternalStore } from "react";
import { cn } from "@nite/cms-ui";

import { WorkspaceNavigation } from "@/components/workspace-navigation";

const SIDEBAR_STORAGE_KEY = "nite-cms:sidebar-collapsed:v1";
const SIDEBAR_CHANGE_EVENT = "nite-cms:sidebar-change";

function subscribeToSidebarPreference(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(SIDEBAR_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(SIDEBAR_CHANGE_EVENT, onStoreChange);
  };
}

function getSidebarPreference() {
  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
}

type WorkspaceShellProps = {
  displayName: string;
  role: "admin" | "publisher";
  children: ReactNode;
};

export function WorkspaceShell({
  displayName,
  role,
  children,
}: WorkspaceShellProps) {
  const collapsed = useSyncExternalStore(
    subscribeToSidebarPreference,
    getSidebarPreference,
    () => false,
  );
  const [compactRailExpanded, setCompactRailExpanded] = useState(false);

  function toggleSidebar() {
    const isWideWorkspace =
      window.matchMedia?.("(min-width: 1280px)").matches ?? true;

    if (!isWideWorkspace) {
      setCompactRailExpanded((current) => !current);
      return;
    }

    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(!collapsed));
    window.dispatchEvent(new Event(SIDEBAR_CHANGE_EVENT));
  }

  return (
    <div
      data-testid="workspace-shell"
      data-workspace-shell=""
      data-sidebar-collapsed={String(collapsed)}
      className={cn(
        "min-h-screen bg-nite-background [--workspace-sidebar-width:64px]",
        compactRailExpanded && "md:[--workspace-sidebar-width:224px]",
        collapsed
          ? "xl:[--workspace-sidebar-width:64px]"
          : "xl:[--workspace-sidebar-width:224px]",
      )}
    >
      <WorkspaceNavigation
        displayName={displayName}
        role={role}
        collapsed={collapsed}
        compactRailExpanded={compactRailExpanded}
        onToggle={toggleSidebar}
      />
      <div className="min-w-0 md:pl-[var(--workspace-sidebar-width)]">
        {children}
      </div>
    </div>
  );
}
