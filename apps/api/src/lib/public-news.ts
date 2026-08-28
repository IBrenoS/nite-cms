import "server-only";

import { publishedArticles } from "@nite/cms-db";
import { getDatabase } from "@nite/cms-db/database";
import { getPublishedNewsBySlug, listPublishedNews } from "@nite/editorial";
import { readApiConfiguration } from "./configuration";

function getContext() {
  const configuration = readApiConfiguration(process.env);
  return {
    configuration,
    database: getDatabase({ databaseUrl: configuration.databaseUrl }),
  };
}

export async function listPublicNews() {
  const { configuration, database } = getContext();
  return listPublishedNews(database, configuration.mediaBaseUrl);
}

export async function getPublicNewsBySlug(slug: string) {
  const { configuration, database } = getContext();
  return getPublishedNewsBySlug(database, slug, configuration.mediaBaseUrl);
}

export async function checkPublicNewsDatabase() {
  const { database } = getContext();
  await database
    .select({ slug: publishedArticles.slug })
    .from(publishedArticles)
    .limit(1);
}
