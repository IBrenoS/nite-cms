import { getPublicNewsBySlug } from "@/lib/public-news";
import { createArticleResponse } from "@/lib/responses";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const article = await getPublicNewsBySlug(slug);
  return createArticleResponse(
    article,
    request.headers.get("if-none-match") ?? undefined,
  );
}
