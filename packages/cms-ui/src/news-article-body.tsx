import type {
  EditorialDocumentV1,
  PublicEditorialDocumentV1,
} from "@nite/editorial";
import type { ReactNode } from "react";

type NewsArticleBodyProps = {
  document: EditorialDocumentV1 | PublicEditorialDocumentV1;
  className?: string;
};

type EditorialContentNode = EditorialDocumentV1["content"][number];
type InlineContentNode = Extract<
  EditorialContentNode,
  { type: "paragraph" }
>["content"];
type PublicImageNode = Extract<
  PublicEditorialDocumentV1["content"][number],
  { type: "image" }
>;

function isPublicImage(node: EditorialContentNode): node is PublicImageNode {
  return (
    node.type === "image" &&
    "src" in node.attrs &&
    "width" in node.attrs &&
    "height" in node.attrs &&
    typeof node.attrs.src === "string" &&
    typeof node.attrs.width === "number" &&
    typeof node.attrs.height === "number"
  );
}

function renderInlineContent(content: InlineContentNode) {
  return content.map((node, index) => {
    let rendered: ReactNode = node.text;
    for (const mark of node.marks ?? []) {
      if (mark.type === "bold") rendered = <strong>{rendered}</strong>;
      if (mark.type === "italic") rendered = <em>{rendered}</em>;
      if (mark.type === "link") {
        rendered = <a href={mark.attrs.href}>{rendered}</a>;
      }
    }
    return <span key={`${node.text}-${index}`}>{rendered}</span>;
  });
}

function renderNode(node: EditorialContentNode, key: string): ReactNode {
  if (node.type === "paragraph")
    return <p key={key}>{renderInlineContent(node.content)}</p>;
  if (node.type === "heading") {
    return node.attrs.level === 2 ? (
      <h2 key={key}>{renderInlineContent(node.content)}</h2>
    ) : (
      <h3 key={key}>{renderInlineContent(node.content)}</h3>
    );
  }
  if (node.type === "blockquote") {
    return (
      <blockquote key={key}>
        {node.content.map((child, index) =>
          renderNode(child, `${key}-${index}`),
        )}
      </blockquote>
    );
  }
  if (node.type === "bulletList" || node.type === "orderedList") {
    const List = node.type === "bulletList" ? "ul" : "ol";
    return (
      <List key={key}>
        {node.content.map((item, index) => (
          <li key={`${key}-${index}`}>
            {item.content.map((child, childIndex) =>
              renderNode(child, `${key}-${index}-${childIndex}`),
            )}
          </li>
        ))}
      </List>
    );
  }
  if (isPublicImage(node)) {
    return (
      <img
        key={key}
        src={node.attrs.src}
        alt={node.attrs.alt}
        width={node.attrs.width}
        height={node.attrs.height}
      />
    );
  }
  return <figure key={key} aria-label={node.attrs.alt} />;
}

function NewsArticleBody({ document, className }: NewsArticleBodyProps) {
  return (
    <div
      className={
        className ??
        "grid gap-7 text-[1.0625rem] leading-8 text-nite-text-secondary sm:text-lg sm:leading-9"
      }
    >
      {document.content.map((node, index) =>
        renderNode(node, `${node.type}-${index}`),
      )}
    </div>
  );
}

export { NewsArticleBody };
export type { NewsArticleBodyProps };
