import { describe, expect, it } from "vitest";

import {
  calculateEditorialReadTime,
  editorialDocumentSchema,
  editorialDocumentV1Schema,
  editorialDocumentV2Schema,
  editorialDocumentV3Schema,
  getEditorialMediaIds,
  getStorableEditorialMediaIds,
  persistedEditorialDocumentSchema,
  persistedEditorialDocumentV1Schema,
  storableEditorialDocumentV1Schema,
  resolveEditorialDocumentMedia,
  tiptapDocumentToEditorialDocumentV1,
  tiptapDocumentToEditorialDocumentV2,
  tiptapDocumentToEditorialDocumentV3,
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

  it("preserva um parágrafo vazio ao normalizar um rascunho sem corpo", () => {
    expect(
      tiptapDocumentToEditorialDocumentV1({
        type: "doc",
        content: [{ type: "paragraph" }],
      }),
    ).toEqual({
      schemaVersion: 1,
      type: "doc",
      content: [{ type: "paragraph", content: [] }],
    });
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,unsafe",
    "//externo.nite.test",
    "/\\externo.nite.test",
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

  it("rejeita alt de imagem formado somente por espaços", () => {
    expect(() =>
      persistedEditorialDocumentV1Schema.parse({
        ...document,
        content: [
          {
            type: "image",
            attrs: { mediaId: imageMediaId, alt: "   " },
          },
        ],
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

  it("permite armazenar um corpo vazio em uma revisão de rascunho", () => {
    const emptyDraft = {
      schemaVersion: 1 as const,
      type: "doc" as const,
      content: [{ type: "paragraph" as const, content: [] }],
    };

    expect(storableEditorialDocumentV1Schema.parse(emptyDraft)).toEqual(
      emptyDraft,
    );
    expect(() => persistedEditorialDocumentV1Schema.parse(emptyDraft)).toThrow(
      /conteúdo significativo/i,
    );
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

describe("documento editorial v2", () => {
  const documentV2 = {
    schemaVersion: 2,
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Contexto da imagem editorial." }],
      },
      {
        type: "image",
        attrs: {
          mediaId: imageMediaId,
          alt: "Pessoas no laboratório",
          caption: "Equipe durante a atividade.",
          credit: "Foto: NITE",
          layout: "wide",
        },
      },
    ],
  } as const;

  it("mantém V1 legível e aceita metadados estruturados apenas em V2", () => {
    expect(editorialDocumentSchema.parse(document)).toEqual(document);
    expect(editorialDocumentV2Schema.parse(documentV2)).toEqual(documentV2);
    expect(() => editorialDocumentV1Schema.parse(documentV2)).toThrow();
  });

  it("grava novos documentos como V2 e assume largura normal", () => {
    expect(
      tiptapDocumentToEditorialDocumentV2({
        type: "doc",
        content: [
          {
            type: "image",
            attrs: {
              mediaId: imageMediaId,
              alt: "Pessoas no laboratório",
              caption: "Equipe durante a atividade.",
              credit: "Foto: NITE",
            },
          },
        ],
      }),
    ).toEqual({
      schemaVersion: 2,
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            mediaId: imageMediaId,
            alt: "Pessoas no laboratório",
            caption: "Equipe durante a atividade.",
            credit: "Foto: NITE",
            layout: "normal",
          },
        },
      ],
    });
  });

  it("preserva os metadados ao resolver a mídia pública", () => {
    const resolved = resolveEditorialDocumentMedia(documentV2, {
      [imageMediaId]: {
        src: "https://media.nite.test/news/laboratorio.webp",
        width: 1600,
        height: 900,
      },
    });

    expect(resolved).toMatchObject({
      schemaVersion: 2,
      content: [
        expect.anything(),
        {
          attrs: {
            caption: "Equipe durante a atividade.",
            credit: "Foto: NITE",
            layout: "wide",
            src: "https://media.nite.test/news/laboratorio.webp",
          },
        },
      ],
    });
    expect(() => persistedEditorialDocumentSchema.parse(resolved)).toThrow(
      /não pode ser persistida/i,
    );
  });
});

describe("documento editorial v3", () => {
  const videoMediaId = "30000000-0000-4000-8000-000000000301";
  const captionsMediaId = "30000000-0000-4000-8000-000000000302";
  const storedVideo = {
    type: "video",
    attrs: {
      mediaId: videoMediaId,
      captionsMediaId,
      playbackMode: "manual",
      layout: "wide",
      description: "Demonstração do laboratório de inovação.",
      caption: "Apresentação do projeto.",
      credit: "Vídeo: NITE",
    },
  } as const;
  const storedDocument = {
    schemaVersion: 3,
    type: "doc",
    content: [storedVideo],
  } as const;

  it("preserva V1/V2 e aceita vídeo armazenado somente no topo de V3", () => {
    expect(editorialDocumentSchema.parse(document)).toEqual(document);
    expect(
      editorialDocumentSchema.parse({
        schemaVersion: 2,
        type: "doc",
        content: [
          {
            type: "image",
            attrs: {
              mediaId: imageMediaId,
              alt: "Pessoas no laboratório",
              layout: "normal",
            },
          },
        ],
      }),
    ).toBeDefined();
    expect(editorialDocumentV3Schema.parse(storedDocument)).toEqual(
      storedDocument,
    );
    expect(() =>
      editorialDocumentV3Schema.parse({
        schemaVersion: 3,
        type: "doc",
        content: [
          {
            type: "blockquote",
            content: [storedVideo],
          },
        ],
      }),
    ).toThrow();
  });

  it("separa atributos armazenados da resolução pública do vídeo", () => {
    const resolved = resolveEditorialDocumentMedia(storedDocument, {
      [videoMediaId]: {
        mediaKind: "video",
        src: "https://media.nite.test/news/video.mp4",
        mimeType: "video/mp4",
        width: 1920,
        height: 1080,
        durationSeconds: 42.5,
      },
      [captionsMediaId]: {
        mediaKind: "captions",
        src: "https://media.nite.test/news/video.pt-BR.vtt",
        mimeType: "text/vtt",
      },
    });

    expect(resolved).toEqual({
      schemaVersion: 3,
      type: "doc",
      content: [
        {
          ...storedVideo,
          attrs: {
            ...storedVideo.attrs,
            src: "https://media.nite.test/news/video.mp4",
            width: 1920,
            height: 1080,
            durationSeconds: 42.5,
            mimeType: "video/mp4",
            captions: {
              src: "https://media.nite.test/news/video.pt-BR.vtt",
              mimeType: "text/vtt",
              srclang: "pt-BR",
              label: "Português",
            },
          },
        },
      ],
    });
    expect(() => persistedEditorialDocumentSchema.parse(resolved)).toThrow(
      /não pode ser persistida/i,
    );
  });

  it("coleta imagens, vídeos e legendas sem duplicar referências", () => {
    const input = {
      schemaVersion: 3,
      type: "doc",
      content: [
        storedVideo,
        storedVideo,
        {
          type: "image",
          attrs: {
            mediaId: imageMediaId,
            alt: "Pessoas no laboratório",
            layout: "normal",
          },
        },
      ],
    };

    expect(getEditorialMediaIds(input)).toEqual([
      videoMediaId,
      captionsMediaId,
      imageMediaId,
    ]);
    expect(getStorableEditorialMediaIds(input)).toEqual([
      videoMediaId,
      captionsMediaId,
      imageMediaId,
    ]);
  });

  it("normaliza novos documentos Tiptap como V3 e considera vídeo significativo", () => {
    expect(
      tiptapDocumentToEditorialDocumentV3({
        type: "doc",
        content: [
          {
            type: "video",
            attrs: {
              mediaId: videoMediaId,
              playbackMode: "autoplay",
              layout: "full",
              description: "  Visão geral do projeto.  ",
              caption: " ",
            },
          },
        ],
      }),
    ).toEqual({
      schemaVersion: 3,
      type: "doc",
      content: [
        {
          type: "video",
          attrs: {
            mediaId: videoMediaId,
            playbackMode: "autoplay",
            layout: "full",
            description: "Visão geral do projeto.",
          },
        },
      ],
    });
    expect(persistedEditorialDocumentSchema.parse(storedDocument)).toEqual(
      storedDocument,
    );
  });
});
