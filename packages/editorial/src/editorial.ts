import { and, eq } from "drizzle-orm";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";

import { newsCategoryValues } from "./article-schema";
import {
  calculateEditorialReadTime,
  persistedEditorialDocumentV1Schema,
} from "./editor-document";
import {
  articleRevisions,
  articles,
  auditEvents,
  mediaAssets,
  outboxEvents,
  type CmsMembership,
} from "@nite/cms-db";
import { type CmsDatabase, requireActiveCmsMembership } from "./identity";

const editableSlugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(120);

export const editorialArticleInputSchema = z
  .object({
    slug: editableSlugSchema.or(z.literal("")).optional(),
    title: z.string().min(12).max(100),
    summary: z.string().min(48).max(220),
    category: z.enum(newsCategoryValues),
    eventDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    byline: z.string().min(3).max(80),
    featured: z.boolean(),
    body: persistedEditorialDocumentV1Schema,
    seo: z
      .object({
        title: z.string().min(20).max(60),
        description: z.string().min(80).max(160),
      })
      .optional(),
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
    contentSchemaVersion: input.body.schemaVersion,
    readTimeMinutes: calculateEditorialReadTime(input.body),
    byline: input.byline,
    featured: input.featured,
    coverMediaId: input.coverMediaId,
    coverAlt: input.coverAlt,
    body: input.body,
    seo: input.seo,
    createdByMembershipId: actorId,
  };
}

function deriveSlug(title: string) {
  const normalized = title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "");
  return editableSlugSchema.parse(normalized);
}

function resolveRequestedSlug(input: EditorialArticleInput) {
  return input.slug || deriveSlug(input.title);
}

export async function createArticleDraft<TQueryResult extends PgQueryResultHKT>(
  database: CmsDatabase<TQueryResult>,
  command: { actor: CmsMembership; input: EditorialArticleInput },
) {
  const input = editorialArticleInputSchema.parse(command.input);
  const slug = resolveRequestedSlug(input);

  return database.transaction(async (transaction) => {
    const actor = await requireActiveCmsMembership(
      transaction,
      command.actor.id,
    );
    const [article] = await transaction
      .insert(articles)
      .values({
        slug,
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
    const requestedSlug = resolveRequestedSlug(input);
    if (article.publishedAt && input.slug && requestedSlug !== article.slug) {
      throw new EditorialPublicationError(
        "O slug de uma matéria publicada não pode ser alterado.",
      );
    }
    const slug = article.publishedAt ? article.slug : requestedSlug;

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
        slug,
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
    const [article] = await transaction
      .select()
      .from(articles)
      .where(eq(articles.id, command.articleId))
      .limit(1);
    if (!article || article.currentRevisionId !== command.expectedRevisionId) {
      throw new EditorialConflictError();
    }
    if (article.status === "archived") {
      throw new EditorialPublicationError(
        "Restaure a matéria antes de publicar novamente.",
      );
    }

    const [revision] = await transaction
      .select({
        coverMediaId: articleRevisions.coverMediaId,
        featured: articleRevisions.featured,
        category: articleRevisions.category,
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

    const publishedAt = article.publishedAt ?? new Date();
    const [publishedArticle] = await transaction
      .update(articles)
      .set({
        status: "published",
        publishedRevisionId: command.expectedRevisionId,
        publishedAt,
        featured: revision.featured,
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
        category: revision.category,
      },
    });

    return publishedArticle;
  });
}

async function getArticleForTransition<TQueryResult extends PgQueryResultHKT>(
  database: CmsDatabase<TQueryResult>,
  command: { articleId: string; expectedRevisionId: string },
) {
  const [article] = await database
    .select()
    .from(articles)
    .where(eq(articles.id, command.articleId))
    .limit(1);
  if (!article || article.currentRevisionId !== command.expectedRevisionId) {
    throw new EditorialConflictError();
  }
  return article;
}

async function createPublicRemovalOutboxEvent<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
  article: typeof articles.$inferSelect,
  topic: "news.article.unpublished" | "news.article.archived",
) {
  if (!article.publishedRevisionId) {
    throw new EditorialPublicationError(
      "A matéria publicada não possui uma revisão pública válida.",
    );
  }
  const [revision] = await database
    .select({ category: articleRevisions.category })
    .from(articleRevisions)
    .where(eq(articleRevisions.id, article.publishedRevisionId))
    .limit(1);
  if (!revision) {
    throw new EditorialPublicationError(
      "A matéria publicada não possui uma revisão pública válida.",
    );
  }
  await database.insert(outboxEvents).values({
    topic,
    aggregateId: article.id,
    payload: {
      articleId: article.id,
      revisionId: article.publishedRevisionId,
      slug: article.slug,
      category: revision.category,
    },
  });
}

export async function unpublishArticle<TQueryResult extends PgQueryResultHKT>(
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
    const article = await getArticleForTransition(transaction, command);
    if (article.status !== "published") {
      throw new EditorialPublicationError("A matéria não está publicada.");
    }
    const [updatedArticle] = await transaction
      .update(articles)
      .set({
        status: "draft",
        updatedByMembershipId: actor.id,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(articles.id, article.id),
          eq(articles.currentRevisionId, command.expectedRevisionId),
          eq(articles.status, "published"),
        ),
      )
      .returning();
    if (!updatedArticle) throw new EditorialConflictError();
    await transaction.insert(auditEvents).values({
      actorMembershipId: actor.id,
      action: "article.unpublished",
      aggregateType: "article",
      aggregateId: article.id,
      metadata: { revisionId: article.publishedRevisionId },
    });
    await createPublicRemovalOutboxEvent(
      transaction,
      article,
      "news.article.unpublished",
    );
    return updatedArticle;
  });
}

export async function archiveArticle<TQueryResult extends PgQueryResultHKT>(
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
    const article = await getArticleForTransition(transaction, command);
    if (article.status === "archived") {
      throw new EditorialPublicationError("A matéria já está arquivada.");
    }
    const [updatedArticle] = await transaction
      .update(articles)
      .set({
        status: "archived",
        updatedByMembershipId: actor.id,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(articles.id, article.id),
          eq(articles.currentRevisionId, command.expectedRevisionId),
          eq(articles.status, article.status),
        ),
      )
      .returning();
    if (!updatedArticle) throw new EditorialConflictError();
    await transaction.insert(auditEvents).values({
      actorMembershipId: actor.id,
      action: "article.archived",
      aggregateType: "article",
      aggregateId: article.id,
      metadata: { revisionId: article.publishedRevisionId },
    });
    if (article.status === "published") {
      await createPublicRemovalOutboxEvent(
        transaction,
        article,
        "news.article.archived",
      );
    }
    return updatedArticle;
  });
}

export async function restoreArticle<TQueryResult extends PgQueryResultHKT>(
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
    const article = await getArticleForTransition(transaction, command);
    if (article.status !== "archived") {
      throw new EditorialPublicationError("A matéria não está arquivada.");
    }
    const [updatedArticle] = await transaction
      .update(articles)
      .set({
        status: "draft",
        updatedByMembershipId: actor.id,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(articles.id, article.id),
          eq(articles.currentRevisionId, command.expectedRevisionId),
          eq(articles.status, "archived"),
        ),
      )
      .returning();
    if (!updatedArticle) throw new EditorialConflictError();
    await transaction.insert(auditEvents).values({
      actorMembershipId: actor.id,
      action: "article.restored",
      aggregateType: "article",
      aggregateId: article.id,
      metadata: { revisionId: article.currentRevisionId },
    });
    return updatedArticle;
  });
}
