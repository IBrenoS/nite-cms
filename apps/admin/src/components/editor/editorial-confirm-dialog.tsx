"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@nite/cms-ui";

export type EditorialConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  consequence?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: "primary" | "destructive";
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function EditorialConfirmDialog({
  open,
  title,
  description,
  consequence,
  confirmLabel,
  cancelLabel = "Cancelar",
  variant = "primary",
  pending = false,
  onConfirm,
  onCancel,
}: EditorialConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      restoreFocusRef.current = document.activeElement as HTMLElement | null;
      const dialog = dialogRef.current;
      if (!dialog) return;
      if (!dialog.open) {
        if (typeof dialog.showModal === "function") {
          dialog.showModal();
        } else {
          dialog.setAttribute("open", "");
        }
      }
      // Focus primary button when dialog opens
      window.setTimeout(() => {
        confirmButtonRef.current?.focus();
      }, 0);
    } else {
      const dialog = dialogRef.current;
      if (dialog && dialog.open) {
        if (typeof dialog.close === "function") {
          dialog.close();
        } else {
          dialog.removeAttribute("open");
        }
      }
      if (restoreFocusRef.current) {
        const el = restoreFocusRef.current;
        window.setTimeout(() => {
          el.focus();
        }, 0);
      }
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby="editorial-confirm-title"
      aria-describedby={description ? "editorial-confirm-desc" : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
      className="fixed inset-0 z-50 m-auto w-[min(92vw,30rem)] rounded-xl border border-nite-border-soft bg-nite-surface p-0 text-nite-text-primary shadow-2xl backdrop:bg-black/60"
    >
      <div className="space-y-4 p-5">
        <div>
          <h2
            id="editorial-confirm-title"
            className="text-base font-semibold tracking-tight text-nite-text-primary sm:text-lg"
          >
            {title}
          </h2>
          {description ? (
            <p
              id="editorial-confirm-desc"
              className="mt-1 text-xs text-nite-text-secondary sm:text-sm"
            >
              {description}
            </p>
          ) : null}
        </div>

        {consequence ? (
          <div className="rounded-lg border border-nite-border-subtle bg-nite-section/60 p-3 text-xs leading-5 text-nite-text-secondary">
            {consequence}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            ref={confirmButtonRef}
            type="button"
            loading={pending}
            disabled={pending}
            onClick={onConfirm}
            className={
              variant === "destructive"
                ? "bg-red-700 hover:bg-red-800 text-white"
                : "bg-nite-brand-primary hover:bg-blue-800 text-white"
            }
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
