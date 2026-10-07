"use client";

import {
  Button,
  CircleAlertIcon,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@nite/cms-ui";
import type {
  EditorialField,
  EditorialFieldErrors,
} from "@/lib/editorial-form";

const fieldLabel: Record<EditorialField, string> = {
  slug: "Revise a URL da matéria",
  title: "Complete o título",
  summary: "Complete o resumo",
  category: "Selecione uma categoria",
  body: "Escreva o conteúdo da matéria",
  byline: "Informe a assinatura",
  eventDate: "Revise a data do evento",
  coverMedia: "Escolha uma capa",
  coverAlt: "Escreva o texto alternativo da capa",
  coverCaption: "Revise a legenda da capa",
  coverCredit: "Revise o crédito da capa",
  seoTitle: "Revise o título para busca",
  seoDescription: "Revise a descrição para busca",
};

type Props = {
  open: boolean;
  errors: EditorialFieldErrors;
  onOpenChange: (open: boolean) => void;
  onNavigate: (field: EditorialField) => void;
};

export function EditorPreflightDialog({
  open,
  errors,
  onOpenChange,
  onNavigate,
}: Props) {
  const entries = Object.entries(errors) as Array<[EditorialField, string[]]>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="mb-1 flex size-9 items-center justify-center rounded-md bg-warning-bg text-warning">
            <CircleAlertIcon className="size-5" aria-hidden="true" />
          </div>
          <DialogTitle>Antes de publicar</DialogTitle>
          <DialogDescription>
            Corrija {entries.length}{" "}
            {entries.length === 1 ? "pendência" : "pendências"} para concluir a
            revisão editorial.
          </DialogDescription>
        </DialogHeader>

        <div className="divide-y divide-border-subtle rounded-lg border border-border-subtle">
          {entries.map(([field, messages]) => (
            <Button
              key={field}
              type="button"
              variant="ghost"
              className="h-auto w-full justify-start rounded-none px-3 py-3 text-left first:rounded-t-lg last:rounded-b-lg"
              onClick={() => onNavigate(field)}
            >
              <span className="min-w-0">
                <span className="block font-semibold text-text-primary">
                  {fieldLabel[field]}
                </span>
                <span className="mt-0.5 block text-ui-sm font-normal text-text-secondary">
                  {messages[0]}
                </span>
              </span>
            </Button>
          ))}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Voltar ao editor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
