import { and, eq, inArray } from "drizzle-orm";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";

import {
  deriveEditorialSlug,
  editableEditorialSlugSchema,
  editorialDraftInputSchema,
  editorialPublishableInputSchema,
  newsCategoryValues,
  type EditorialDraftInput,
} from "./article-schema";
import {
  calculateEditorialReadTime,
  getEditorialImageMediaIds,
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

const editableSlugSchema = editableEditorialSlugSchema;
const coverAltSchema = z.string().trim().min(12);

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
    coverAlt: coverAltSchema,
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

export class EditorialSlugConflictError extends Error {
  constructor() {
    super("Já existe uma matéria com este slug.");
    this.name = "EditorialSlugConflictError";
  }
}

function isSlugConstraintError(error: unknown) {
  let current = error;
  for (let depth = 0; depth < 4 && current instanceof Error; depth += 1) {
    const candidate = current as Error & {
      cause?: unknown;
      code?: unknown;
      constraint?: unknown;
    };
    const identifiesSlugConstraint =
      candidate.constraint === "articles_slug_unique" ||
      candidate.message.includes("articles_slug_unique");
    if (candidate.code === "23505" && identifiesSlugConstraint) return true;
    current = candidate.cause;
  }
  return false;
}

function revisionValues(
  input: EditorialDraftInput,
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

function resolveDraftSlug(
  input: EditorialDraftInput,
  slugManuallyEdited: boolean,
) {
  return editableSlugSchema.parse(
    slugManuallyEdited ? input.slug : deriveEditorialSlug(input.title),
  );
}

export async function createArticleDraft<TQueryResult extends PgQueryResultHKT>(
  database: CmsDatabase<TQueryResult>,
  command: {
    actor: CmsMembership;
    input: EditorialDraftInput;
    slugManuallyEdited?: boolean;
  },
) {
  const input = editorialDraftInputSchema.parse(command.input);
  const slugManuallyEdited = z
    .boolean()
    .parse(command.slugManuallyEdited ?? false);
  const slug = resolveDraftSlug(input, slugManuallyEdited);

  try {
    return await database.transaction(async (transaction) => {
      const actor = await requireActiveCmsMembership(
        transaction,
        command.actor.id,
      );
      const [article] = await transaction
        .insert(articles)
        .values({
          slug,
          slugManuallyEdited,
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
  } catch (error) {
    if (isSlugConstraintError(error)) throw new EditorialSlugConflictError();
    throw error;
  }
}

export async function saveArticleRevision<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
  command: {
    actor: CmsMembership;
    articleId: string;
    expectedRevisionId: string;
    input: EditorialDraftInput;
    slugManuallyEdited?: boolean;
  },
) {
  const input = editorialDraftInputSchema.parse(command.input);

  try {
    return await database.transaction(async (transaction) => {
      const actor = await requireActiveCmsMembership(
        transaction,
        command.actor.id,
      );
      const [article] = await transaction
        .select()
        .from(articles)
        .where(eq(articles.id, command.articleId))
        .limit(1);

      if (
        !article ||
        article.currentRevisionId !== command.expectedRevisionId
      ) {
        throw new EditorialConflictError();
      }
      const requestedSlug = input.slug
        ? editableSlugSchema.parse(input.slug)
        : undefined;
      if (
        article.publishedAt &&
        requestedSlug !== undefined &&
        requestedSlug !== article.slug
      ) {
        throw new EditorialPublicationError(
          "O slug de uma matéria publicada não pode ser alterado.",
        );
      }
      const requestedManualState = z
        .boolean()
        .parse(command.slugManuallyEdited ?? false);
      const slugManuallyEdited = article.publishedAt
        ? article.slugManuallyEdited
        : article.slugManuallyEdited || requestedManualState;
      const slug = article.publishedAt
        ? article.slug
        : resolveDraftSlug(input, slugManuallyEdited);

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
          slugManuallyEdited,
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
  } catch (error) {
    if (isSlugConstraintError(error)) throw new EditorialSlugConflictError();
    throw error;
  }
}

async function getPublishableRevision<TQueryResult extends PgQueryResultHKT>(
  database: CmsDatabase<TQueryResult>,
  article: typeof articles.$inferSelect,
  revisionId: string,
) {
  const [revision] = await database
    .select({
      title: articleRevisions.title,
      summary: articleRevisions.summary,
      category: articleRevisions.category,
      eventDate: articleRevisions.eventDate,
      byline: articleRevisions.byline,
      coverMediaId: articleRevisions.coverMediaId,
      coverAlt: articleRevisions.coverAlt,
      body: articleRevisions.body,
      featured: articleRevisions.featured,
      seo: articleRevisions.seo,
    })
    .from(articleRevisions)
    .where(eq(articleRevisions.id, revisionId))
    .limit(1);
  if (!revision) throw new EditorialConflictError();
  return validateEditorialInputForPublication(database, {
    input: editorialDraftInputSchema.parse({
      ...revision,
      slug: article.slug,
      eventDate: revision.eventDate ?? undefined,
      seo: revision.seo ?? undefined,
    }),
  });
}

export async function validateEditorialInputForPublication<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
  command: { actor?: CmsMembership; input: EditorialDraftInput },
) {
  if (command.actor) {
    await requireActiveCmsMembership(database, command.actor.id);
  }
  const publishable = editorialPublishableInputSchema.parse(command.input);
  const [cover] = await database
    .select({ status: mediaAssets.status })
    .from(mediaAssets)
    .where(eq(mediaAssets.id, publishable.coverMediaId))
    .limit(1);
  if (cover?.status !== "ready") {
    throw new EditorialPublicationError(
      "A capa ainda não terminou de ser processada.",
    );
  }
  const inlineMediaIds = getEditorialImageMediaIds(publishable.body);
  if (inlineMediaIds.length > 0) {
    const inlineAssets = await database
      .select({ id: mediaAssets.id, status: mediaAssets.status })
      .from(mediaAssets)
      .where(inArray(mediaAssets.id, inlineMediaIds));
    if (
      inlineAssets.length !== inlineMediaIds.length ||
      inlineAssets.some((asset) => asset.status !== "ready")
    ) {
      throw new EditorialPublicationError(
        "Todas as imagens inline devem estar processadas antes de publicar.",
      );
    }
  }
  return publishable;
}

export async function validateEditorialRevisionForPublication<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
  command: {
    actor: CmsMembership;
    articleId: string;
    expectedRevisionId: string;
  },
) {
  await requireActiveCmsMembership(database, command.actor.id);
  const [article] = await database
    .select()
    .from(articles)
    .where(eq(articles.id, command.articleId))
    .limit(1);
  if (!article || article.currentRevisionId !== command.expectedRevisionId) {
    throw new EditorialConflictError();
  }
  return getPublishableRevision(database, article, command.expectedRevisionId);
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

    const publishable = await getPublishableRevision(
      transaction,
      article,
      command.expectedRevisionId,
    );

    const publishedAt = article.publishedAt ?? new Date();
    const [publishedArticle] = await transaction
      .update(articles)
      .set({
        status: "published",
        publishedRevisionId: command.expectedRevisionId,
        publishedAt,
        featured: publishable.featured,
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
        category: publishable.category,
      },
    });

    return publishedArticle;
  });
}

type EditorialSubmitTarget =
  | { kind: "new" }
  | { kind: "existing"; articleId: string; expectedRevisionId: string };

export async function submitEditorialRevision<
  TQueryResult extends PgQueryResultHKT,
>(
  database: CmsDatabase<TQueryResult>,
  command: {
    actor: CmsMembership;
    intent: "save" | "publish";
    target: EditorialSubmitTarget;
    input: EditorialDraftInput;
    slugManuallyEdited?: boolean;
  },
) {
  return database.transaction(async (transaction) => {
    const saved =
      command.target.kind === "new"
        ? await createArticleDraft(transaction, {
            actor: command.actor,
            input: command.input,
            slugManuallyEdited: command.slugManuallyEdited,
          })
        : await saveArticleRevision(transaction, {
            actor: command.actor,
            articleId: command.target.articleId,
            expectedRevisionId: command.target.expectedRevisionId,
            input: command.input,
            slugManuallyEdited: command.slugManuallyEdited,
          });

    const article =
      command.intent === "publish"
        ? await publishArticle(transaction, {
            actor: command.actor,
            articleId: saved.article.id,
            expectedRevisionId: saved.revision.id,
          })
        : saved.article;

    return { article, revision: saved.revision };
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
