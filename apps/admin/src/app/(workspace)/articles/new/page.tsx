import { ArticleEditor } from "@/components/article-editor";
import { requireCmsPageContext } from "@/lib/auth";

export default async function NewArticlePage() {
  await requireCmsPageContext();

  return <ArticleEditor canPublish />;
}
