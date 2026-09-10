import { z } from "zod";

const allowedLinkProtocols = new Set(["http:", "https:", "mailto:"]);

export function isAllowedEditorialLink(href: string) {
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
export const editorialImageLayoutValues = ["normal", "wide", "full"] as const;
export type EditorialImageLayout = (typeof editorialImageLayoutValues)[number];
type StoredImageAttrs = { mediaId: string; alt: string };
type StoredImageV2Attrs = StoredImageAttrs & {
  caption?: string;
  credit?: string;
  layout: EditorialImageLayout;
};
type ResolvedImageAttrs = StoredImageAttrs & {
  src: string;
  width: number;
  height: number;
};
type ResolvedImageV2Attrs = StoredImageV2Attrs & ResolvedImageAttrs;
type EditorialImageNode = {
  type: "image";
  attrs:
    | StoredImageAttrs
    | ResolvedImageAttrs
    | StoredImageV2Attrs
    | ResolvedImageV2Attrs;
};
export const editorialVideoPlaybackModeValues = ["autoplay", "manual"] as const;
export type EditorialVideoPlaybackMode =
  (typeof editorialVideoPlaybackModeValues)[number];
type StoredVideoAttrs = {
  mediaId: string;
  captionsMediaId?: string;
  playbackMode: EditorialVideoPlaybackMode;
  layout: EditorialImageLayout;
  description?: string;
  caption?: string;
  credit?: string;
};
type ResolvedVideoAttrs = StoredVideoAttrs & {
  src: string;
  width: number;
  height: number;
  durationSeconds: number;
  mimeType: "video/mp4";
  captions?: {
    src: string;
    mimeType: "text/vtt";
    srclang: "pt-BR";
    label: "Português";
  };
};
type EditorialVideoNode = {
  type: "video";
  attrs: StoredVideoAttrs | ResolvedVideoAttrs;
};
type EditorialListItemNode = {
  type: "listItem";
  content: EditorialNestedContentNode[];
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
  content: EditorialNestedContentNode[];
};
type EditorialNestedContentNode =
  | EditorialParagraphNode
  | EditorialHeadingNode
  | EditorialBulletListNode
  | EditorialOrderedListNode
  | EditorialBlockquoteNode
  | EditorialImageNode;
type EditorialContentNode = EditorialNestedContentNode | EditorialVideoNode;

export type EditorialDocumentV1 = {
  schemaVersion: 1;
  type: "doc";
  content: EditorialNestedContentNode[];
};

export type EditorialDocumentV2 = {
  schemaVersion: 2;
  type: "doc";
  content: EditorialNestedContentNode[];
};

export type EditorialDocumentV3 = {
  schemaVersion: 3;
  type: "doc";
  content: EditorialContentNode[];
};

export type EditorialDocument =
  EditorialDocumentV1 | EditorialDocumentV2 | EditorialDocumentV3;

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
const optionalCaptionSchema = z.string().trim().min(1).max(280).optional();
const optionalCreditSchema = z.string().trim().min(1).max(160).optional();
const storedImageV2AttrsSchema = storedImageAttrsSchema
  .extend({
    caption: optionalCaptionSchema,
    credit: optionalCreditSchema,
    layout: z.enum(editorialImageLayoutValues),
  })
  .strict();
const resolvedImageV2AttrsSchema = storedImageV2AttrsSchema
  .extend({
    src: z.url(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strict();
const imageNodeV1Schema: z.ZodType<EditorialImageNode> = z
  .object({
    type: z.literal("image"),
    attrs: z.union([storedImageAttrsSchema, resolvedImageAttrsSchema]),
  })
  .strict();
const imageNodeV2Schema: z.ZodType<EditorialImageNode> = z
  .object({
    type: z.literal("image"),
    attrs: z.union([storedImageV2AttrsSchema, resolvedImageV2AttrsSchema]),
  })
  .strict();

const storedVideoAttrsSchema = z
  .object({
    mediaId: z.uuid(),
    captionsMediaId: z.uuid().optional(),
    playbackMode: z.enum(editorialVideoPlaybackModeValues),
    layout: z.enum(editorialImageLayoutValues),
    description: z.string().trim().min(1).max(500).optional(),
    caption: optionalCaptionSchema,
    credit: optionalCreditSchema,
  })
  .strict();
const resolvedVideoAttrsSchema = storedVideoAttrsSchema
  .extend({
    src: z.url(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    durationSeconds: z.number().positive(),
    mimeType: z.literal("video/mp4"),
    captions: z
      .object({
        src: z.url(),
        mimeType: z.literal("text/vtt"),
        srclang: z.literal("pt-BR"),
        label: z.literal("Português"),
      })
      .strict()
      .optional(),
  })
  .strict();
const videoNodeSchema: z.ZodType<EditorialVideoNode> = z
  .object({
    type: z.literal("video"),
    attrs: z.union([storedVideoAttrsSchema, resolvedVideoAttrsSchema]),
  })
  .strict();

function createEditorialContentNodeSchema(
  imageNodeSchema: z.ZodType<EditorialImageNode>,
): z.ZodType<EditorialNestedContentNode> {
  const listItemNodeSchema: z.ZodType<EditorialListItemNode> = z
    .object({
      type: z.literal("listItem"),
      content: z.array(z.lazy(() => contentNodeSchema)).min(1),
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
      content: z.array(z.lazy(() => contentNodeSchema)).min(1),
    })
    .strict();
  const contentNodeSchema: z.ZodType<EditorialNestedContentNode> = z.lazy(() =>
    z.union([
      paragraphNodeSchema,
      headingNodeSchema,
      bulletListNodeSchema,
      orderedListNodeSchema,
      blockquoteNodeSchema,
      imageNodeSchema,
    ]),
  );
  return contentNodeSchema;
}

const editorialContentNodeV1Schema =
  createEditorialContentNodeSchema(imageNodeV1Schema);
const editorialContentNodeV2Schema =
  createEditorialContentNodeSchema(imageNodeV2Schema);
const editorialNestedContentNodeV3Schema =
  createEditorialContentNodeSchema(imageNodeV2Schema);
const editorialContentNodeV3Schema: z.ZodType<EditorialContentNode> = z.union([
  editorialNestedContentNodeV3Schema,
  videoNodeSchema,
]);

export const editorialDocumentV1Schema: z.ZodType<EditorialDocumentV1> = z
  .object({
    schemaVersion: z.literal(1),
    type: z.literal("doc"),
    content: z.array(editorialContentNodeV1Schema).min(1),
  })
  .strict();

export const editorialDocumentV2Schema: z.ZodType<EditorialDocumentV2> = z
  .object({
    schemaVersion: z.literal(2),
    type: z.literal("doc"),
    content: z.array(editorialContentNodeV2Schema).min(1),
  })
  .strict();

export const editorialDocumentV3Schema: z.ZodType<EditorialDocumentV3> = z
  .object({
    schemaVersion: z.literal(3),
    type: z.literal("doc"),
    content: z.array(editorialContentNodeV3Schema).min(1),
  })
  .strict();

export const editorialDocumentSchema: z.ZodType<EditorialDocument> = z.union([
  editorialDocumentV1Schema,
  editorialDocumentV2Schema,
  editorialDocumentV3Schema,
]);

function resolvedMediaPaths(
  nodes: EditorialContentNode[],
  path: (string | number)[] = ["content"],
): (string | number)[][] {
  return nodes.flatMap((node, index) => {
    const nodePath = [...path, index];
    if (node.type === "image") {
      return "src" in node.attrs ? [nodePath] : [];
    }
    if (node.type === "video") {
      return "src" in node.attrs ? [nodePath] : [];
    }
    if (node.type === "blockquote") {
      return resolvedMediaPaths(node.content, [...nodePath, "content"]);
    }
    if (node.type === "bulletList" || node.type === "orderedList") {
      return node.content.flatMap((item, itemIndex) =>
        resolvedMediaPaths(item.content, [
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
    resolvedMediaPaths(document.content).forEach((path) => {
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

export const storableEditorialDocumentSchema =
  editorialDocumentSchema.superRefine((document, context) => {
    resolvedMediaPaths(document.content).forEach((path) => {
      context.addIssue({
        code: "custom",
        path: [...path, "attrs"],
        message: "A resolução pública de imagem não pode ser persistida.",
      });
    });
  });

export const persistedEditorialDocumentSchema =
  storableEditorialDocumentSchema.superRefine((document, context) => {
    if (!hasMeaningfulContent(document.content)) {
      context.addIssue({
        code: "custom",
        path: ["content"],
        message:
          "O documento editorial exige conteúdo significativo ou uma imagem.",
      });
    }
  });

function collectEditorialMediaIds(document: EditorialDocument): string[] {
  const mediaIds: string[] = [];
  function collect(nodes: EditorialContentNode[]) {
    nodes.forEach((node) => {
      if (node.type === "image") {
        mediaIds.push(node.attrs.mediaId);
        return;
      }
      if (node.type === "video") {
        mediaIds.push(node.attrs.mediaId);
        if (node.attrs.captionsMediaId) {
          mediaIds.push(node.attrs.captionsMediaId);
        }
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

export function getEditorialImageMediaIds(input: unknown): string[] {
  return collectEditorialImageMediaIds(
    persistedEditorialDocumentSchema.parse(input),
  );
}

function collectEditorialImageMediaIds(document: EditorialDocument): string[] {
  const mediaIds: string[] = [];
  function collectImages(nodes: EditorialContentNode[]) {
    nodes.forEach((node) => {
      if (node.type === "image") mediaIds.push(node.attrs.mediaId);
      else if (node.type === "blockquote") collectImages(node.content);
      else if (node.type === "bulletList" || node.type === "orderedList") {
        node.content.forEach((item) => collectImages(item.content));
      }
    });
  }
  collectImages(document.content);
  return [...new Set(mediaIds)];
}

export function getStorableEditorialImageMediaIds(input: unknown): string[] {
  return collectEditorialImageMediaIds(
    storableEditorialDocumentSchema.parse(input),
  );
}

export function getEditorialMediaIds(input: unknown): string[] {
  return collectEditorialMediaIds(
    persistedEditorialDocumentSchema.parse(input),
  );
}

export function getStorableEditorialMediaIds(input: unknown): string[] {
  return collectEditorialMediaIds(storableEditorialDocumentSchema.parse(input));
}

function hasMeaningfulContent(nodes: EditorialContentNode[]): boolean {
  return nodes.some((node) => {
    if (node.type === "image" || node.type === "video") return true;
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

function normalizeOptionalText(input: unknown, maximum: number) {
  return z
    .string()
    .trim()
    .min(1)
    .max(maximum)
    .optional()
    .parse(typeof input === "string" && input.trim() ? input : undefined);
}

function normalizeTiptapNode(
  input: unknown,
  schemaVersion: 1 | 2 | 3,
  allowVideo = false,
): unknown {
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
      content: requiredContent(node).map((child) =>
        normalizeTiptapNode(child, schemaVersion),
      ),
    };
  }
  if (node.type === "bulletList" || node.type === "orderedList") {
    return {
      type: node.type,
      content: requiredContent(node).map((child) =>
        normalizeTiptapNode(child, schemaVersion),
      ),
    };
  }
  if (node.type === "listItem") {
    return {
      type: "listItem",
      content: requiredContent(node).map((child) =>
        normalizeTiptapNode(child, schemaVersion),
      ),
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
    const caption = optionalCaptionSchema.parse(
      typeof attrs.caption === "string" && attrs.caption.trim()
        ? attrs.caption
        : undefined,
    );
    const credit = optionalCreditSchema.parse(
      typeof attrs.credit === "string" && attrs.credit.trim()
        ? attrs.credit
        : undefined,
    );
    return {
      type: "image",
      attrs: {
        mediaId,
        alt,
        ...(schemaVersion !== 1
          ? {
              ...(caption ? { caption } : {}),
              ...(credit ? { credit } : {}),
              layout: z
                .enum(editorialImageLayoutValues)
                .parse(attrs.layout ?? "normal"),
            }
          : {}),
        ...(resolved.src !== undefined ||
        resolved.width !== undefined ||
        resolved.height !== undefined
          ? resolved
          : {}),
      },
    };
  }
  if (node.type === "video" && schemaVersion === 3 && allowVideo) {
    const attrs = nodeAttrs(node.attrs);
    const captionsMediaId = z.uuid().optional().parse(attrs.captionsMediaId);
    const description = normalizeOptionalText(attrs.description, 500);
    const caption = normalizeOptionalText(attrs.caption, 280);
    const credit = normalizeOptionalText(attrs.credit, 160);
    return {
      type: "video",
      attrs: {
        mediaId: z.uuid().parse(attrs.mediaId),
        ...(captionsMediaId ? { captionsMediaId } : {}),
        playbackMode: z
          .enum(editorialVideoPlaybackModeValues)
          .parse(attrs.playbackMode),
        layout: z
          .enum(editorialImageLayoutValues)
          .parse(attrs.layout ?? "normal"),
        ...(description ? { description } : {}),
        ...(caption ? { caption } : {}),
        ...(credit ? { credit } : {}),
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
    content: content.map((node) => normalizeTiptapNode(node, 1)),
  });
}

export function tiptapDocumentToEditorialDocumentV2(
  input: unknown,
): EditorialDocumentV2 {
  const document = tiptapDocumentSchema.parse(input);
  const content = [...document.content];
  while (isTrailingEmptyParagraph(content.at(-1))) content.pop();
  if (content.length === 0) {
    content.push({ type: "paragraph", content: [] });
  }
  return editorialDocumentV2Schema.parse({
    schemaVersion: 2,
    type: "doc",
    content: content.map((node) => normalizeTiptapNode(node, 2)),
  });
}

export function tiptapDocumentToEditorialDocumentV3(
  input: unknown,
): EditorialDocumentV3 {
  const document = tiptapDocumentSchema.parse(input);
  const content = [...document.content];
  while (isTrailingEmptyParagraph(content.at(-1))) content.pop();
  if (content.length === 0) {
    content.push({ type: "paragraph", content: [] });
  }
  return editorialDocumentV3Schema.parse({
    schemaVersion: 3,
    type: "doc",
    content: content.map((node) => normalizeTiptapNode(node, 3, true)),
  });
}

export function calculateEditorialReadTime(input: unknown) {
  const document = editorialDocumentSchema.parse(input);
  const words = document.content
    .flatMap(visibleText)
    .flatMap((text) => text.trim().split(/\s+/u))
    .filter(Boolean).length;

  return Math.min(30, Math.max(1, Math.ceil(words / 200)));
}

export type EditorialPublicMedia = Readonly<
  Record<
    string,
    | {
        mediaKind?: "image";
        src: string;
        width: number;
        height: number;
      }
    | {
        mediaKind: "video";
        src: string;
        mimeType: "video/mp4";
        width: number;
        height: number;
        durationSeconds: number;
      }
    | {
        mediaKind: "captions";
        src: string;
        mimeType: "text/vtt";
      }
  >
>;

function resolveListItemMedia(
  item: EditorialListItemNode,
  media: EditorialPublicMedia,
): unknown {
  return {
    ...item,
    content: item.content.map((child) => resolveNodeMedia(child, media)),
  };
}

function resolveNodeMedia(
  node: EditorialContentNode,
  media: EditorialPublicMedia,
): unknown {
  if (node.type === "image") {
    const resolved = media[node.attrs.mediaId];
    if (
      !resolved ||
      resolved.mediaKind === "video" ||
      resolved.mediaKind === "captions"
    ) {
      throw new Error("A imagem editorial não está disponível.");
    }
    return {
      ...node,
      attrs: {
        ...node.attrs,
        src: resolved.src,
        width: resolved.width,
        height: resolved.height,
      },
    };
  }
  if (node.type === "video") {
    const resolved = media[node.attrs.mediaId];
    if (!resolved || resolved.mediaKind !== "video") {
      throw new Error("O vídeo editorial não está disponível.");
    }
    let resolvedCaptions: ResolvedVideoAttrs["captions"];
    if (node.attrs.captionsMediaId) {
      const captions = media[node.attrs.captionsMediaId];
      if (!captions || captions.mediaKind !== "captions") {
        throw new Error("A legenda editorial não está disponível.");
      }
      resolvedCaptions = {
        src: captions.src,
        mimeType: captions.mimeType,
        srclang: "pt-BR",
        label: "Português",
      };
    }
    return {
      ...node,
      attrs: {
        ...node.attrs,
        src: resolved.src,
        width: resolved.width,
        height: resolved.height,
        durationSeconds: resolved.durationSeconds,
        mimeType: resolved.mimeType,
        ...(resolvedCaptions ? { captions: resolvedCaptions } : {}),
      },
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
  media: EditorialPublicMedia,
): EditorialDocument {
  const document = persistedEditorialDocumentSchema.parse(input);
  return editorialDocumentSchema.parse({
    ...document,
    content: document.content.map((node) => resolveNodeMedia(node, media)),
  });
}
