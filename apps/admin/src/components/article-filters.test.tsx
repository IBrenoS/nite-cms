import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ArticleFilters } from "./article-filters";

const categories = [
  { value: "inovacao", label: "Inovação" },
  { value: "tecnologia", label: "Tecnologia" },
];

describe("ArticleFilters", () => {
  afterEach(cleanup);

  it("abre e fecha os filtros móveis restaurando o foco", () => {
    render(<ArticleFilters categories={categories} />);

    const trigger = screen.getByRole("button", { name: "Abrir filtros" });
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Filtros de matérias" });
    expect(
      within(dialog).getByLabelText("Filtrar por estado"),
    ).toBeInTheDocument();

    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(
      screen.queryByRole("dialog", { name: "Filtros de matérias" }),
    ).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("preserva uma largura intrínseca quando o resumo usa duas colunas", () => {
    render(<ArticleFilters categories={categories} />);

    expect(screen.getByRole("search")).toHaveClass("min-[1480px]:w-auto");
  });
});
