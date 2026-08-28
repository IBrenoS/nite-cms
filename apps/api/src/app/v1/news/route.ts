import { listPublicNews } from "@/lib/public-news";
import { createListResponse } from "@/lib/responses";

export async function GET(request: Request) {
  const articles = await listPublicNews();
  return createListResponse(
    articles,
    request.headers.get("if-none-match") ?? undefined,
  );
}
