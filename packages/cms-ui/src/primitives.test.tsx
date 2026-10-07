import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  IconButton,
  Input,
  NewsArticleBody,
  Select,
  Separator,
  Skeleton,
  Spinner,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarSeparator,
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

  it("renderiza o documento editorial estruturado, nunca como HTML bruto", () => {
    render(
      <NewsArticleBody
        document={{
          schemaVersion: 1,
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 2 },
              content: [{ type: "text", text: "Contexto acadêmico" }],
            },
            {
              type: "blockquote",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: "Uma citação editorial renderizada como texto seguro e estruturado.",
                    },
                  ],
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Leia a referência.",
                  marks: [
                    {
                      type: "link",
                      attrs: { href: "/atualizacoes" },
                    },
                  ],
                },
              ],
            },
          ],
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Contexto acadêmico" }),
    ).toBeVisible();
    expect(
      screen
        .getByText(
          "Uma citação editorial renderizada como texto seguro e estruturado.",
        )
        .closest("blockquote"),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Leia a referência." }),
    ).toHaveAttribute("href", "/atualizacoes");
  });

  it("renderiza legenda e crédito de imagem V2 sem exibir o alt", () => {
    render(
      <NewsArticleBody
        document={{
          schemaVersion: 2,
          type: "doc",
          content: [
            {
              type: "image",
              attrs: {
                mediaId: "30000000-0000-4000-8000-000000000101",
                src: "https://media.nite.test/imagem.webp",
                width: 1600,
                height: 900,
                alt: "Descrição exclusiva para leitores de tela",
                caption: "Equipe durante a oficina.",
                credit: "Foto: NITE",
                layout: "wide",
              },
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole("img")).toHaveAttribute(
      "alt",
      "Descrição exclusiva para leitores de tela",
    );
    expect(screen.getByText("Equipe durante a oficina.")).toBeVisible();
    expect(screen.getByText("Foto: NITE")).toBeVisible();
    expect(
      screen.queryByText("Descrição exclusiva para leitores de tela"),
    ).toBeNull();
    expect(screen.getByRole("figure")).toHaveAttribute(
      "data-editorial-layout",
      "wide",
    );
  });

  it("renderiza vídeo manual V3 com WebVTT e largura editorial", () => {
    render(
      <NewsArticleBody
        document={{
          schemaVersion: 3,
          type: "doc",
          content: [
            {
              type: "video",
              attrs: {
                mediaId: "30000000-0000-4000-8000-000000000201",
                captionsMediaId: "30000000-0000-4000-8000-000000000202",
                playbackMode: "manual",
                layout: "full",
                src: "https://media.nite.test/video.mp4",
                width: 1920,
                height: 1080,
                durationSeconds: 42.5,
                mimeType: "video/mp4",
                description: "Apresentação do NiteNews",
                caption: "Demonstração editorial.",
                credit: "Vídeo: NITE",
                captions: {
                  src: "https://media.nite.test/pt-BR.vtt",
                  mimeType: "text/vtt",
                  srclang: "pt-BR",
                  label: "Português",
                },
              },
            },
          ],
        }}
      />,
    );

    const video = document.querySelector("video");
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveAttribute("crossorigin", "anonymous");
    expect(video).toHaveAttribute("preload", "metadata");
    expect(video).not.toHaveAttribute("autoplay");
    expect(document.querySelector("track")).toHaveAttribute("srclang", "pt-BR");
    expect(screen.getByText("Demonstração editorial.")).toBeVisible();
    expect(screen.getByRole("figure")).toHaveAttribute(
      "data-editorial-layout",
      "full",
    );
  });

  it("limita vídeo normal ao padrão editorial de 806,4 px", () => {
    render(
      <NewsArticleBody
        document={{
          schemaVersion: 3,
          type: "doc",
          content: [
            {
              type: "video",
              attrs: {
                mediaId: "30000000-0000-4000-8000-000000000203",
                playbackMode: "manual",
                layout: "normal",
                src: "https://media.nite.test/video-normal.mp4",
                width: 1920,
                height: 1080,
                durationSeconds: 30,
                mimeType: "video/mp4",
              },
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole("figure")).toHaveClass(
      "w-[min(50.4rem,calc(100vw-2rem))]",
      "sm:w-[min(50.4rem,calc(100vw-4rem))]",
    );
  });

  it("renderiza IconButton com rotulo acessivel e variantes de botao", () => {
    render(
      <IconButton aria-label="Abrir painel lateral" variant="ghost">
        <span data-testid="icon">≡</span>
      </IconButton>,
    );

    const button = screen.getByRole("button", {
      name: "Abrir painel lateral",
    });
    expect(button).toBeVisible();
    expect(button).toHaveAttribute("data-slot", "icon-button");
  });

  it("renderiza anatomia de formulario padrao com Field e Select", () => {
    render(
      <Field>
        <FieldLabel htmlFor="categoria">Categoria</FieldLabel>
        <Select id="categoria" aria-describedby="categoria-desc">
          <option value="tecnologia">Tecnologia</option>
          <option value="cultura">Cultura</option>
        </Select>
        <FieldDescription id="categoria-desc">
          Selecione a seção principal da matéria.
        </FieldDescription>
        <FieldError>Campo obrigatório</FieldError>
      </Field>,
    );

    expect(screen.getByLabelText("Categoria")).toBeVisible();
    expect(
      screen.getByText("Selecione a seção principal da matéria."),
    ).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("Campo obrigatório");
  });

  it("renderiza Toolbar estruturada com grupos, botoes e separadores", () => {
    render(
      <Toolbar aria-label="Formatação de texto">
        <ToolbarGroup>
          <ToolbarButton active aria-label="Negrito">
            B
          </ToolbarButton>
          <ToolbarButton aria-label="Itálico">I</ToolbarButton>
        </ToolbarGroup>
        <ToolbarSeparator />
        <ToolbarGroup>
          <ToolbarButton aria-label="Link">Link</ToolbarButton>
        </ToolbarGroup>
      </Toolbar>,
    );

    expect(
      screen.getByRole("toolbar", { name: "Formatação de texto" }),
    ).toBeVisible();
    const boldButton = screen.getByRole("button", { name: "Negrito" });
    expect(boldButton).toHaveAttribute("aria-pressed", "true");
    expect(boldButton).toHaveAttribute("data-active", "true");
  });

  it("renderiza Table editorial com cabecalho, linhas e celulas", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Novo Portal NITE</TableCell>
            <TableCell>
              <Badge variant="success">Publicada</Badge>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole("table")).toBeVisible();
    expect(screen.getByText("Novo Portal NITE")).toBeVisible();
    expect(screen.getByText("Publicada")).toHaveAttribute("data-slot", "badge");
  });

  it("renderiza Separator, Spinner, Skeleton, Avatar e Alert", () => {
    render(
      <>
        <Separator data-testid="separator" />
        <Spinner data-testid="spinner" />
        <Skeleton data-testid="skeleton" />
        <Avatar>
          <AvatarFallback>BC</AvatarFallback>
        </Avatar>
        <Alert variant="warning">
          <AlertTitle>Atenção editorial</AlertTitle>
          <AlertDescription>
            Revise a linha fina antes de publicar.
          </AlertDescription>
        </Alert>
      </>,
    );

    expect(screen.getByTestId("separator")).toHaveAttribute(
      "data-slot",
      "separator",
    );
    expect(screen.getByTestId("spinner")).toHaveAttribute(
      "data-slot",
      "spinner",
    );
    expect(screen.getByTestId("skeleton")).toHaveAttribute(
      "data-slot",
      "skeleton",
    );
    expect(screen.getByText("BC")).toBeVisible();
    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.getByText("Atenção editorial")).toBeVisible();
    expect(
      screen.getByText("Revise a linha fina antes de publicar."),
    ).toBeVisible();
  });
});
