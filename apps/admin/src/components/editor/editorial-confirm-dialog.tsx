"use client";

import type { ReactNode } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@nite/cms-ui";

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
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !pending) onCancel();
      }}
    >
      <DialogContent className="max-w-[30rem]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        {consequence ? (
          <div className="rounded-lg border border-border-subtle bg-surface-subtle p-3 text-ui-sm leading-relaxed text-text-secondary">
            {consequence}
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === "destructive" ? "danger" : "primary"}
            loading={pending}
            disabled={pending}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
