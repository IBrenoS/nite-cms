import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));

import { WorkspaceShell } from "./workspace-shell";

describe("WorkspaceShell", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it("recolhe a navegação e persiste a preferência local", () => {
    render(
      <WorkspaceShell displayName="Marina Costa" role="admin">
        <p>Conteúdo editorial</p>
      </WorkspaceShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Recolher navegação" }));

    expect(screen.getByTestId("workspace-shell")).toHaveAttribute(
      "data-sidebar-collapsed",
      "true",
    );
    expect(window.localStorage.getItem("nite-cms:sidebar-collapsed:v1")).toBe(
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Expandir navegação" }),
    ).toBeInTheDocument();
  });

  it("mantém o controle da lateral na área da marca em ambos os estados", () => {
    render(
      <WorkspaceShell displayName="Marina Costa" role="admin">
        <p>Conteúdo editorial</p>
      </WorkspaceShell>,
    );

    const sidebar = screen.getByLabelText("Navegação principal");
    const collapseButton = screen.getByRole("button", {
      name: "Recolher navegação",
    });

    expect(sidebar.firstElementChild).toContainElement(collapseButton);

    fireEvent.click(collapseButton);

    const expandButton = screen.getByRole("button", {
      name: "Expandir navegação",
    });
    expect(sidebar.firstElementChild).toContainElement(expandButton);
    expect(expandButton).toHaveClass("group");
  });

  it("expõe a conta no menu móvel sem esconder a saída", () => {
    render(
      <WorkspaceShell displayName="Marina Costa" role="admin">
        <p>Conteúdo editorial</p>
      </WorkspaceShell>,
    );

    expect(
      screen.getByRole("button", { name: "Abrir menu da conta" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Marina Costa").length).toBeGreaterThan(0);
  });

  it("mantém a marca e o agrupamento de navegação fora do rail compacto", () => {
    render(
      <WorkspaceShell displayName="Marina Costa" role="admin">
        <p>Conteúdo editorial</p>
      </WorkspaceShell>,
    );

    const brandDetails = screen.getByLabelText(
      "Redação Digital do NITE — Matérias",
    ).parentElement;

    expect(brandDetails).toHaveClass("md:hidden", "inspector-rail:flex");
    expect(screen.getAllByText("Redação")[0]).toHaveClass(
      "md:hidden",
      "inspector-rail:block",
    );
  });

  it("oculta a marca expandida quando a navegação larga é recolhida", () => {
    render(
      <WorkspaceShell displayName="Marina Costa" role="admin">
        <p>Conteúdo editorial</p>
      </WorkspaceShell>,
    );

    const expandedBrand = screen.getByLabelText(
      "Redação Digital do NITE — Matérias",
    ).parentElement;

    fireEvent.click(screen.getByRole("button", { name: "Recolher navegação" }));

    expect(expandedBrand).toHaveClass("inspector-rail:hidden");
  });

  it("exibe o glyph editorial na marca da navegação principal", () => {
    render(
      <WorkspaceShell displayName="Marina Costa" role="admin">
        <p>Conteúdo editorial</p>
      </WorkspaceShell>,
    );

    const brand = screen.getByLabelText("Redação Digital do NITE — Matérias");
    const glyph = brand.querySelector("img");

    expect(glyph).toHaveAttribute("src", "/nite-editorial-glyph.png");
  });
});
