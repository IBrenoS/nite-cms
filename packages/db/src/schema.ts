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
  primaryKey,
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
export const cmsRoleEnum = pgEnum("cms_role", ["admin", "publisher"]);
export const cmsMembershipInvitationStatusEnum = pgEnum(
  "cms_membership_invitation_status",
  ["pending", "accepted", "revoked"],
);
export const mediaStatusEnum = pgEnum("media_status", [
  "pending",
  "processing",
  "ready",
  "quarantined",
  "failed",
  "deleting",
]);
export const mediaKindEnum = pgEnum("media_kind", [
  "image",
  "video",
  "captions",
]);
export const outboxStatusEnum = pgEnum("outbox_status", [
  "pending",
  "processing",
  "succeeded",
  "failed",
]);
export const emailDeliveryStatusEnum = pgEnum("email_delivery_status", [
  "pending",
  "sent",
  "delivered",
  "bounced",
  "complained",
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

export const cmsMembershipInvitations = pgTable(
  "cms_membership_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: varchar("tenant_id", { length: 64 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    role: cmsRoleEnum("role").notNull(),
    status: cmsMembershipInvitationStatusEnum("status")
      .default("pending")
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    invitedByMembershipId: uuid("invited_by_membership_id")
      .notNull()
      .references(() => cmsMemberships.id, { onDelete: "restrict" }),
    acceptedMembershipId: uuid("accepted_membership_id").references(
      () => cmsMemberships.id,
      { onDelete: "restrict" },
    ),
    replacesInvitationId: uuid("replaces_invitation_id").references(
      (): AnyPgColumn => cmsMembershipInvitations.id,
      { onDelete: "restrict" },
    ),
    linkNonce: uuid("link_nonce").defaultRandom().notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("cms_membership_invitations_pending_email_unique")
      .on(table.tenantId, table.email)
      .where(sql`${table.status} = 'pending'`),
    uniqueIndex("cms_membership_invitations_accepted_membership_unique")
      .on(table.acceptedMembershipId)
      .where(sql`${table.acceptedMembershipId} is not null`),
    index("cms_membership_invitations_tenant_status_idx").on(
      table.tenantId,
      table.status,
      table.expiresAt,
    ),
    check(
      "cms_membership_invitations_email_check",
      sql`${table.email} = lower(btrim(${table.email}))
        and ${table.email} ~ '^[a-z0-9.!#$%&''*+/=?^_{|}~-]+@unijorge[.]com([.]br)?$'
        and split_part(${table.email}, '@', 1) not like '.%'
        and split_part(${table.email}, '@', 1) not like '%.'
        and split_part(${table.email}, '@', 1) not like '%..%'`,
    ),
    check(
      "cms_membership_invitations_expiration_check",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
    check(
      "cms_membership_invitations_state_check",
      sql`(${table.status} = 'pending' and ${table.acceptedAt} is null and ${table.revokedAt} is null and ${table.acceptedMembershipId} is null)
        or (${table.status} = 'accepted' and ${table.acceptedAt} is not null and ${table.revokedAt} is null and ${table.acceptedMembershipId} is not null)
        or (${table.status} = 'revoked' and ${table.acceptedAt} is null and ${table.revokedAt} is not null and ${table.acceptedMembershipId} is null)`,
    ),
  ],
);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mediaKind: mediaKindEnum("media_kind").default("image").notNull(),
    stagingObjectKey: text("staging_object_key").notNull().unique(),
    publicObjectKey: text("public_object_key").unique(),
    mimeType: varchar("mime_type", { length: 127 }).notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width"),
    height: integer("height"),
    checksumSha256: varchar("checksum_sha256", { length: 64 }),
    durationMs: integer("duration_ms"),
    videoCodec: varchar("video_codec", { length: 32 }),
    hasAudio: boolean("has_audio"),
    objectEtag: varchar("object_etag", { length: 255 }),
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
      "media_assets_duration_check",
      sql`${table.durationMs} is null or ${table.durationMs} > 0`,
    ),
    check(
      "media_assets_kind_metadata_check",
      sql`(${table.mediaKind} = 'image' and ${table.durationMs} is null and ${table.videoCodec} is null and ${table.hasAudio} is null and ${table.objectEtag} is null)
        or (${table.mediaKind} = 'video' and ${table.checksumSha256} is null)
        or (${table.mediaKind} = 'captions' and ${table.width} is null and ${table.height} is null and ${table.videoCodec} is null and ${table.hasAudio} is null and ${table.objectEtag} is null)`,
    ),
    check(
      "media_assets_ready_metadata_check",
      sql`${table.status} <> 'ready' or (
        (${table.mediaKind} = 'image' and ${table.publicObjectKey} is not null and ${table.checksumSha256} is not null and ${table.width} is not null and ${table.height} is not null)
        or (${table.mediaKind} = 'video' and ${table.mimeType} = 'video/mp4' and ${table.publicObjectKey} is not null and ${table.objectEtag} is not null and ${table.width} is not null and ${table.height} is not null and ${table.durationMs} is not null and ${table.videoCodec} is not null and ${table.hasAudio} is not null)
        or (${table.mediaKind} = 'captions' and ${table.mimeType} = 'text/vtt' and ${table.publicObjectKey} is not null and ${table.checksumSha256} is not null and ${table.durationMs} is not null)
      )`,
    ),
    check(
      "media_assets_non_ready_public_key_check",
      sql`${table.status} in ('ready', 'deleting') or ${table.publicObjectKey} is null`,
    ),
    index("media_assets_status_idx").on(table.status),
  ],
);

export const articles = pgTable(
  "articles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 120 }).notNull().unique(),
    slugManuallyEdited: boolean("slug_manually_edited")
      .default(false)
      .notNull(),
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
    coverCaption: text("cover_caption"),
    coverCredit: text("cover_credit"),
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

export const previewSnapshots = pgTable(
  "preview_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    baseRevisionId: uuid("base_revision_id")
      .notNull()
      .references(() => articleRevisions.id, { onDelete: "cascade" }),
    actorMembershipId: uuid("actor_membership_id")
      .notNull()
      .references(() => cmsMemberships.id, { onDelete: "cascade" }),
    payload: jsonb("payload").$type<unknown>().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("preview_snapshots_article_idx").on(table.articleId, table.createdAt),
    index("preview_snapshots_expiration_idx").on(table.expiresAt),
    check(
      "preview_snapshots_expiration_check",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
  ],
);

export const articleMediaReferences = pgTable(
  "article_media_references",
  {
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.articleId, table.mediaId] }),
    index("article_media_references_media_idx").on(table.mediaId),
  ],
);

export const previewMediaReferences = pgTable(
  "preview_media_references",
  {
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => previewSnapshots.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.snapshotId, table.mediaId] }),
    index("preview_media_references_media_idx").on(table.mediaId),
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

export const emailDeliveries = pgTable(
  "email_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    outboxEventId: uuid("outbox_event_id")
      .notNull()
      .references(() => outboxEvents.id, { onDelete: "restrict" }),
    invitationId: uuid("invitation_id")
      .notNull()
      .references(() => cmsMembershipInvitations.id, {
        onDelete: "restrict",
      }),
    provider: varchar("provider", { length: 32 }).default("resend").notNull(),
    providerMessageId: varchar("provider_message_id", { length: 255 }),
    recipientEmail: varchar("recipient_email", { length: 320 }).notNull(),
    status: emailDeliveryStatusEnum("status").default("pending").notNull(),
    lastProviderEventAt: timestamp("last_provider_event_at", {
      withTimezone: true,
    }),
    failureReason: text("failure_reason"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("email_deliveries_outbox_event_unique").on(table.outboxEventId),
    uniqueIndex("email_deliveries_invitation_unique").on(table.invitationId),
    uniqueIndex("email_deliveries_provider_message_unique")
      .on(table.providerMessageId)
      .where(sql`${table.providerMessageId} is not null`),
    index("email_deliveries_status_idx").on(table.status, table.createdAt),
    check("email_deliveries_provider_check", sql`${table.provider} = 'resend'`),
    check(
      "email_deliveries_recipient_email_check",
      sql`${table.recipientEmail} = lower(btrim(${table.recipientEmail}))`,
    ),
  ],
);

export const emailDeliveryEvents = pgTable(
  "email_delivery_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerEventId: varchar("provider_event_id", { length: 255 }).notNull(),
    deliveryId: uuid("delivery_id")
      .notNull()
      .references(() => emailDeliveries.id, { onDelete: "cascade" }),
    providerEventType: varchar("provider_event_type", {
      length: 80,
    }).notNull(),
    providerCreatedAt: timestamp("provider_created_at", {
      withTimezone: true,
    }).notNull(),
    failureReason: text("failure_reason"),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("email_delivery_events_provider_event_unique").on(
      table.providerEventId,
    ),
    index("email_delivery_events_delivery_created_idx").on(
      table.deliveryId,
      table.providerCreatedAt,
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
  coverCaption: text("cover_caption"),
  coverCredit: text("cover_credit"),
  body: jsonb("body").$type<unknown>().notNull(),
  bodyMedia: jsonb("body_media")
    .$type<
      Record<
        string,
        {
          mediaKind: "image" | "video" | "captions";
          objectKey: string;
          mimeType: string;
          width?: number;
          height?: number;
          durationMs?: number;
          videoCodec?: string;
          hasAudio?: boolean;
        }
      >
    >()
    .notNull(),
  seo: jsonb("seo").$type<unknown>(),
  public: boolean("public").notNull(),
  contentState: text("content_state").notNull(),
}).existing();

export type CmsMembership = typeof cmsMemberships.$inferSelect;
export type NewCmsMembership = typeof cmsMemberships.$inferInsert;
export type CmsMembershipInvitation =
  typeof cmsMembershipInvitations.$inferSelect;
export type NewCmsMembershipInvitation =
  typeof cmsMembershipInvitations.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type PreviewSnapshot = typeof previewSnapshots.$inferSelect;
export type ArticleMediaReference = typeof articleMediaReferences.$inferSelect;
export type PreviewMediaReference = typeof previewMediaReferences.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type ArticleRevision = typeof articleRevisions.$inferSelect;
export type NewArticleRevision = typeof articleRevisions.$inferInsert;
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type NewMediaAsset = typeof mediaAssets.$inferInsert;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type OutboxEvent = typeof outboxEvents.$inferSelect;
export type EmailDelivery = typeof emailDeliveries.$inferSelect;
export type NewEmailDelivery = typeof emailDeliveries.$inferInsert;
export type EmailDeliveryEvent = typeof emailDeliveryEvents.$inferSelect;
export type NewEmailDeliveryEvent = typeof emailDeliveryEvents.$inferInsert;
export type PublishedArticleRow = typeof publishedArticles.$inferSelect;
