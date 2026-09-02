import { z } from "zod";

const allowedLinkProtocols = new Set(["http:", "https:", "mailto:"]);

function isAllowedEditorialLink(href: string) {
  if (href.startsWith("/")) {
    return !href.startsWith("//") && !href.includes("\\");
  }

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

type EditorialMark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "link"; attrs: { href: string } };
type EditorialTextNode = {
  type: "text";
  text: string;
  marks?: EditorialMark[];
};
type EditorialParagraphNode = {
  type: "paragraph";
  content: EditorialTextNode[];
};
type EditorialHeadingNode = {
  type: "heading";
  attrs: { level: 2 | 3 };
  content: EditorialTextNode[];
};
type StoredImageAttrs = { mediaId: string; alt: string };
type ResolvedImageAttrs = StoredImageAttrs & {
  src: string;
  width: number;
  height: number;
};
type EditorialImageNode = {
  type: "image";
  attrs: StoredImageAttrs | ResolvedImageAttrs;
};
type EditorialListItemNode = {
  type: "listItem";
  content: EditorialContentNode[];
};
type EditorialBulletListNode = {
  type: "bulletList";
  content: EditorialListItemNode[];
};
type EditorialOrderedListNode = {
  type: "orderedList";
  content: EditorialListItemNode[];
};
type EditorialBlockquoteNode = {
  type: "blockquote";
  content: EditorialContentNode[];
};
type EditorialContentNode =
  | EditorialParagraphNode
  | EditorialHeadingNode
  | EditorialBulletListNode
  | EditorialOrderedListNode
  | EditorialBlockquoteNode
  | EditorialImageNode;

export type EditorialDocumentV1 = {
  schemaVersion: 1;
  type: "doc";
  content: EditorialContentNode[];
};

const textNodeSchema: z.ZodType<EditorialTextNode> = z
  .object({
    type: z.literal("text"),
    text: z.string().min(1),
    marks: z.array(markSchema).min(1).optional(),
  })
  .strict();

const inlineContentSchema: z.ZodType<EditorialTextNode[]> =
  z.array(textNodeSchema);
const paragraphNodeSchema: z.ZodType<EditorialParagraphNode> = z
  .object({ type: z.literal("paragraph"), content: inlineContentSchema })
  .strict();
const headingNodeSchema: z.ZodType<EditorialHeadingNode> = z
  .object({
    type: z.literal("heading"),
    attrs: z.object({ level: z.union([z.literal(2), z.literal(3)]) }).strict(),
    content: inlineContentSchema,
  })
  .strict();
const altTextSchema = z.string().trim().min(1);
const storedImageAttrsSchema = z
  .object({ mediaId: z.uuid(), alt: altTextSchema })
  .strict();
const resolvedImageAttrsSchema = storedImageAttrsSchema
  .extend({
    src: z.url(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strict();
const imageNodeSchema: z.ZodType<EditorialImageNode> = z
  .object({
    type: z.literal("image"),
    attrs: z.union([storedImageAttrsSchema, resolvedImageAttrsSchema]),
  })
  .strict();

const listItemNodeSchema: z.ZodType<EditorialListItemNode> = z
  .object({
    type: z.literal("listItem"),
    content: z.array(z.lazy(() => editorialContentNodeSchema)).min(1),
  })
  .strict();
const bulletListNodeSchema: z.ZodType<EditorialBulletListNode> = z
  .object({
    type: z.literal("bulletList"),
    content: z.array(listItemNodeSchema).min(1),
  })
  .strict();
const orderedListNodeSchema: z.ZodType<EditorialOrderedListNode> = z
  .object({
    type: z.literal("orderedList"),
    content: z.array(listItemNodeSchema).min(1),
  })
  .strict();
const blockquoteNodeSchema: z.ZodType<EditorialBlockquoteNode> = z
  .object({
    type: z.literal("blockquote"),
    content: z.array(z.lazy(() => editorialContentNodeSchema)).min(1),
  })
  .strict();

const editorialContentNodeSchema: z.ZodType<EditorialContentNode> = z.lazy(
  (): z.ZodType<EditorialContentNode> =>
    z.union([
      paragraphNodeSchema,
      headingNodeSchema,
      bulletListNodeSchema,
      orderedListNodeSchema,
      blockquoteNodeSchema,
      imageNodeSchema,
    ]),
);

export const editorialDocumentV1Schema: z.ZodType<EditorialDocumentV1> = z
  .object({
    schemaVersion: z.literal(1),
    type: z.literal("doc"),
    content: z.array(editorialContentNodeSchema).min(1),
  })
  .strict();

function resolvedImagePaths(
  nodes: EditorialContentNode[],
  path: (string | number)[] = ["content"],
): (string | number)[][] {
  return nodes.flatMap((node, index) => {
    const nodePath = [...path, index];
    if (node.type === "image") {
      return "src" in node.attrs ? [nodePath] : [];
    }
    if (node.type === "blockquote") {
      return resolvedImagePaths(node.content, [...nodePath, "content"]);
    }
    if (node.type === "bulletList" || node.type === "orderedList") {
      return node.content.flatMap((item, itemIndex) =>
        resolvedImagePaths(item.content, [
          ...nodePath,
          "content",
          itemIndex,
          "content",
        ]),
      );
    }
    return [];
  });
}

export const storableEditorialDocumentV1Schema =
  editorialDocumentV1Schema.superRefine((document, context) => {
    resolvedImagePaths(document.content).forEach((path) => {
      context.addIssue({
        code: "custom",
        path: [...path, "attrs"],
        message: "A resolução pública de imagem não pode ser persistida.",
      });
    });
  });

export const persistedEditorialDocumentV1Schema =
  storableEditorialDocumentV1Schema.superRefine((document, context) => {
    if (!hasMeaningfulContent(document.content)) {
      context.addIssue({
        code: "custom",
        path: ["content"],
        message:
          "O documento editorial exige conteúdo significativo ou uma imagem.",
      });
    }
  });

export function getEditorialImageMediaIds(input: unknown): string[] {
  const document = persistedEditorialDocumentV1Schema.parse(input);
  const mediaIds: string[] = [];
  function collect(nodes: EditorialContentNode[]) {
    nodes.forEach((node) => {
      if (node.type === "image") {
        mediaIds.push(node.attrs.mediaId);
        return;
      }
      if (node.type === "blockquote") {
        collect(node.content);
        return;
      }
      if (node.type === "bulletList" || node.type === "orderedList") {
        node.content.forEach((item) => collect(item.content));
      }
    });
  }
  collect(document.content);
  return [...new Set(mediaIds)];
}

function hasMeaningfulContent(nodes: EditorialContentNode[]): boolean {
  return nodes.some((node) => {
    if (node.type === "image") return true;
    if (node.type === "paragraph" || node.type === "heading") {
      return node.content.some((textNode) => /\S/u.test(textNode.text));
    }
    if (node.type === "blockquote") {
      return hasMeaningfulContent(node.content);
    }
    return node.content.some((item) => hasMeaningfulContent(item.content));
  });
}

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
      content: (node.content ?? []).map(normalizeInlineNode),
    };
  }
  if (node.type === "heading") {
    const attrs = nodeAttrs(node.attrs);
    return {
      type: "heading",
      attrs: {
        level: z.union([z.literal(2), z.literal(3)]).parse(attrs.level),
      },
      content: (node.content ?? []).map(normalizeInlineNode),
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
    const alt = altTextSchema.parse(attrs.alt);
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
  if (content.length === 0) {
    content.push({ type: "paragraph", content: [] });
  }
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
