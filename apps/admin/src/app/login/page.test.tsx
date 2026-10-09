import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCmsContext: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCmsContext: mocks.getCmsContext }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import LoginPage from "./page";

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCmsContext.mockResolvedValue({ status: "anonymous" });
  });

  afterEach(cleanup);

  it("apresenta a entrada institucional com a identidade da Redação Digital", async () => {
    render(await LoginPage());

    expect(
      screen.getByRole("heading", { name: "Bem-Vindo à redação" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Entre com sua conta institucional para criar, revisar e publicar matérias.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continuar com Microsoft" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Acesso restrito à equipe autorizada do NITE"),
    ).toBeInTheDocument();
  });

  it("preserva o estado de configuração pendente sem oferecer login", async () => {
    mocks.getCmsContext.mockResolvedValue({
      status: "unconfigured",
      missing: ["DATABASE_ADMIN_URL"],
    });

    render(await LoginPage());

    expect(screen.getByText("Configuração pendente")).toBeInTheDocument();
    expect(screen.getByText(/DATABASE_ADMIN_URL/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Continuar com Microsoft" }),
    ).not.toBeInTheDocument();
  });

  it("preserva a mensagem de acesso não autorizado", async () => {
    mocks.getCmsContext.mockResolvedValue({ status: "forbidden" });

    render(await LoginPage());

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Sua conta Microsoft foi autenticada, mas não possui acesso editorial ativo ou ainda não concluiu um convite válido.",
    );
  });

  it("redireciona para a redação quando o acesso já está autenticado", async () => {
    mocks.getCmsContext.mockResolvedValue({ status: "authenticated" });

    await LoginPage();

    expect(mocks.redirect).toHaveBeenCalledWith("/");
  });
});
