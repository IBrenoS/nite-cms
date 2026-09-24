"use client";

import { useEffect, useRef, useState } from "react";
import { PlusIcon, XIcon } from "@nite/cms-ui";

import { MembershipCreateForm } from "./membership-create-form";

export function MembershipInviteDialog() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 self-stretch items-center justify-center gap-2 rounded-md bg-nite-brand-primary px-4 text-sm font-semibold text-white hover:bg-nite-brand-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nite-brand-primary max-sm:min-h-11 sm:self-start"
      >
        <PlusIcon className="size-4" aria-hidden="true" />
        Convidar pessoa
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 sm:items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) close();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Convidar pessoa para o CMS"
            onKeyDown={(event) => {
              if (event.key === "Escape") close();
            }}
            className="w-full rounded-t-xl border border-nite-border-subtle bg-nite-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:max-w-2xl sm:rounded-lg sm:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-nite-text-primary">
                  Convidar pessoa
                </h2>
                <p className="mt-1 text-sm leading-6 text-nite-text-secondary">
                  Autorize uma conta institucional para o primeiro acesso ao
                  CMS.
                </p>
              </div>
              <button
                type="button"
                aria-label="Fechar convite"
                onClick={close}
                className="flex size-11 shrink-0 items-center justify-center rounded-md text-nite-text-secondary hover:bg-nite-section sm:size-10"
              >
                <XIcon className="size-5" aria-hidden="true" />
              </button>
            </div>
            <MembershipCreateForm embedded />
          </div>
        </div>
      ) : null}
    </>
  );
}
