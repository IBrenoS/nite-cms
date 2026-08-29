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
const storedImageAttrsSchema = z
  .object({ mediaId: z.uuid(), alt: z.string().min(1) })
  .strict();
const resolvedImageAttrsSchema = storedImageAttrsSchema
  .extend({
    src: z.url(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strict();
const imageNodeSchema = z
  .object({
    type: z.literal("image"),
    attrs: z.union([storedImageAttrsSchema, resolvedImageAttrsSchema]),
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

export const persistedEditorialDocumentV1Schema =
  editorialDocumentV1Schema.superRefine((document, context) => {
    document.content.forEach((node, index) => {
      if (node.type === "image" && "src" in node.attrs) {
        context.addIssue({
          code: "custom",
          path: ["content", index, "attrs"],
          message: "A resolução pública de imagem não pode ser persistida.",
        });
      }
    });
  });

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
    content: z.array(z.unknown()),
  })
  .strict();

const tiptapNodeSchema = z
  .object({
    type: z.string(),
    attrs: z.unknown().optional(),
    content: z.array(z.unknown()).optional(),
    text: z.string().optional(),
    marks: z.array(z.unknown()).optional(),
  })
  .passthrough();

function nodeAttrs(input: unknown) {
  return z.record(z.string(), z.unknown()).parse(input ?? {});
}

function requiredContent(node: z.infer<typeof tiptapNodeSchema>) {
  if (!node.content) throw new Error(`O nó ${node.type} exige conteúdo.`);
  return node.content;
}

function normalizeMark(input: unknown): unknown {
  const mark = z
    .object({ type: z.string(), attrs: z.unknown().optional() })
    .passthrough()
    .parse(input);
  if (mark.type === "bold" || mark.type === "italic") {
    return { type: mark.type };
  }
  if (mark.type === "link") {
    const attrs = nodeAttrs(mark.attrs);
    return { type: "link", attrs: { href: z.string().parse(attrs.href) } };
  }
  throw new Error(`Mark editorial não permitido: ${mark.type}`);
}

function normalizeInlineNode(input: unknown): unknown {
  const node = tiptapNodeSchema.parse(input);
  if (node.type !== "text" || node.text === undefined) {
    throw new Error(`Nó inline editorial não permitido: ${node.type}`);
  }
  return {
    type: "text",
    text: node.text,
    ...(node.marks ? { marks: node.marks.map(normalizeMark) } : {}),
  };
}

function normalizeTiptapNode(input: unknown): unknown {
  const node = tiptapNodeSchema.parse(input);
  if (node.type === "paragraph") {
    return {
      type: "paragraph",
      content: requiredContent(node).map(normalizeInlineNode),
    };
  }
  if (node.type === "heading") {
    const attrs = nodeAttrs(node.attrs);
    return {
      type: "heading",
      attrs: {
        level: z.union([z.literal(2), z.literal(3)]).parse(attrs.level),
      },
      content: requiredContent(node).map(normalizeInlineNode),
    };
  }
  if (node.type === "blockquote") {
    return {
      type: "blockquote",
      content: requiredContent(node).map(normalizeTiptapNode),
    };
  }
  if (node.type === "bulletList" || node.type === "orderedList") {
    return {
      type: node.type,
      content: requiredContent(node).map(normalizeTiptapNode),
    };
  }
  if (node.type === "listItem") {
    return {
      type: "listItem",
      content: requiredContent(node).map(normalizeTiptapNode),
    };
  }
  if (node.type === "image") {
    const attrs = nodeAttrs(node.attrs);
    const mediaId = z.uuid().parse(attrs.mediaId);
    const alt = z.string().min(1).parse(attrs.alt);
    const resolved = {
      src: attrs.src ?? undefined,
      width: attrs.width ?? undefined,
      height: attrs.height ?? undefined,
    };
    return {
      type: "image",
      attrs: {
        mediaId,
        alt,
        ...(resolved.src !== undefined ||
        resolved.width !== undefined ||
        resolved.height !== undefined
          ? resolved
          : {}),
      },
    };
  }
  throw new Error(`Nó editorial não permitido: ${node.type}`);
}

function isTrailingEmptyParagraph(input: unknown) {
  const node = tiptapNodeSchema.safeParse(input);
  return (
    node.success &&
    node.data.type === "paragraph" &&
    (!node.data.content || node.data.content.length === 0)
  );
}

export function tiptapDocumentToEditorialDocumentV1(
  input: unknown,
): EditorialDocumentV1 {
  const document = tiptapDocumentSchema.parse(input);
  const content = [...document.content];
  while (isTrailingEmptyParagraph(content.at(-1))) content.pop();
  return editorialDocumentV1Schema.parse({
    schemaVersion: 1,
    type: "doc",
    content: content.map(normalizeTiptapNode),
  });
}

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
): EditorialDocumentV1 {
  const document = persistedEditorialDocumentV1Schema.parse(input);
  return editorialDocumentV1Schema.parse({
    ...document,
    content: document.content.map((node) => resolveNodeMedia(node, media)),
  });
}
