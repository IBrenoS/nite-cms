import { Node } from "@tiptap/core";
import Blockquote from "@tiptap/extension-blockquote";
import StarterKit from "@tiptap/starter-kit";

const EditorialBlockquote = Blockquote.extend({
  addAttributes() {
    return {
      attribution: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-attribution"),
        renderHTML: (attributes) =>
          attributes.attribution
            ? { "data-attribution": attributes.attribution }
            : {},
      },
    };
  },
});

const EditorialImage = Node.create({
  name: "image",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      mediaId: { default: null },
      alt: { default: "" },
      src: { default: null },
      width: { default: null },
      height: { default: null },
      caption: { default: null },
      credit: { default: null },
      layout: { default: "normal" },
    };
  },

  parseHTML() {
    return [{ tag: "img[data-media-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const { mediaId, alt, src, width, height, caption, credit, layout } =
      HTMLAttributes;
    return [
      "img",
      {
        "data-media-id": mediaId,
        alt,
        ...(typeof src === "string" ? { src } : {}),
        ...(typeof width === "number" ? { width } : {}),
        ...(typeof height === "number" ? { height } : {}),
        ...(typeof caption === "string" ? { "data-caption": caption } : {}),
        ...(typeof credit === "string" ? { "data-credit": credit } : {}),
        "data-layout": layout,
      },
    ];
  },
});

const EditorialVideo = Node.create({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      mediaId: { default: null },
      captionsMediaId: { default: null },
      playbackMode: { default: "manual" },
      layout: { default: "normal" },
      description: { default: null },
      caption: { default: null },
      credit: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "figure[data-editorial-video]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const {
      mediaId,
      captionsMediaId,
      playbackMode,
      layout,
      description,
      caption,
      credit,
    } = HTMLAttributes;
    return [
      "figure",
      {
        "data-editorial-video": "true",
        "data-media-id": mediaId,
        ...(typeof captionsMediaId === "string"
          ? { "data-captions-media-id": captionsMediaId }
          : {}),
        "data-playback-mode": playbackMode,
        "data-layout": layout,
        ...(typeof description === "string"
          ? { "data-description": description }
          : {}),
        ...(typeof caption === "string" ? { "data-caption": caption } : {}),
        ...(typeof credit === "string" ? { "data-credit": credit } : {}),
        role: "img",
        "aria-label":
          typeof description === "string" && description.length > 0
            ? description
            : "Vídeo editorial",
      },
      `Vídeo editorial · ${playbackMode === "autoplay" ? "automático" : "manual"}`,
    ];
  },
});

const discardedPastedElements = new Set([
  "SCRIPT",
  "STYLE",
  "META",
  "LINK",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "VIDEO",
  "SOURCE",
  "TRACK",
]);

export function normalizeEditorialPastedHtml(html: string) {
  const document = new DOMParser().parseFromString(html, "text/html");
  document.body
    .querySelectorAll([...discardedPastedElements].join(","))
    .forEach((element) => element.remove());

  document.body.querySelectorAll("*").forEach((element) => {
    const preservedAttributes = new Map<string, string>();
    if (element.tagName === "A") {
      const href = element.getAttribute("href");
      if (href) preservedAttributes.set("href", href);
    }
    if (element.tagName === "IMG" && element.hasAttribute("data-media-id")) {
      [
        "data-media-id",
        "alt",
        "src",
        "width",
        "height",
        "data-caption",
        "data-credit",
        "data-layout",
      ].forEach((name) => {
        const value = element.getAttribute(name);
        if (value !== null) preservedAttributes.set(name, value);
      });
    }
    [...element.attributes].forEach((attribute) =>
      element.removeAttribute(attribute.name),
    );
    preservedAttributes.forEach((value, name) =>
      element.setAttribute(name, value),
    );
  });

  return document.body.innerHTML;
}

export function createEditorialTiptapExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      codeBlock: false,
      horizontalRule: false,
      strike: false,
      code: false,
      blockquote: false,
      hardBreak: false,
      underline: false,
      trailingNode: false,
      link: {
        autolink: false,
        linkOnPaste: false,
        openOnClick: false,
      },
    }),
    EditorialBlockquote,
    EditorialImage,
    EditorialVideo,
  ];
}
