import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  pgView,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const articleStatusEnum = pgEnum("article_status", [
  "draft",
  "published",
  "archived",
]);
export const cmsRoleEnum = pgEnum("cms_role", ["admin", "editor", "author"]);
export const mediaStatusEnum = pgEnum("media_status", [
  "pending",
  "processing",
  "ready",
  "quarantined",
  "failed",
]);
export const outboxStatusEnum = pgEnum("outbox_status", [
  "pending",
  "processing",
  "succeeded",
  "failed",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const user = pgTable("auth_users", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  ...timestamps,
});

export const session = pgTable(
  "auth_sessions",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: varchar("token", { length: 255 }).notNull().unique(),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [index("auth_sessions_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "auth_accounts",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    issuer: varchar("issuer", { length: 255 }).notNull(),
    accountId: varchar("account_id", { length: 255 }).notNull(),
    providerId: varchar("provider_id", { length: 255 }).notNull(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("auth_accounts_issuer_account_id_unique").on(
      table.issuer,
      table.accountId,
    ),
    index("auth_accounts_user_id_idx").on(table.userId),
  ],
);

export const verification = pgTable(
  "auth_verifications",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    identifier: varchar("identifier", { length: 320 }).notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [index("auth_verifications_identifier_idx").on(table.identifier)],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const cmsMemberships = pgTable(
  "cms_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: varchar("tenant_id", { length: 64 }).notNull(),
    objectId: varchar("object_id", { length: 128 }).notNull(),
    displayName: varchar("display_name", { length: 160 }).notNull(),
    email: varchar("email", { length: 320 }),
    role: cmsRoleEnum("role").notNull(),
    active: boolean("active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("cms_memberships_identity_unique").on(
      table.tenantId,
      table.objectId,
    ),
    index("cms_memberships_role_idx").on(table.role),
  ],
);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    objectKey: text("object_key").notNull().unique(),
    mimeType: varchar("mime_type", { length: 127 }).notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width"),
    height: integer("height"),
    checksumSha256: varchar("checksum_sha256", { length: 64 }),
    status: mediaStatusEnum("status").default("pending").notNull(),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => cmsMemberships.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    check("media_assets_byte_size_check", sql`${table.byteSize} >= 0`),
    check(
      "media_assets_dimensions_check",
      sql`(${table.width} is null or ${table.width} > 0) and (${table.height} is null or ${table.height} > 0)`,
    ),
    check(
      "media_assets_ready_metadata_check",
      sql`${table.status} <> 'ready' or (${table.checksumSha256} is not null and ${table.width} is not null and ${table.height} is not null)`,
    ),
    index("media_assets_status_idx").on(table.status),
  ],
);

export const articles = pgTable(
  "articles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 120 }).notNull().unique(),
    status: articleStatusEnum("status").default("draft").notNull(),
    currentRevisionId: uuid("current_revision_id").references(
      (): AnyPgColumn => articleRevisions.id,
      { onDelete: "restrict" },
    ),
    publishedRevisionId: uuid("published_revision_id").references(
      (): AnyPgColumn => articleRevisions.id,
      { onDelete: "restrict" },
    ),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    featured: boolean("featured").default(false).notNull(),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => cmsMemberships.id,
      { onDelete: "set null" },
    ),
    updatedByMembershipId: uuid("updated_by_membership_id").references(
      () => cmsMemberships.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    check(
      "articles_published_state_check",
      sql`${table.status} <> 'published' or (${table.publishedRevisionId} is not null and ${table.publishedAt} is not null)`,
    ),
    index("articles_publication_idx").on(
      table.status,
      table.publishedAt,
      table.featured,
    ),
  ],
);

export const articleRevisions = pgTable(
  "article_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    contentSchemaVersion: integer("content_schema_version")
      .default(1)
      .notNull(),
    title: varchar("title", { length: 100 }).notNull(),
    summary: varchar("summary", { length: 220 }).notNull(),
    category: varchar("category", { length: 32 }).notNull(),
    eventDate: date("event_date"),
    readTimeMinutes: integer("read_time_minutes").notNull(),
    byline: varchar("byline", { length: 80 }).notNull(),
    featured: boolean("featured").default(false).notNull(),
    coverMediaId: uuid("cover_media_id").references(() => mediaAssets.id, {
      onDelete: "restrict",
    }),
    coverAlt: text("cover_alt").notNull(),
    body: jsonb("body").$type<unknown>().notNull(),
    seo: jsonb("seo").$type<unknown>(),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => cmsMemberships.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("article_revisions_article_version_unique").on(
      table.articleId,
      table.version,
    ),
    index("article_revisions_article_idx").on(table.articleId),
    check("article_revisions_version_check", sql`${table.version} >= 1`),
    check(
      "article_revisions_schema_version_check",
      sql`${table.contentSchemaVersion} >= 1`,
    ),
    check(
      "article_revisions_read_time_check",
      sql`${table.readTimeMinutes} between 1 and 30`,
    ),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorMembershipId: uuid("actor_membership_id").references(
      () => cmsMemberships.id,
      { onDelete: "set null" },
    ),
    action: varchar("action", { length: 80 }).notNull(),
    aggregateType: varchar("aggregate_type", { length: 80 }).notNull(),
    aggregateId: uuid("aggregate_id").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_events_aggregate_idx").on(
      table.aggregateType,
      table.aggregateId,
      table.createdAt,
    ),
  ],
);

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    topic: varchar("topic", { length: 120 }).notNull(),
    aggregateId: uuid("aggregate_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: outboxStatusEnum("status").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockToken: uuid("lock_token"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [
    check("outbox_events_attempts_check", sql`${table.attempts} >= 0`),
    index("outbox_events_pending_idx").on(
      table.status,
      table.nextAttemptAt,
      table.createdAt,
    ),
  ],
);

export const publishedArticles = pgView("published_articles", {
  articleId: uuid("article_id").notNull(),
  revisionId: uuid("revision_id").notNull(),
  contentSchemaVersion: integer("content_schema_version").notNull(),
  slug: varchar("slug", { length: 120 }).notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
  featured: boolean("featured").notNull(),
  title: varchar("title", { length: 100 }).notNull(),
  summary: varchar("summary", { length: 220 }).notNull(),
  category: varchar("category", { length: 32 }).notNull(),
  eventDate: date("event_date"),
  readTimeMinutes: integer("read_time_minutes").notNull(),
  byline: varchar("byline", { length: 80 }).notNull(),
  coverObjectKey: text("cover_object_key").notNull(),
  coverAlt: text("cover_alt").notNull(),
  body: jsonb("body").$type<unknown>().notNull(),
  seo: jsonb("seo").$type<unknown>(),
  public: boolean("public").notNull(),
  contentState: text("content_state").notNull(),
}).existing();

export type CmsMembership = typeof cmsMemberships.$inferSelect;
export type NewCmsMembership = typeof cmsMemberships.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type ArticleRevision = typeof articleRevisions.$inferSelect;
export type NewArticleRevision = typeof articleRevisions.$inferInsert;
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type NewMediaAsset = typeof mediaAssets.$inferInsert;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type OutboxEvent = typeof outboxEvents.$inferSelect;
export type PublishedArticleRow = typeof publishedArticles.$inferSelect;
