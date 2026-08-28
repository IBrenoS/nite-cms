import { and, eq } from "drizzle-orm";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";

import { newsArticleSchema } from "./article-schema";
import {
  articleRevisions,
  articles,
  auditEvents,
  mediaAssets,
  outboxEvents,
  type CmsMembership,
} from "@nite/cms-db";
import {
  CmsAuthorizationError,
  type CmsDatabase,
  requireActiveCmsMembership,
} from "./identity";

export const editorialArticleInputSchema = newsArticleSchema
  .pick({
    slug: true,
    title: true,
    summary: true,
    category: true,
    eventDate: true,
    readTimeMinutes: true,
    byline: true,
    featured: true,
    body: true,
    seo: true,
  })
  .extend({
    coverMediaId: z.uuid().nullable(),
    coverAlt: z.string().min(12),
  });

export type EditorialArticleInput = z.infer<typeof editorialArticleInputSchema>;

export class EditorialConflictError extends Error {
  constructor() {
    super(
      "A matéria foi atualizada por outra pessoa. Recarregue antes de salvar.",
    );
    this.name = "EditorialConflictError";
  }
}

export class EditorialPublicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EditorialPublicationError";
  }
}

function assertCanEdit(
  actor: CmsMembership,
  article: typeof articles.$inferSelect,
) {
  if (actor.role === "author" && article.createdByMembershipId !== actor.id) {
    throw new CmsAuthorizationError();
  }
}

function assertCanPublish(actor: CmsMembership) {
  if (actor.role === "author") {
    throw new CmsAuthorizationError();
  }
}

function revisionValues(
  input: EditorialArticleInput,
  articleId: string,
  version: number,
  actorId: string,
) {
  return {
    articleId,
    version,
    title: input.title,
    summary: input.summary,
    category: input.category,
    eventDate: input.eventDate,
    readTimeMinutes: input.readTimeMinutes,
    byline: input.byline,
    featured: input.featured,
    coverMediaId: input.coverMediaId,
    coverAlt: input.coverAlt,
    body: input.body,
    seo: input.seo,
    createdByMembershipId: actorId,
  };
}

export async function createArticleDraft<TQueryResult extends PgQueryResultHKT>(
  database: CmsDatabase<TQueryResult>,
  command: { actor: CmsMembership; input: EditorialArticleInput },
) {
  const input = editorialArticleInputSchema.parse(command.input);

  return database.transaction(async (transaction) => {
    const actor = await requireActiveCmsMembership(
      transaction,
      command.actor.id,
    );
    const [article] = await transaction
      .insert(articles)
      .values({
        slug: input.slug,
        featured: input.featured,
        createdByMembershipId: actor.id,
        updatedByMembershipId: actor.id,
      })
      .returning();
    const [revision] = await transaction
      .insert(articleRevisions)
      .values(revisionValues(input, article.id, 1, actor.id))
      .returning();
    const [updatedArticle] = await transaction
      .update(articles)
      .set({ currentRevisionId: revision.id, updatedAt: new Date() })
      .where(eq(articles.id, article.id))
      .returning();

    await transaction.insert(auditEvents).values({
      actorMembershipId: actor.id,
      action: "article.created",
      aggregateType: "article",
      aggregateId: article.id,
      metadata: { revisionId: revision.id, version: 1 },
    });

    return { article: updatedArticle, revision };
  });
}

export async function saveArticleRevision<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
  command: {
    actor: CmsMembership;
    articleId: string;
    expectedRevisionId: string;
    input: EditorialArticleInput;
  },
) {
  const input = editorialArticleInputSchema.parse(command.input);

  return database.transaction(async (transaction) => {
    const actor = await requireActiveCmsMembership(
      transaction,
      command.actor.id,
    );
    const [article] = await transaction
      .select()
      .from(articles)
      .where(eq(articles.id, command.articleId))
      .limit(1);

    if (!article || article.currentRevisionId !== command.expectedRevisionId) {
      throw new EditorialConflictError();
    }
    assertCanEdit(actor, article);
    if (article.status === "published" && input.slug !== article.slug) {
      throw new EditorialPublicationError(
        "O slug de uma matéria publicada não pode ser alterado.",
      );
    }

    const [currentRevision] = await transaction
      .select({ version: articleRevisions.version })
      .from(articleRevisions)
      .where(eq(articleRevisions.id, command.expectedRevisionId))
      .limit(1);
    if (!currentRevision) {
      throw new EditorialConflictError();
    }

    const [revision] = await transaction
      .insert(articleRevisions)
      .values(
        revisionValues(
          input,
          article.id,
          currentRevision.version + 1,
          actor.id,
        ),
      )
      .returning();
    const [updatedArticle] = await transaction
      .update(articles)
      .set({
        slug: input.slug,
        currentRevisionId: revision.id,
        updatedByMembershipId: actor.id,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(articles.id, article.id),
          eq(articles.currentRevisionId, command.expectedRevisionId),
        ),
      )
      .returning();
    if (!updatedArticle) {
      throw new EditorialConflictError();
    }

    await transaction.insert(auditEvents).values({
      actorMembershipId: actor.id,
      action: "article.revision.saved",
      aggregateType: "article",
      aggregateId: article.id,
      metadata: { revisionId: revision.id, version: revision.version },
    });

    return { article: updatedArticle, revision };
  });
}

export async function publishArticle<TQueryResult extends PgQueryResultHKT>(
  database: CmsDatabase<TQueryResult>,
  command: {
    actor: CmsMembership;
    articleId: string;
    expectedRevisionId: string;
  },
) {
  return database.transaction(async (transaction) => {
    const actor = await requireActiveCmsMembership(
      transaction,
      command.actor.id,
    );
    assertCanPublish(actor);

    const [article] = await transaction
      .select()
      .from(articles)
      .where(eq(articles.id, command.articleId))
      .limit(1);
    if (!article || article.currentRevisionId !== command.expectedRevisionId) {
      throw new EditorialConflictError();
    }

    const [revision] = await transaction
      .select({
        coverMediaId: articleRevisions.coverMediaId,
        featured: articleRevisions.featured,
      })
      .from(articleRevisions)
      .where(eq(articleRevisions.id, command.expectedRevisionId))
      .limit(1);
    if (!revision?.coverMediaId) {
      throw new EditorialPublicationError(
        "Selecione uma capa processada antes de publicar.",
      );
    }
    const [cover] = await transaction
      .select({ status: mediaAssets.status })
      .from(mediaAssets)
      .where(eq(mediaAssets.id, revision.coverMediaId))
      .limit(1);
    if (cover?.status !== "ready") {
      throw new EditorialPublicationError(
        "A capa ainda não terminou de ser processada.",
      );
    }

    const publishedAt = new Date();
    const [publishedArticle] = await transaction
      .update(articles)
      .set({
        status: "published",
        publishedRevisionId: command.expectedRevisionId,
        publishedAt,
        featured: revision.featured,
        updatedByMembershipId: actor.id,
        updatedAt: publishedAt,
      })
      .where(
        and(
          eq(articles.id, article.id),
          eq(articles.currentRevisionId, command.expectedRevisionId),
        ),
      )
      .returning();
    if (!publishedArticle) {
      throw new EditorialConflictError();
    }

    await transaction.insert(auditEvents).values({
      actorMembershipId: actor.id,
      action: "article.published",
      aggregateType: "article",
      aggregateId: article.id,
      metadata: { revisionId: command.expectedRevisionId },
    });
    await transaction.insert(outboxEvents).values({
      topic: "news.article.published",
      aggregateId: article.id,
      payload: {
        articleId: article.id,
        revisionId: command.expectedRevisionId,
        slug: article.slug,
      },
    });

    return publishedArticle;
  });
}
