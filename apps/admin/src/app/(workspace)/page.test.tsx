import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listEditorialArticles: vi.fn(),
  requireCmsPageContext: vi.fn(),
}));

vi.mock("@nite/editorial", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@nite/editorial")>()),
  listEditorialArticles: mocks.listEditorialArticles,
}));

vi.mock("@/lib/auth", () => ({
  requireCmsPageContext: mocks.requireCmsPageContext,
}));

import DashboardPage from "./page";

describe("DashboardPage", () => {
  beforeEach(() => {
    mocks.requireCmsPageContext.mockResolvedValue({
      database: {},
      membership: {},
    });
    mocks.listEditorialArticles.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renderiza Nova matéria como link sem warning de semântica de botão", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    render(await DashboardPage());

    expect(screen.getByRole("link", { name: "Nova matéria" })).toHaveAttribute(
      "href",
      "/articles/new",
    );
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain(
      "nativeButton` prop is true",
    );
  });
});
