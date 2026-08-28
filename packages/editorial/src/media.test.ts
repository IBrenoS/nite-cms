import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";

import {
  createMediaUpload,
  processMediaAsset,
  type ImageProcessor,
  type MediaObjectStore,
} from "@nite/editorial";
import { cmsMemberships, mediaAssets } from "@nite/cms-db";
import * as cmsSchema from "@nite/cms-db";

const migrationsFolder = fileURLToPath(
  new URL("../../db/drizzle", import.meta.url),
);

class MemoryObjectStore implements MediaObjectStore {
  readonly objects = new Map<string, Uint8Array>();

  async createUploadUrl(input: {
    objectKey: string;
    contentType: string;
    byteSize: number;
    expiresInSeconds: number;
  }) {
    return {
      url: `https://upload.nite.test/${input.objectKey}`,
      requiredHeaders: { "Content-Type": input.contentType },
      expiresAt: new Date("2026-08-27T18:05:00.000Z"),
    };
  }

  async getObject(objectKey: string) {
    const object = this.objects.get(objectKey);
    if (!object) throw new Error("Objeto ausente no fake store.");
    return object;
  }

  async putObject(input: {
    objectKey: string;
    body: Uint8Array;
    contentType: "image/webp";
  }) {
    this.objects.set(input.objectKey, input.body);
  }

  async deleteObject(objectKey: string) {
    this.objects.delete(objectKey);
  }
}

const imageProcessor: ImageProcessor = {
  async toWebp() {
    return {
      body: new TextEncoder().encode("processed-webp"),
      width: 1600,
      height: 900,
    };
  },
};

describe("mídia editorial", () => {
  let client: PGlite;

  beforeEach(async () => {
    client = new PGlite();
    await migrate(drizzle(client), { migrationsFolder });
  });

  afterEach(async () => {
    await client.close();
  });

  it("emite upload restrito e publica somente a imagem processada", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [actor] = await database
      .insert(cmsMemberships)
      .values({
        tenantId: "tenant-nite",
        objectId: "editor-oid",
        displayName: "Editora NITE",
        role: "editor",
      })
      .returning();
    const store = new MemoryObjectStore();
    const upload = await createMediaUpload(database, store, {
      actor,
      file: { mimeType: "image/png", byteSize: 12 },
    });

    expect(upload).toMatchObject({
      mediaId: expect.any(String),
      uploadUrl: expect.stringMatching(
        /^https:\/\/upload\.nite\.test\/incoming\//,
      ),
      requiredHeaders: { "Content-Type": "image/png" },
    });
    store.objects.set(
      `incoming/${upload.mediaId}`,
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]),
    );

    const processed = await processMediaAsset(database, store, imageProcessor, {
      mediaId: upload.mediaId,
    });

    expect(processed).toMatchObject({
      id: upload.mediaId,
      objectKey: `news/${upload.mediaId}.webp`,
      mimeType: "image/webp",
      byteSize: 14,
      width: 1600,
      height: 900,
      checksumSha256:
        "6209589bb80ad2ff5714bbb9787f134865a556e402853dffa5759c9499b3f4bb",
      status: "ready",
    });
    expect(store.objects.has(`incoming/${upload.mediaId}`)).toBe(false);
    expect(store.objects.has(`news/${upload.mediaId}.webp`)).toBe(true);
  });

  it("coloca em quarentena objeto cujo conteúdo não corresponde ao MIME", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [actor] = await database
      .insert(cmsMemberships)
      .values({
        tenantId: "tenant-nite",
        objectId: "editor-oid",
        displayName: "Editora NITE",
        role: "editor",
      })
      .returning();
    const store = new MemoryObjectStore();
    const upload = await createMediaUpload(database, store, {
      actor,
      file: { mimeType: "image/png", byteSize: 12 },
    });
    store.objects.set(
      `incoming/${upload.mediaId}`,
      new TextEncoder().encode("not-an-image"),
    );

    await expect(
      processMediaAsset(database, store, imageProcessor, {
        mediaId: upload.mediaId,
      }),
    ).rejects.toThrow(/quarentena/i);
    await expect(
      database
        .select({ status: mediaAssets.status })
        .from(mediaAssets)
        .where(eq(mediaAssets.id, upload.mediaId)),
    ).resolves.toEqual([{ status: "quarantined" }]);
  });
});
