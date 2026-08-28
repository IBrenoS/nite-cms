import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  NewsArticleBody,
  StatusBadge,
  Textarea,
} from "./index";

afterEach(cleanup);

describe("@nite/cms-ui", () => {
  it("preserva semantica e estado pendente das acoes", () => {
    render(
      <>
        <Button loading>Salvar</Button>
        <Card>
          <CardHeader>
            <CardTitle>Materia</CardTitle>
          </CardHeader>
          <CardContent>Conteudo</CardContent>
        </Card>
      </>,
    );

    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Salvar" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(
      screen.getByText("Materia").closest("[data-slot='card']"),
    ).not.toHaveAttribute("tabindex");
  });

  it("expoe campos e status por semantica acessivel", () => {
    render(
      <>
        <Input aria-label="Titulo" />
        <Textarea aria-label="Resumo" />
        <StatusBadge status="draft" />
      </>,
    );

    expect(screen.getByRole("textbox", { name: "Titulo" })).toHaveAttribute(
      "data-slot",
      "input",
    );
    expect(screen.getByRole("textbox", { name: "Resumo" })).toHaveAttribute(
      "data-slot",
      "textarea",
    );
    expect(screen.getByText("Em estruturação")).toBeVisible();
  });

  it("renderiza blocos editoriais como estrutura, nunca como HTML bruto", () => {
    render(
      <NewsArticleBody
        blocks={[
          {
            type: "paragraph",
            text: "Um parágrafo editorial com conteúdo suficiente para leitura.",
          },
          { type: "heading", text: "Contexto acadêmico" },
          {
            type: "quote",
            text: "Uma citação editorial renderizada como texto seguro e estruturado.",
            attribution: "Equipe NITE",
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Contexto acadêmico" }),
    ).toBeVisible();
    expect(screen.getByText("Equipe NITE")).toHaveProperty("tagName", "CITE");
  });
});
