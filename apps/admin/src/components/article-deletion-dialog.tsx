"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@nite/cms-ui";

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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [impact, setImpact] = useState<DeletionImpact>();
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (impact) confirmationRef.current?.focus();
  }, [impact]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }, [open]);

  function close() {
    if (pending) return;
    setOpen(false);
    setImpact(undefined);
    setConfirmation("");
    setMessage(undefined);
    window.setTimeout(() => triggerRef.current?.focus());
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
        className="justify-start border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800"
      >
        Excluir matéria
      </Button>
      {open ? (
        <dialog
          ref={dialogRef}
          aria-modal="true"
          aria-labelledby="article-deletion-title"
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
          className="fixed inset-0 z-50 m-auto w-[min(92vw,34rem)] rounded-xl border border-nite-border-soft bg-nite-surface p-0 text-nite-text-primary shadow-2xl backdrop:bg-black/60"
        >
          <div className="space-y-4 p-5">
            <div>
              <h2 id="article-deletion-title" className="text-lg font-semibold">
                Excluir matéria definitivamente
              </h2>
              <p className="mt-1 text-sm text-nite-text-secondary">
                Esta operação não possui lixeira nem restauração.
              </p>
            </div>

            {pending && !impact ? (
              <p role="status" className="text-sm">
                Calculando impacto…
              </p>
            ) : null}

            {impact ? (
              <div className="space-y-3 text-sm">
                <div className="rounded-lg bg-nite-section p-3">
                  <p className="font-semibold">{impact.title}</p>
                  <p className="font-mono text-xs text-nite-text-secondary">
                    /atualizacoes/{impact.slug}
                  </p>
                  <p className="mt-2 text-nite-text-secondary">
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
                  <p className="font-medium text-amber-700">
                    Alterações não salvas também serão descartadas.
                  </p>
                ) : null}
                <p className="text-nite-text-secondary">
                  Os registros de auditoria e outbox permanecerão como histórico
                  imutável.
                </p>
                <label
                  className="block font-medium"
                  htmlFor="delete-confirmation"
                >
                  Digite EXCLUIR para confirmar
                </label>
                <input
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
                  className="min-h-10 w-full rounded-md border border-nite-border-soft bg-nite-surface px-3 font-mono"
                />
              </div>
            ) : null}

            {message ? (
              <p role="alert" className="text-sm text-red-700">
                {message}
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
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
                  disabled={confirmation !== "EXCLUIR" || pending}
                  loading={pending}
                  onClick={() => void confirmDeletion()}
                  className="bg-red-700 hover:bg-red-800"
                >
                  Excluir definitivamente
                </Button>
              ) : null}
            </div>
          </div>
        </dialog>
      ) : null}
    </>
  );
}
