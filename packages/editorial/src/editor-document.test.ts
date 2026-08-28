import { describe, expect, it } from "vitest";

import {
  newsBlocksToTiptapDocument,
  tiptapDocumentToNewsBlocks,
} from "@nite/editorial";

describe("documento do editor", () => {
  it("converte os blocos públicos para o documento estruturado do editor", () => {
    expect(
      newsBlocksToTiptapDocument([
        {
          type: "paragraph",
          text: "Texto editorial longo o suficiente para representar um parágrafo.",
        },
        { type: "heading", text: "Agenda acadêmica" },
        {
          type: "quote",
          text: "Uma citação editorial completa para preservar o contexto da matéria.",
          attribution: "Equipe NITE",
        },
      ]),
    ).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Texto editorial longo o suficiente para representar um parágrafo.",
            },
          ],
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Agenda acadêmica" }],
        },
        {
          type: "blockquote",
          attrs: { attribution: "Equipe NITE" },
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Uma citação editorial completa para preservar o contexto da matéria.",
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("rejeita nós que não pertencem ao contrato editorial público", () => {
    expect(() =>
      tiptapDocumentToNewsBlocks({
        type: "doc",
        content: [{ type: "bulletList", content: [] }],
      }),
    ).toThrow();
  });
});
