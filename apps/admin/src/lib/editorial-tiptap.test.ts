import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";

import {
  tiptapDocumentToEditorialDocumentV1,
  tiptapDocumentToEditorialDocumentV2,
} from "@nite/editorial";
import {
  createEditorialTiptapExtensions,
  normalizeEditorialPastedHtml,
} from "./editorial-tiptap";

describe("integração Tiptap editorial", () => {
  const editors: Editor[] = [];

  afterEach(() => {
    editors.splice(0).forEach((editor) => editor.destroy());
  });

  it("normaliza o JSON real das extensões permitidas antes de validar", () => {
    const editor = new Editor({
      extensions: createEditorialTiptapExtensions(),
      content: {
        type: "doc",
        content: [
          {
            type: "blockquote",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Citação editorial." }],
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
                    content: [
                      {
                        type: "text",
                        text: "Referência interna.",
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
              },
            ],
          },
        ],
      },
    });
    editors.push(editor);

    const rawDocument = editor.getJSON();
    expect(rawDocument).toMatchObject({
      content: [
        { type: "blockquote", attrs: { attribution: null } },
        {
          type: "orderedList",
          attrs: { start: 1, type: null },
          content: [
            {
              content: [
                {
                  content: [
                    {
                      marks: [
                        {
                          attrs: {
                            href: "/atualizacoes",
                            target: "_blank",
                            rel: "noopener noreferrer nofollow",
                            class: null,
                            title: null,
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(tiptapDocumentToEditorialDocumentV1(rawDocument)).toEqual({
      schemaVersion: 1,
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Citação editorial." }],
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
                  content: [
                    {
                      type: "text",
                      text: "Referência interna.",
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
            },
          ],
        },
      ],
    });
  });

  it("preserva uma imagem canônica ao abrir e salvar no Tiptap", () => {
    const editor = new Editor({
      extensions: createEditorialTiptapExtensions(),
      content: {
        type: "doc",
        content: [
          {
            type: "image",
            attrs: {
              mediaId: "30000000-0000-4000-8000-000000000101",
              alt: "Pessoas no laboratório",
            },
          },
        ],
      },
    });
    editors.push(editor);

    expect(tiptapDocumentToEditorialDocumentV1(editor.getJSON())).toEqual({
      schemaVersion: 1,
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            mediaId: "30000000-0000-4000-8000-000000000101",
            alt: "Pessoas no laboratório",
          },
        },
      ],
    });
  });

  it("preserva os campos públicos de imagem quando estiverem presentes", () => {
    const editor = new Editor({
      extensions: createEditorialTiptapExtensions(),
      content: {
        type: "doc",
        content: [
          {
            type: "image",
            attrs: {
              mediaId: "30000000-0000-4000-8000-000000000101",
              alt: "Pessoas no laboratório",
              src: "https://media.nite.test/news/laboratorio.webp",
              width: 1200,
              height: 675,
            },
          },
        ],
      },
    });
    editors.push(editor);

    expect(tiptapDocumentToEditorialDocumentV1(editor.getJSON())).toMatchObject(
      {
        content: [
          {
            type: "image",
            attrs: {
              mediaId: "30000000-0000-4000-8000-000000000101",
              src: "https://media.nite.test/news/laboratorio.webp",
              width: 1200,
              height: 675,
            },
          },
        ],
      },
    );
  });

  it("preserva os metadados editoriais de imagem no documento V2", () => {
    const editor = new Editor({
      extensions: createEditorialTiptapExtensions(),
      content: {
        type: "doc",
        content: [
          {
            type: "image",
            attrs: {
              mediaId: "30000000-0000-4000-8000-000000000101",
              alt: "Pessoas no laboratório",
              caption: "Equipe reunida durante a oficina.",
              credit: "Foto: Acervo NITE",
              layout: "full",
            },
          },
        ],
      },
    });
    editors.push(editor);

    expect(tiptapDocumentToEditorialDocumentV2(editor.getJSON())).toEqual({
      schemaVersion: 2,
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            mediaId: "30000000-0000-4000-8000-000000000101",
            alt: "Pessoas no laboratório",
            caption: "Equipe reunida durante a oficina.",
            credit: "Foto: Acervo NITE",
            layout: "full",
          },
        },
      ],
    });
  });

  it("limpa estilos e elementos inseguros da colagem sem perder semântica", () => {
    const pasted = normalizeEditorialPastedHtml(
      '<h2 class="MsoTitle" style="margin-left: 40px">Título</h2>' +
        '<p id="docs-internal-guid"><strong style="font-weight:700">Texto</strong> <a href="https://nite.test" onclick="alert(1)">fonte</a></p>' +
        '<script>alert(1)</script><iframe src="https://unsafe.test"></iframe>',
    );

    expect(pasted).toBe(
      '<h2>Título</h2><p><strong>Texto</strong> <a href="https://nite.test">fonte</a></p>',
    );
  });

  it("não registra nós ou marks fora do contrato editorial", () => {
    const editor = new Editor({
      extensions: createEditorialTiptapExtensions(),
      content: {
        type: "doc",
        content: [
          {
            type: "image",
            attrs: {
              mediaId: "30000000-0000-4000-8000-000000000101",
              alt: "Imagem editorial",
            },
          },
        ],
      },
    });
    editors.push(editor);

    expect(
      editor.extensionManager.extensions.map((extension) => extension.name),
    ).not.toEqual(
      expect.arrayContaining(["hardBreak", "underline", "trailingNode"]),
    );
    expect(editor.getJSON().content).toHaveLength(1);
  });

  it("preserva um parágrafo vazio intermediário do JSON real", () => {
    const editor = new Editor({
      extensions: createEditorialTiptapExtensions(),
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Antes." }],
          },
          { type: "paragraph" },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Depois." }],
          },
        ],
      },
    });
    editors.push(editor);

    expect(tiptapDocumentToEditorialDocumentV1(editor.getJSON())).toMatchObject(
      {
        content: [
          { type: "paragraph", content: [{ text: "Antes." }] },
          { type: "paragraph", content: [] },
          { type: "paragraph", content: [{ text: "Depois." }] },
        ],
      },
    );
  });

  it("preserva heading dentro de blockquote no JSON real", () => {
    const editor = new Editor({
      extensions: createEditorialTiptapExtensions(),
      content: {
        type: "doc",
        content: [
          {
            type: "blockquote",
            content: [
              {
                type: "heading",
                attrs: { level: 2 },
                content: [{ type: "text", text: "Uma citação em título" }],
              },
            ],
          },
        ],
      },
    });
    editors.push(editor);

    expect(tiptapDocumentToEditorialDocumentV1(editor.getJSON())).toMatchObject(
      {
        content: [
          {
            type: "blockquote",
            content: [
              {
                type: "heading",
                attrs: { level: 2 },
                content: [{ text: "Uma citação em título" }],
              },
            ],
          },
        ],
      },
    );
  });

  it("preserva lista aninhada dentro de listItem no JSON real", () => {
    const editor = new Editor({
      extensions: createEditorialTiptapExtensions(),
      content: {
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Item pai" }],
                  },
                  {
                    type: "orderedList",
                    content: [
                      {
                        type: "listItem",
                        content: [
                          {
                            type: "paragraph",
                            content: [{ type: "text", text: "Item filho" }],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    editors.push(editor);

    expect(tiptapDocumentToEditorialDocumentV1(editor.getJSON())).toMatchObject(
      {
        content: [
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  { type: "paragraph", content: [{ text: "Item pai" }] },
                  {
                    type: "orderedList",
                    content: [
                      {
                        type: "listItem",
                        content: [
                          {
                            type: "paragraph",
                            content: [{ text: "Item filho" }],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    );
  });
});
