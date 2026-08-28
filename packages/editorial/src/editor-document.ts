import { z } from "zod";

import { newsArticleSchema, type NewsBodyBlock } from "./article-schema";

const textNodeSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

const inlineContentSchema = z.array(textNodeSchema).min(1);
const paragraphNodeSchema = z.object({
  type: z.literal("paragraph"),
  content: inlineContentSchema,
});
const headingNodeSchema = z.object({
  type: z.literal("heading"),
  attrs: z.object({ level: z.literal(2) }),
  content: inlineContentSchema,
});
const blockquoteNodeSchema = z.object({
  type: z.literal("blockquote"),
  attrs: z.object({ attribution: z.string().min(3).optional() }).optional(),
  content: z.tuple([paragraphNodeSchema]),
});

export const tiptapNewsDocumentSchema = z.object({
  type: z.literal("doc"),
  content: z
    .array(
      z.discriminatedUnion("type", [
        paragraphNodeSchema,
        headingNodeSchema,
        blockquoteNodeSchema,
      ]),
    )
    .min(1),
});

export type TiptapNewsDocument = z.infer<typeof tiptapNewsDocumentSchema>;

function textContent(content: ReadonlyArray<{ text: string }>) {
  return content.map((node) => node.text).join("");
}

export function newsBlocksToTiptapDocument(
  blocks: readonly NewsBodyBlock[],
): TiptapNewsDocument {
  return {
    type: "doc",
    content: blocks.map((block) => {
      if (block.type === "heading") {
        return {
          type: "heading" as const,
          attrs: { level: 2 as const },
          content: [{ type: "text" as const, text: block.text }],
        };
      }
      if (block.type === "quote") {
        return {
          type: "blockquote" as const,
          ...(block.attribution
            ? { attrs: { attribution: block.attribution } }
            : {}),
          content: [
            {
              type: "paragraph" as const,
              content: [{ type: "text" as const, text: block.text }],
            },
          ] as const,
        };
      }
      return {
        type: "paragraph" as const,
        content: [{ type: "text" as const, text: block.text }],
      };
    }),
  };
}

export function tiptapDocumentToNewsBlocks(input: unknown): NewsBodyBlock[] {
  const document = tiptapNewsDocumentSchema.parse(input);
  const blocks = document.content.map((node) => {
    if (node.type === "heading") {
      return { type: "heading" as const, text: textContent(node.content) };
    }
    if (node.type === "blockquote") {
      return {
        type: "quote" as const,
        text: textContent(node.content[0].content),
        ...(node.attrs?.attribution
          ? { attribution: node.attrs.attribution }
          : {}),
      };
    }
    return { type: "paragraph" as const, text: textContent(node.content) };
  });

  return newsArticleSchema.shape.body.parse(blocks);
}
