import { z } from "zod";

const allowedLinkProtocols = new Set(["http:", "https:", "mailto:"]);

function isAllowedEditorialLink(href: string) {
  if (href.startsWith("/")) return !href.startsWith("//");

  try {
    return allowedLinkProtocols.has(new URL(href).protocol);
  } catch {
    return false;
  }
}

const markSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bold") }).strict(),
  z.object({ type: z.literal("italic") }).strict(),
  z
    .object({
      type: z.literal("link"),
      attrs: z
        .object({ href: z.string().refine(isAllowedEditorialLink) })
        .strict(),
    })
    .strict(),
]);

const textNodeSchema = z
  .object({
    type: z.literal("text"),
    text: z.string().min(1),
    marks: z.array(markSchema).min(1).optional(),
  })
  .strict();

const inlineContentSchema = z.array(textNodeSchema).min(1);
const paragraphNodeSchema = z
  .object({ type: z.literal("paragraph"), content: inlineContentSchema })
  .strict();
const headingNodeSchema = z
  .object({
    type: z.literal("heading"),
    attrs: z.object({ level: z.union([z.literal(2), z.literal(3)]) }).strict(),
    content: inlineContentSchema,
  })
  .strict();
const imageNodeSchema = z
  .object({
    type: z.literal("image"),
    attrs: z.object({ mediaId: z.uuid(), alt: z.string().min(1) }).strict(),
  })
  .strict();

const listItemNodeSchema = z
  .object({
    type: z.literal("listItem"),
    content: z.array(paragraphNodeSchema).min(1),
  })
  .strict();
const bulletListNodeSchema = z
  .object({
    type: z.literal("bulletList"),
    content: z.array(listItemNodeSchema).min(1),
  })
  .strict();
const orderedListNodeSchema = z
  .object({
    type: z.literal("orderedList"),
    content: z.array(listItemNodeSchema).min(1),
  })
  .strict();
const blockquoteNodeSchema = z
  .object({
    type: z.literal("blockquote"),
    content: z.array(paragraphNodeSchema).min(1),
  })
  .strict();

const editorialContentNodeSchema = z.discriminatedUnion("type", [
  paragraphNodeSchema,
  headingNodeSchema,
  bulletListNodeSchema,
  orderedListNodeSchema,
  blockquoteNodeSchema,
  imageNodeSchema,
]);

export const editorialDocumentV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    type: z.literal("doc"),
    content: z.array(editorialContentNodeSchema).min(1),
  })
  .strict();

export type EditorialDocumentV1 = z.infer<typeof editorialDocumentV1Schema>;

type EditorialContentNode = EditorialDocumentV1["content"][number];
type EditorialListItemNode = z.infer<typeof listItemNodeSchema>;

function visibleText(node: EditorialContentNode): string[] {
  if (node.type === "paragraph" || node.type === "heading") {
    return node.content.map((textNode) => textNode.text);
  }
  if (node.type === "blockquote") {
    return node.content.flatMap(visibleText);
  }
  if (node.type === "bulletList" || node.type === "orderedList") {
    return node.content.flatMap((item) => item.content.flatMap(visibleText));
  }
  return [];
}

const tiptapDocumentSchema = z
  .object({
    type: z.literal("doc"),
    content: z.unknown(),
  })
  .strict();

export function tiptapDocumentToEditorialDocumentV1(
  input: unknown,
): EditorialDocumentV1 {
  const document = tiptapDocumentSchema.parse(input);
  return editorialDocumentV1Schema.parse({ ...document, schemaVersion: 1 });
}

const publicImageNodeSchema = z
  .object({
    type: z.literal("image"),
    attrs: z
      .object({
        mediaId: z.uuid(),
        alt: z.string().min(1),
        src: z.url(),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      })
      .strict(),
  })
  .strict();
const publicEditorialContentNodeSchema = z.discriminatedUnion("type", [
  paragraphNodeSchema,
  headingNodeSchema,
  bulletListNodeSchema,
  orderedListNodeSchema,
  blockquoteNodeSchema,
  publicImageNodeSchema,
]);

export const publicEditorialDocumentV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    type: z.literal("doc"),
    content: z.array(publicEditorialContentNodeSchema).min(1),
  })
  .strict();

export type PublicEditorialDocumentV1 = z.infer<
  typeof publicEditorialDocumentV1Schema
>;

export function calculateEditorialReadTime(input: unknown) {
  const document = editorialDocumentV1Schema.parse(input);
  const words = document.content
    .flatMap(visibleText)
    .flatMap((text) => text.trim().split(/\s+/u))
    .filter(Boolean).length;

  return Math.min(30, Math.max(1, Math.ceil(words / 200)));
}

type PublicMedia = Readonly<
  Record<string, { src: string; width: number; height: number }>
>;

function resolveListItemMedia(
  item: EditorialListItemNode,
  media: PublicMedia,
): unknown {
  return {
    ...item,
    content: item.content.map((child) => resolveNodeMedia(child, media)),
  };
}

function resolveNodeMedia(
  node: EditorialContentNode,
  media: PublicMedia,
): unknown {
  if (node.type === "image") {
    const resolved = media[node.attrs.mediaId];
    if (!resolved) throw new Error("A imagem editorial não está disponível.");
    return {
      ...node,
      attrs: { ...node.attrs, ...resolved },
    };
  }
  if (node.type === "blockquote") {
    return {
      ...node,
      content: node.content.map((child) => resolveNodeMedia(child, media)),
    };
  }
  if (node.type === "bulletList" || node.type === "orderedList") {
    return {
      ...node,
      content: node.content.map((item) => resolveListItemMedia(item, media)),
    };
  }
  return node;
}

export function resolveEditorialDocumentMedia(
  input: unknown,
  media: PublicMedia,
): PublicEditorialDocumentV1 {
  const document = editorialDocumentV1Schema.parse(input);
  return publicEditorialDocumentV1Schema.parse({
    ...document,
    content: document.content.map((node) => resolveNodeMedia(node, media)),
  });
}
