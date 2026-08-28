import type { NewsBodyBlock } from "@nite/editorial";

type NewsArticleBodyProps = {
  blocks: readonly NewsBodyBlock[];
  className?: string;
};

function NewsArticleBody({ blocks, className }: NewsArticleBodyProps) {
  return (
    <div
      className={
        className ??
        "grid gap-7 text-[1.0625rem] leading-8 text-nite-text-secondary sm:text-lg sm:leading-9"
      }
    >
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <h2
              key={`${block.type}-${index}`}
              className="pt-5 font-heading text-2xl leading-tight font-semibold text-nite-text-primary sm:text-3xl"
            >
              {block.text}
            </h2>
          );
        }

        if (block.type === "quote") {
          return (
            <blockquote
              key={`${block.type}-${index}`}
              className="my-3 border-l-2 border-nite-brand-accent py-2 pl-6 font-heading text-xl leading-8 font-medium text-nite-text-primary sm:pl-8 sm:text-2xl sm:leading-9"
            >
              <p>“{block.text}”</p>
              {block.attribution ? (
                <cite className="mt-4 block font-mono text-xs font-medium not-italic uppercase tracking-[0.14em] text-nite-text-muted">
                  {block.attribution}
                </cite>
              ) : null}
            </blockquote>
          );
        }

        return <p key={`${block.type}-${index}`}>{block.text}</p>;
      })}
    </div>
  );
}

export { NewsArticleBody };
export type { NewsArticleBodyProps };
