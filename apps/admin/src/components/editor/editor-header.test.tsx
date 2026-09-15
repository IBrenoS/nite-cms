import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorHeader } from "./editor-header";

describe("EditorHeader", () => {
  afterEach(cleanup);

  it("renderiza cópias e hierarquia para Nova matéria (rascunho inicial)", () => {
    render(
      <EditorHeader
        isExisting={false}
        status={{ status: "warning", label: "Ainda não salva" }}
        pending={false}
        operationPending={false}
        canPublish={true}
        currentStatus="draft"
        openLivePreview={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Nova matéria" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ainda não salva")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Salvar rascunho" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Visualizar" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Publicar matéria" }),
    ).toBeInTheDocument();
  });

  it("renderiza cópias para rascunho existente salvo", () => {
    render(
      <EditorHeader
        isExisting={true}
        articleId="10000000-0000-4000-8000-000000000001"
        status={{ status: "draft", label: "Rascunho · v1" }}
        pending={false}
        operationPending={false}
        canPublish={true}
        currentStatus="draft"
        openLivePreview={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Editar matéria" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Rascunho · v1")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Salvar revisão" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Publicar matéria" }),
    ).toBeInTheDocument();
  });

  it("renderiza 'Publicar alterações' quando a matéria já está publicada", () => {
    render(
      <EditorHeader
        isExisting={true}
        articleId="10000000-0000-4000-8000-000000000001"
        status={{ status: "warning", label: "Alterações não publicadas · v3" }}
        pending={false}
        operationPending={false}
        canPublish={true}
        currentStatus="published"
        hasUnpublishedChanges={true}
        openLivePreview={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Editar matéria" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Publicar alterações" }),
    ).toBeInTheDocument();
  });
});
