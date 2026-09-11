import type { EditorialDocument } from "@nite/editorial";
import type { ReactNode } from "react";
import { EditorialVideo } from "./editorial-video";

type NewsArticleBodyProps = {
  document: EditorialDocument;
  className?: string;
};

type EditorialContentNode = EditorialDocument["content"][number];
type InlineContentNode = Extract<
  EditorialContentNode,
  { type: "paragraph" }
>["content"];
type EditorialImageNode = Extract<EditorialContentNode, { type: "image" }>;
type EditorialVideoNode = Extract<EditorialContentNode, { type: "video" }>;
type ResolvedEditorialImageNode = EditorialImageNode & {
  attrs: {
    mediaId: string;
    alt: string;
    src: string;
    width: number;
    height: number;
    caption?: string;
    credit?: string;
    layout?: "normal" | "wide" | "full";
  };
};

function isPublicImage(
  node: EditorialImageNode,
): node is ResolvedEditorialImageNode {
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

function isPublicVideo(node: EditorialVideoNode): node is EditorialVideoNode & {
  attrs: EditorialVideoNode["attrs"] & {
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
} {
  return (
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
  if (node.type === "image") {
    if (isPublicImage(node)) {
      const layout = node.attrs.layout ?? "normal";
      const layoutClass = {
        normal: "w-full",
        wide: "relative left-1/2 w-[min(64rem,calc(100vw-2rem))] -translate-x-1/2 sm:w-[min(64rem,calc(100vw-4rem))]",
        full: "relative left-1/2 w-[min(80rem,calc(100vw-2rem))] -translate-x-1/2 sm:w-[min(80rem,calc(100vw-4rem))]",
      }[layout];
      return (
        <figure
          key={key}
          data-editorial-layout={layout}
          className={layoutClass}
        >
          <img
            src={node.attrs.src}
            alt={node.attrs.alt}
            width={node.attrs.width}
            height={node.attrs.height}
            className="h-auto w-full"
          />
          {node.attrs.caption || node.attrs.credit ? (
            <figcaption className="mt-2 flex flex-wrap justify-between gap-2 text-sm leading-5 text-nite-text-secondary">
              {node.attrs.caption ? <span>{node.attrs.caption}</span> : null}
              {node.attrs.credit ? <span>{node.attrs.credit}</span> : null}
            </figcaption>
          ) : null}
        </figure>
      );
    }
    return <figure key={key} aria-label={node.attrs.alt} />;
  }
  if (node.type === "video") {
    if (!isPublicVideo(node)) return null;
    const layoutClass = {
      normal: "w-full",
      wide: "relative left-1/2 w-[min(64rem,calc(100vw-2rem))] -translate-x-1/2 sm:w-[min(64rem,calc(100vw-4rem))]",
      full: "relative left-1/2 w-[min(80rem,calc(100vw-2rem))] -translate-x-1/2 sm:w-[min(80rem,calc(100vw-4rem))]",
    }[node.attrs.layout];
    return (
      <figure
        key={key}
        data-editorial-layout={node.attrs.layout}
        className={layoutClass}
      >
        <EditorialVideo
          key={`${node.attrs.mediaId}:${node.attrs.src}`}
          src={node.attrs.src}
          width={node.attrs.width}
          height={node.attrs.height}
          playbackMode={node.attrs.playbackMode}
          description={node.attrs.description}
          captions={node.attrs.captions}
        />
        {node.attrs.caption || node.attrs.credit ? (
          <figcaption className="mt-2 flex flex-wrap justify-between gap-2 text-sm leading-5 text-nite-text-secondary">
            {node.attrs.caption ? <span>{node.attrs.caption}</span> : null}
            {node.attrs.credit ? <span>{node.attrs.credit}</span> : null}
          </figcaption>
        ) : null}
      </figure>
    );
  }
  return null;
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
