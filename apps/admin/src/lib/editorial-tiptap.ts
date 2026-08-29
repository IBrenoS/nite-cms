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
    };
  },

  parseHTML() {
    return [{ tag: "img[data-media-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const { mediaId, alt, src, width, height } = HTMLAttributes;
    return [
      "img",
      {
        "data-media-id": mediaId,
        alt,
        ...(typeof src === "string" ? { src } : {}),
        ...(typeof width === "number" ? { width } : {}),
        ...(typeof height === "number" ? { height } : {}),
      },
    ];
  },
});

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
  ];
}
