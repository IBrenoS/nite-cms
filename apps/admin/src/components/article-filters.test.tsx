import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArticleFilters } from "./article-filters";

const categories = [
  { value: "inovacao", label: "Inovação" },
  { value: "tecnologia", label: "Tecnologia" },
];

describe("ArticleFilters", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("usa as visões editoriais para estado e deixa o sheet focado em filtros", async () => {
    render(<ArticleFilters categories={categories} status="draft" />);

    expect(
      screen.queryByLabelText("Filtrar por estado"),
    ).not.toBeInTheDocument();

    const trigger = screen.getByRole("button", { name: "Abrir filtros" });
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Filtros" });
    expect(
      within(dialog).getByLabelText("Filtrar por categoria"),
    ).toBeInTheDocument();

    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(
      screen.queryByRole("dialog", { name: "Filtros" }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("mantém a busca como controle principal da barra editorial", () => {
    render(<ArticleFilters categories={categories} />);

    expect(screen.getByRole("search")).toHaveClass("w-full");
    expect(
      screen.getByRole("searchbox", { name: "Buscar por título ou slug" }),
    ).toHaveAttribute("placeholder", "Buscar matérias");
  });

  it("preserva a visão ao aplicar categoria", () => {
    const requestSubmit = vi
      .spyOn(HTMLFormElement.prototype, "requestSubmit")
      .mockImplementation(() => undefined);

    render(<ArticleFilters categories={categories} status="published" />);

    fireEvent.change(
      screen.getByRole("combobox", { name: "Filtrar por categoria" }),
      { target: { value: "tecnologia" } },
    );

    expect(requestSubmit).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("search").querySelector('input[name="status"]'),
    ).toHaveValue("published");
  });
});
