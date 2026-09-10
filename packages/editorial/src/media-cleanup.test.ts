import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  purgeDeletingMediaAsset,
  scheduleOrphanMediaPurges,
  type MediaObjectStore,
} from "@nite/editorial";
import { mediaAssets, outboxEvents } from "@nite/cms-db";
import * as cmsSchema from "@nite/cms-db";

const migrationsFolder = fileURLToPath(
  new URL("../../db/drizzle", import.meta.url),
);

class DeletingObjectStore implements MediaObjectStore {
  readonly deletedStaging: string[] = [];
  readonly deletedPublic: string[] = [];
  failPublic = false;

  async createStagingUploadUrl(): Promise<{
    url: string;
    requiredHeaders: Readonly<Record<string, string>>;
    expiresAt: Date;
  }> {
    throw new Error("Não usado neste teste.");
  }

  async getStagingObject(): Promise<Uint8Array> {
    throw new Error("Não usado neste teste.");
  }

  async putPublicObject() {
    throw new Error("Não usado neste teste.");
  }

  async deleteStagingObject(key: string) {
    this.deletedStaging.push(key);
  }

  async deletePublicObject(key: string) {
    this.deletedPublic.push(key);
    if (this.failPublic) throw new Error("bucket público indisponível");
  }
}

describe("limpeza de mídia editorial", () => {
  let client: PGlite;

  beforeEach(async () => {
    client = new PGlite();
    await migrate(drizzle(client), { migrationsFolder });
  });

  afterEach(async () => {
    await client.close();
  });

  it("agenda uma única vez mídias órfãs com mais de 48 horas", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const oldMediaId = randomUUID();
    const recentMediaId = randomUUID();
    await database.insert(mediaAssets).values([
      {
        id: oldMediaId,
        stagingObjectKey: `incoming/${oldMediaId}/original`,
        mimeType: "image/png",
        byteSize: 10,
        status: "pending",
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
        updatedAt: new Date("2026-09-01T00:00:00.000Z"),
      },
      {
        id: recentMediaId,
        stagingObjectKey: `incoming/${recentMediaId}/original`,
        mimeType: "image/png",
        byteSize: 10,
        status: "pending",
        createdAt: new Date("2026-09-09T00:00:00.000Z"),
        updatedAt: new Date("2026-09-09T00:00:00.000Z"),
      },
    ]);

    await expect(
      scheduleOrphanMediaPurges(database, {
        now: new Date("2026-09-09T12:00:00.000Z"),
      }),
    ).resolves.toEqual({ scheduled: 1 });
    await expect(
      scheduleOrphanMediaPurges(database, {
        now: new Date("2026-09-09T12:00:00.000Z"),
      }),
    ).resolves.toEqual({ scheduled: 0 });

    await expect(
      database
        .select({ id: mediaAssets.id, status: mediaAssets.status })
        .from(mediaAssets),
    ).resolves.toEqual(
      expect.arrayContaining([
        { id: oldMediaId, status: "deleting" },
        { id: recentMediaId, status: "pending" },
      ]),
    );
    await expect(
      database
        .select({
          topic: outboxEvents.topic,
          aggregateId: outboxEvents.aggregateId,
        })
        .from(outboxEvents)
        .where(
          and(
            eq(outboxEvents.topic, "media.asset.purge"),
            eq(outboxEvents.aggregateId, oldMediaId),
          ),
        ),
    ).resolves.toEqual([
      { topic: "media.asset.purge", aggregateId: oldMediaId },
    ]);
  });

  it("remove staging e public antes de apagar o registro e tolera retry", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const mediaId = randomUUID();
    await database.insert(mediaAssets).values({
      id: mediaId,
      stagingObjectKey: `incoming/${mediaId}/original`,
      publicObjectKey: `news/${mediaId}/processed.webp`,
      mimeType: "image/webp",
      byteSize: 10,
      width: 10,
      height: 10,
      checksumSha256: "a".repeat(64),
      status: "deleting",
    });
    const store = new DeletingObjectStore();
    store.failPublic = true;

    await expect(
      purgeDeletingMediaAsset(database, store, { mediaId }),
    ).rejects.toThrow(/bucket público/);
    await expect(
      database.select().from(mediaAssets).where(eq(mediaAssets.id, mediaId)),
    ).resolves.toHaveLength(1);

    store.failPublic = false;
    await expect(
      purgeDeletingMediaAsset(database, store, { mediaId }),
    ).resolves.toEqual({ deleted: true });
    await expect(
      database.select().from(mediaAssets).where(eq(mediaAssets.id, mediaId)),
    ).resolves.toEqual([]);
    expect(store.deletedStaging).toEqual([
      `incoming/${mediaId}/original`,
      `incoming/${mediaId}/original`,
    ]);
    expect(store.deletedPublic).toEqual([
      `news/${mediaId}/processed.webp`,
      `news/${mediaId}/processed.webp`,
    ]);
    await expect(
      purgeDeletingMediaAsset(database, store, { mediaId }),
    ).resolves.toEqual({ deleted: false });
  });
});
