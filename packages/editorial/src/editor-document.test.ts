import { describe, expect, it } from "vitest";

import {
  calculateEditorialReadTime,
  editorialDocumentV1Schema,
  persistedEditorialDocumentV1Schema,
  resolveEditorialDocumentMedia,
  tiptapDocumentToEditorialDocumentV1,
} from "@nite/editorial";

const imageMediaId = "30000000-0000-4000-8000-000000000101";

const document = {
  schemaVersion: 1,
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Agenda editorial" }],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Texto " },
        { type: "text", text: "em destaque", marks: [{ type: "bold" }] },
        {
          type: "text",
          text: " com referência.",
          marks: [
            { type: "link", attrs: { href: "/atualizacoes" } },
            { type: "italic" },
          ],
        },
      ],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Primeiro item" }],
            },
          ],
        },
      ],
    },
    {
      type: "orderedList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Segundo item" }],
            },
          ],
        },
      ],
    },
    {
      type: "blockquote",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Uma citação completa." }],
        },
      ],
    },
    {
      type: "heading",
      attrs: { level: 3 },
      content: [{ type: "text", text: "Próximos passos" }],
    },
    {
      type: "image",
      attrs: { mediaId: imageMediaId, alt: "Pessoas no laboratório" },
    },
  ],
} as const;

describe("documento editorial v1", () => {
  it("aceita o AST canônico, incluindo nós, marks e referências de mídia", () => {
    expect(editorialDocumentV1Schema.parse(document)).toEqual(document);
  });

  it("normaliza o JSON do Tiptap para a raiz canônica versionada", () => {
    const tiptapDocument = {
      type: document.type,
      content: document.content,
    };
    expect(tiptapDocumentToEditorialDocumentV1(tiptapDocument)).toEqual(
      document,
    );
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,unsafe",
    "//externo.nite.test",
    "ftp://arquivos.nite.test/materia",
  ])("rejeita link fora da allowlist: %s", (href) => {
    expect(() =>
      editorialDocumentV1Schema.parse({
        ...document,
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Link inválido",
                marks: [{ type: "link", attrs: { href } }],
              },
            ],
          },
        ],
      }),
    ).toThrow();
  });

  it("rejeita HTML, vídeo e nós fora do contrato", () => {
    expect(() =>
      editorialDocumentV1Schema.parse({
        ...document,
        content: [{ type: "video", src: "https://video.nite.test/a.mp4" }],
      }),
    ).toThrow();
  });

  it("rejeita listItem fora de uma lista", () => {
    expect(() =>
      editorialDocumentV1Schema.parse({
        ...document,
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Item fora da lista" }],
              },
            ],
          },
        ],
      }),
    ).toThrow();
  });

  it("calcula a leitura pelo texto visível com ceil e clamp", () => {
    const words = Array.from({ length: 201 }, () => "palavra").join(" ");
    const longDocument = {
      schemaVersion: 1,
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: words }],
        },
      ],
    } as const;

    expect(calculateEditorialReadTime(longDocument)).toBe(2);
    expect(calculateEditorialReadTime(document)).toBe(1);
    expect(
      calculateEditorialReadTime({
        ...longDocument,
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: Array.from({ length: 6_001 }, () => "palavra").join(" "),
              },
            ],
          },
        ],
      }),
    ).toBe(30);
  });

  it("resolve a imagem no mesmo AST para o contrato público", () => {
    expect(
      resolveEditorialDocumentMedia(document, {
        [imageMediaId]: {
          src: "https://media.nite.test/news/laboratorio.webp",
          width: 1200,
          height: 675,
        },
      }),
    ).toMatchObject({
      schemaVersion: 1,
      content: [
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        {
          type: "image",
          attrs: {
            mediaId: imageMediaId,
            alt: "Pessoas no laboratório",
            src: "https://media.nite.test/news/laboratorio.webp",
            width: 1200,
            height: 675,
          },
        },
      ],
    });
  });

  it("mantém um único contrato quando a fronteira pública resolve a imagem", () => {
    const resolved = resolveEditorialDocumentMedia(document, {
      [imageMediaId]: {
        src: "https://media.nite.test/news/laboratorio.webp",
        width: 1200,
        height: 675,
      },
    });

    expect(editorialDocumentV1Schema.parse(resolved)).toEqual(resolved);
    expect(() => persistedEditorialDocumentV1Schema.parse(resolved)).toThrow(
      /não pode ser persistida/i,
    );
  });

  it("rejeita resolução pública de imagem aninhada na entrada persistida", () => {
    expect(() =>
      persistedEditorialDocumentV1Schema.parse({
        schemaVersion: 1,
        type: "doc",
        content: [
          {
            type: "blockquote",
            content: [
              {
                type: "image",
                attrs: {
                  mediaId: imageMediaId,
                  alt: "Pessoas no laboratório",
                  src: "https://media.nite.test/news/laboratorio.webp",
                  width: 1200,
                  height: 675,
                },
              },
            ],
          },
        ],
      }),
    ).toThrow(/não pode ser persistida/i);
  });

  it("rejeita documento persistido sem texto visível nem imagem", () => {
    expect(() =>
      persistedEditorialDocumentV1Schema.parse({
        schemaVersion: 1,
        type: "doc",
        content: [
          { type: "paragraph", content: [] },
          {
            type: "blockquote",
            content: [
              {
                type: "heading",
                attrs: { level: 2 },
                content: [{ type: "text", text: "   " }],
              },
            ],
          },
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [{ type: "paragraph", content: [] }],
              },
            ],
          },
        ],
      }),
    ).toThrow(/conteúdo significativo/i);
  });

  it("aceita documento persistido composto somente por imagem", () => {
    expect(
      persistedEditorialDocumentV1Schema.parse({
        schemaVersion: 1,
        type: "doc",
        content: [
          {
            type: "image",
            attrs: { mediaId: imageMediaId, alt: "Pessoas no laboratório" },
          },
        ],
      }),
    ).toMatchObject({ content: [{ type: "image" }] });
  });
});
