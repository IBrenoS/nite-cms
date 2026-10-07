"use client";

import { useEffect, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@nite/cms-ui";

import {
  deleteEditorialArticleAction,
  getEditorialArticleDeletionImpactAction,
} from "@/app/(workspace)/articles/actions";

type DeletionImpact = {
  title: string;
  slug: string;
  status: "draft" | "published" | "archived";
  revisionCount: number;
  snapshotCount: number;
  mediaCount: number;
  exclusiveMediaCount: number;
  sharedMediaCount: number;
};

export function ArticleDeletionDialog({
  articleId,
  expectedRevisionId,
  isDirty,
  disabled,
  onPendingChange,
  onDeleted,
}: {
  articleId: string;
  expectedRevisionId: string;
  isDirty: boolean;
  disabled: boolean;
  onPendingChange: (pending: boolean) => void;
  onDeleted: (scheduledMediaCount: number) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [impact, setImpact] = useState<DeletionImpact>();
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (impact) confirmationRef.current?.focus();
  }, [impact]);

  function resetDialog() {
    setImpact(undefined);
    setConfirmation("");
    setMessage(undefined);
  }

  function close() {
    if (pending) return;
    setOpen(false);
    resetDialog();
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  async function openDialog() {
    setOpen(true);
    setPending(true);
    onPendingChange(true);
    setMessage(undefined);
    const result = await getEditorialArticleDeletionImpactAction({
      articleId,
      expectedRevisionId,
    });
    setPending(false);
    onPendingChange(false);
    if (result.status === "success") {
      setImpact(result.data);
      return;
    }
    setMessage(
      result.status === "unexpected_error"
        ? `${result.message} Código de suporte: ${result.errorId}.`
        : result.message,
    );
  }

  async function confirmDeletion() {
    if (confirmation !== "EXCLUIR") return;
    setPending(true);
    onPendingChange(true);
    setMessage(undefined);
    const result = await deleteEditorialArticleAction({
      articleId,
      expectedRevisionId,
    });
    if (result.status === "success") {
      onDeleted(result.data.scheduledMediaCount);
      return;
    }
    setPending(false);
    onPendingChange(false);
    setMessage(
      result.status === "conflict"
        ? "A matéria mudou desde que esta tela foi aberta. Recarregue antes de excluir."
        : result.status === "unexpected_error"
          ? `${result.message} Código de suporte: ${result.errorId}.`
          : result.message,
    );
  }

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="quiet"
        size="sm"
        disabled={disabled}
        onClick={() => void openDialog()}
        className="justify-start text-danger hover:bg-danger-bg hover:text-danger"
      >
        Excluir matéria
      </Button>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) close();
        }}
      >
        <DialogContent className="max-w-[34rem]">
          <DialogHeader>
            <DialogTitle>Excluir matéria definitivamente</DialogTitle>
            <DialogDescription>
              Esta operação não possui lixeira nem restauração.
            </DialogDescription>
          </DialogHeader>

          {pending && !impact ? (
            <p role="status" className="text-ui-md text-text-secondary">
              Calculando impacto…
            </p>
          ) : null}

          {impact ? (
            <div className="space-y-3 text-ui-md text-text-primary">
              <div className="rounded-lg bg-surface-subtle p-3">
                <p className="font-semibold">{impact.title}</p>
                <p className="font-mono text-ui-xs text-text-muted">
                  /atualizacoes/{impact.slug}
                </p>
                <p className="mt-2 text-text-secondary">
                  {impact.revisionCount} versões e {impact.snapshotCount}{" "}
                  previews serão removidos.
                </p>
              </div>
              <p>
                {impact.exclusiveMediaCount} mídias exclusivas serão removidas
                do R2; {impact.sharedMediaCount} compartilhadas serão
                preservadas.
              </p>
              {isDirty ? (
                <p className="font-medium text-warning">
                  Alterações não salvas também serão descartadas.
                </p>
              ) : null}
              <p className="text-text-secondary">
                Os registros de auditoria e outbox permanecerão como histórico
                imutável.
              </p>
              <label
                className="block text-ui-md font-semibold text-text-primary"
                htmlFor="delete-confirmation"
              >
                Digite EXCLUIR para confirmar
              </label>
              <Input
                ref={confirmationRef}
                id="delete-confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  if (confirmation === "EXCLUIR") void confirmDeletion();
                }}
                autoComplete="off"
                className="font-mono"
              />
            </div>
          ) : null}

          {message ? (
            <p role="alert" className="text-ui-sm font-medium text-danger">
              {message}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={close}
              disabled={pending}
            >
              Cancelar
            </Button>
            {impact ? (
              <Button
                type="button"
                variant="danger"
                disabled={confirmation !== "EXCLUIR" || pending}
                loading={pending}
                onClick={() => void confirmDeletion()}
              >
                Excluir definitivamente
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
