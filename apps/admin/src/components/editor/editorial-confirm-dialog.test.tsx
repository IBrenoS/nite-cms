import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorialConfirmDialog } from "./editorial-confirm-dialog";

describe("EditorialConfirmDialog", () => {
  afterEach(cleanup);

  it("renderiza título, descrição e botões de ação", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <EditorialConfirmDialog
        open={true}
        title="Publicar matéria"
        description="Esta matéria ficará pública no Portal."
        confirmLabel="Publicar agora"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Publicar matéria" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Esta matéria ficará pública no Portal."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Publicar agora" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancelar" }),
    ).toBeInTheDocument();
  });

  it("aciona onConfirm ao clicar no botão de confirmação", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <EditorialConfirmDialog
        open={true}
        title="Despublicar matéria"
        confirmLabel="Despublicar"
        variant="destructive"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Despublicar" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("aciona onCancel ao clicar em Cancelar ou fechar via Escape", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const { rerender } = render(
      <EditorialConfirmDialog
        open={true}
        title="Arquivar matéria"
        confirmLabel="Arquivar"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledOnce();

    // O primitive compartilhado trata Escape e devolve o estado ao controlador.
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(2);

    rerender(
      <EditorialConfirmDialog
        open={false}
        title="Arquivar matéria"
        confirmLabel="Arquivar"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("desabilita botões quando pending é verdadeiro", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <EditorialConfirmDialog
        open={true}
        title="Restaurar matéria"
        confirmLabel="Restaurar"
        pending={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole("button", { name: "Restaurar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });
});
