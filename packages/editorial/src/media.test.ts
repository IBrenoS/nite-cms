import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";

import {
  createMediaUpload,
  mediaUploadFileSchema,
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
  readonly publicWrites: string[] = [];

  async createStagingUploadUrl(input: {
    stagingObjectKey: string;
    contentType: string;
    byteSize: number;
    expiresInSeconds: number;
  }) {
    return {
      url: `https://upload.nite.test/${input.stagingObjectKey}`,
      requiredHeaders: { "Content-Type": input.contentType },
      expiresAt: new Date("2026-08-27T18:05:00.000Z"),
    };
  }

  async getStagingObject(stagingObjectKey: string) {
    const object = this.objects.get(stagingObjectKey);
    if (!object) throw new Error("Objeto ausente no fake store.");
    return object;
  }

  async putPublicObject(input: {
    publicObjectKey: string;
    body: Uint8Array;
    contentType: "image/webp";
  }) {
    this.publicWrites.push(input.publicObjectKey);
    this.objects.set(input.publicObjectKey, input.body);
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

  it("mantém o original no staging e publica uma chave pública imutável", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [actor] = await database
      .insert(cmsMemberships)
      .values({
        tenantId: "tenant-nite",
        objectId: "editor-oid",
        displayName: "Editora NITE",
        role: "publisher",
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
      `incoming/${upload.mediaId}/original`,
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]),
    );

    const processed = await processMediaAsset(database, store, imageProcessor, {
      mediaId: upload.mediaId,
    });

    expect(processed).toMatchObject({
      id: upload.mediaId,
      stagingObjectKey: `incoming/${upload.mediaId}/original`,
      publicObjectKey: `news/${upload.mediaId}/v1.webp`,
      mimeType: "image/webp",
      byteSize: 14,
      width: 1600,
      height: 900,
      checksumSha256:
        "6209589bb80ad2ff5714bbb9787f134865a556e402853dffa5759c9499b3f4bb",
      status: "ready",
    });
    expect(store.objects.has(`incoming/${upload.mediaId}/original`)).toBe(true);
    expect(
      [...store.objects.keys()].some(
        (key) => key === `news/${upload.mediaId}/v1.webp`,
      ),
    ).toBe(true);
  });

  it("marca como falha sem expor chave pública quando a publicação no destino falha", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [actor] = await database
      .insert(cmsMemberships)
      .values({
        tenantId: "tenant-nite",
        objectId: "editor-oid",
        displayName: "Editora NITE",
        role: "publisher",
      })
      .returning();
    const store = new MemoryObjectStore();
    const upload = await createMediaUpload(database, store, {
      actor,
      file: { mimeType: "image/png", byteSize: 12 },
    });
    store.objects.set(
      `incoming/${upload.mediaId}/original`,
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]),
    );
    store.putPublicObject = async () => {
      throw new Error("bucket público indisponível");
    };

    await expect(
      processMediaAsset(database, store, imageProcessor, {
        mediaId: upload.mediaId,
      }),
    ).rejects.toThrow(/processar/i);
    await expect(
      database
        .select()
        .from(mediaAssets)
        .where(eq(mediaAssets.id, upload.mediaId)),
    ).resolves.toMatchObject([
      {
        status: "failed",
        stagingObjectKey: `incoming/${upload.mediaId}/original`,
        publicObjectKey: null,
      },
    ]);
  });

  it("coloca em quarentena objeto cujo conteúdo não corresponde ao MIME", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [actor] = await database
      .insert(cmsMemberships)
      .values({
        tenantId: "tenant-nite",
        objectId: "editor-oid",
        displayName: "Editora NITE",
        role: "publisher",
      })
      .returning();
    const store = new MemoryObjectStore();
    const upload = await createMediaUpload(database, store, {
      actor,
      file: { mimeType: "image/png", byteSize: 12 },
    });
    store.objects.set(
      `incoming/${upload.mediaId}/original`,
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

  it("rejeita lease de processamento ainda ativa", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [actor] = await database
      .insert(cmsMemberships)
      .values({
        tenantId: "tenant-nite",
        objectId: "editor-oid",
        displayName: "Editora NITE",
        role: "publisher",
      })
      .returning();
    const store = new MemoryObjectStore();
    const upload = await createMediaUpload(database, store, {
      actor,
      file: { mimeType: "image/png", byteSize: 12 },
    });
    await database
      .update(mediaAssets)
      .set({ status: "processing", updatedAt: new Date() })
      .where(eq(mediaAssets.id, upload.mediaId));

    await expect(
      processMediaAsset(database, store, imageProcessor, {
        mediaId: upload.mediaId,
      }),
    ).rejects.toThrow(/disponível para processamento/i);
  });

  it("recupera lease vencida e conclui o processamento", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [actor] = await database
      .insert(cmsMemberships)
      .values({
        tenantId: "tenant-nite",
        objectId: "editor-oid",
        displayName: "Editora NITE",
        role: "publisher",
      })
      .returning();
    const store = new MemoryObjectStore();
    const upload = await createMediaUpload(database, store, {
      actor,
      file: { mimeType: "image/png", byteSize: 12 },
    });
    store.objects.set(
      `incoming/${upload.mediaId}/original`,
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]),
    );
    await database
      .update(mediaAssets)
      .set({
        status: "processing",
        updatedAt: new Date(Date.now() - 10 * 60 * 1000),
      })
      .where(eq(mediaAssets.id, upload.mediaId));

    await expect(
      processMediaAsset(database, store, imageProcessor, {
        mediaId: upload.mediaId,
      }),
    ).resolves.toMatchObject({
      status: "ready",
      publicObjectKey: `news/${upload.mediaId}/v1.webp`,
    });
  });

  it("retoma após crash depois do put sem criar outra chave pública", async () => {
    const database = drizzle(client, { schema: cmsSchema });
    const [actor] = await database
      .insert(cmsMemberships)
      .values({
        tenantId: "tenant-nite",
        objectId: "editor-oid",
        displayName: "Editora NITE",
        role: "publisher",
      })
      .returning();
    const store = new MemoryObjectStore();
    const upload = await createMediaUpload(database, store, {
      actor,
      file: { mimeType: "image/png", byteSize: 12 },
    });
    store.objects.set(
      `incoming/${upload.mediaId}/original`,
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]),
    );
    store.objects.set(
      `news/${upload.mediaId}/v1.webp`,
      new TextEncoder().encode("processed-webp"),
    );
    await database
      .update(mediaAssets)
      .set({
        status: "processing",
        updatedAt: new Date(Date.now() - 10 * 60 * 1000),
      })
      .where(eq(mediaAssets.id, upload.mediaId));

    await processMediaAsset(database, store, imageProcessor, {
      mediaId: upload.mediaId,
    });

    expect(store.publicWrites).toEqual([`news/${upload.mediaId}/v1.webp`]);
    expect(
      [...store.objects.keys()].filter((key) => key.startsWith("news/")),
    ).toEqual([`news/${upload.mediaId}/v1.webp`]);
  });

  it.each([
    ["image/jpeg", new Uint8Array([255, 216, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0])],
    [
      "image/webp",
      new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]),
    ],
  ] as const)("aceita magic bytes válidos de %s", async (mimeType, source) => {
    const database = drizzle(client, { schema: cmsSchema });
    const [actor] = await database
      .insert(cmsMemberships)
      .values({
        tenantId: "tenant-nite",
        objectId: `editor-${mimeType}`,
        displayName: "Editora NITE",
        role: "publisher",
      })
      .returning();
    const store = new MemoryObjectStore();
    const upload = await createMediaUpload(database, store, {
      actor,
      file: { mimeType, byteSize: source.byteLength },
    });
    store.objects.set(`incoming/${upload.mediaId}/original`, source);

    await expect(
      processMediaAsset(database, store, imageProcessor, {
        mediaId: upload.mediaId,
      }),
    ).resolves.toMatchObject({ status: "ready" });
  });

  it("aceita exatamente 10 MB e rejeita excesso ou MIME não permitido", () => {
    expect(
      mediaUploadFileSchema.parse({
        mimeType: "image/png",
        byteSize: 10 * 1024 * 1024,
      }),
    ).toMatchObject({ byteSize: 10 * 1024 * 1024 });
    expect(() =>
      mediaUploadFileSchema.parse({
        mimeType: "image/png",
        byteSize: 10 * 1024 * 1024 + 1,
      }),
    ).toThrow();
    expect(() =>
      mediaUploadFileSchema.parse({
        mimeType: "image/gif",
        byteSize: 1,
      }),
    ).toThrow();
  });

  it("impede tornar ready sem saída pública e alterar chaves após sua definição", async () => {
    await client.query(`
      INSERT INTO media_assets (
        id, staging_object_key, mime_type, byte_size, status
      ) VALUES (
        '30000000-0000-4000-8000-000000000201',
        'incoming/immutable/original',
        'image/png',
        12,
        'pending'
      )
    `);

    await expect(
      client.query(`
        UPDATE media_assets
        SET status = 'ready'
        WHERE id = '30000000-0000-4000-8000-000000000201'
      `),
    ).rejects.toThrow(/media_assets_ready_metadata_check/);
    await client.query(`
      UPDATE media_assets
      SET
        public_object_key = 'news/immutable/processed.webp',
        mime_type = 'image/webp',
        byte_size = 10,
        width = 2,
        height = 2,
        checksum_sha256 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        status = 'ready'
      WHERE id = '30000000-0000-4000-8000-000000000201'
    `);

    await expect(
      client.query(`
        UPDATE media_assets
        SET public_object_key = 'news/immutable/replaced.webp'
        WHERE id = '30000000-0000-4000-8000-000000000201'
      `),
    ).rejects.toThrow(/imutáveis/);
  });
});
