import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCmsContext: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCmsContext: mocks.getCmsContext,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  usePathname: () => "/",
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));

import WorkspaceLayout from "./layout";

describe("WorkspaceLayout", () => {
  beforeEach(() => {
    mocks.getCmsContext.mockResolvedValue({
      status: "authorized",
      membership: {
        displayName: "Marina Costa",
        role: "admin",
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renderiza o shell editorial com Matérias ativa e acesso da equipe", async () => {
    render(
      await WorkspaceLayout({
        children: <p>Conteúdo editorial</p>,
      }),
    );

    const navigation = screen.getByRole("navigation", {
      name: "Seções do CMS",
    });
    expect(navigation).toHaveTextContent("Operação editorial");
    expect(screen.getByText("Redação Digital")).toBeInTheDocument();
    expect(
      within(navigation).getByRole("link", { name: "Matérias" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(navigation).getByRole("link", { name: "Equipe e acessos" }),
    ).toHaveAttribute("href", "/memberships");
    expect(screen.getByText("MC")).toBeInTheDocument();
    expect(screen.getByText("Marina Costa")).toBeInTheDocument();
    expect(screen.getByText("Administradora")).toBeInTheDocument();
    expect(screen.getByText("Conteúdo editorial")).toBeInTheDocument();
  });
});
