import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireCmsPageContext: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  requireCmsPageContext: mocks.requireCmsPageContext,
}));

import MembershipsPage from "./page";

describe("página Equipe e acessos", () => {
  afterEach(cleanup);

  it("nega publisher antes de consultar membros ou convites", async () => {
    const select = vi.fn();
    mocks.requireCmsPageContext.mockResolvedValue({
      membership: {
        id: "10000000-0000-4000-8000-000000000001",
        tenantId: "20000000-0000-4000-8000-000000000001",
        role: "publisher",
      },
      database: { select },
    });

    render(await MembershipsPage());

    expect(
      screen.getByRole("heading", { name: "Acesso negado" }),
    ).toBeInTheDocument();
    expect(select).not.toHaveBeenCalled();
  });
});
