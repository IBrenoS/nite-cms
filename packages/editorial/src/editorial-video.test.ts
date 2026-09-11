import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";

import {
  EditorialPublicationError,
  createArticleDraft,
  validateEditorialInputForPublication,
} from "@nite/editorial";
import {
  articleMediaReferences,
  cmsMemberships,
  mediaAssets,
} from "@nite/cms-db";
import * as cmsSchema from "@nite/cms-db";

const migrationsFolder = fileURLToPath(
  new URL("../../db/drizzle", import.meta.url),
);
const coverMediaId = "30000000-0000-4000-8000-000000000401";
const videoMediaIds = [
  "30000000-0000-4000-8000-000000000411",
  "30000000-0000-4000-8000-000000000412",
  "30000000-0000-4000-8000-000000000413",
  "30000000-0000-4000-8000-000000000414",
] as const;
const captionsMediaId = "30000000-0000-4000-8000-000000000421";

function videoNode(
  mediaId: string,
  playbackMode: "autoplay" | "manual",
  captionsId?: string,
) {
  return {
    type: "video" as const,
    attrs: {
      mediaId,
      ...(captionsId ? { captionsMediaId: captionsId } : {}),
      playbackMode,
      layout: "normal" as const,
    },
  };
}

function inputWithVideos(videos: ReturnType<typeof videoNode>[]) {
  return {
    slug: "video-editorial-estruturado",
    title: "Vídeo editorial apresenta novo projeto",
    summary:
      "A equipe do NITE apresenta os detalhes do projeto em um vídeo editorial estruturado e acessível.",
    category: "inovacao" as const,
    byline: "Redação NITE",
    coverMediaId,
    coverAlt: "Equipe do NITE reunida para apresentar o novo projeto.",
    featured: false,
    body: {
      schemaVersion: 3 as const,
      type: "doc" as const,
      content: videos,
    },
  };
}

describe("vídeo no ciclo editorial", () => {
  let client: PGlite;

  beforeEach(async () => {
    client = new PGlite();
    await migrate(drizzle(client), { migrationsFolder });
  });

  afterEach(async () => {
    await client.close();
  });

  async function seedActorAndCover() {
    const database = drizzle(client, { schema: cmsSchema });
    const [actor] = await database
      .insert(cmsMemberships)
      .values({
        tenantId: "tenant-video",
        objectId: "publisher-video",
        displayName: "Publisher Vídeo",
        role: "publisher",
      })
      .returning();
    await database.insert(mediaAssets).values({
      id: coverMediaId,
      mediaKind: "image",
      stagingObjectKey: "incoming/video-cover/original",
      publicObjectKey: "news/video-cover.webp",
      mimeType: "image/webp",
      byteSize: 4096,
      width: 1200,
      height: 675,
      checksumSha256:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      status: "ready",
    });
    return { database, actor };
  }

  async function insertVideo(
    database: ReturnType<typeof drizzle<typeof cmsSchema>>,
    input: {
      id: string;
      status?: "pending" | "ready";
      durationMs?: number;
      hasAudio?: boolean;
    },
  ) {
    const status = input.status ?? "ready";
    await database.insert(mediaAssets).values({
      id: input.id,
      mediaKind: "video",
      stagingObjectKey: `incoming/${input.id}/original`,
      ...(status === "ready"
        ? {
            publicObjectKey: `news/${input.id}/video.mp4`,
            width: 1920,
            height: 1080,
            durationMs: input.durationMs ?? 30_000,
            videoCodec: "avc1.640028",
            hasAudio: input.hasAudio ?? false,
            objectEtag: `etag-${input.id}`,
          }
        : {}),
      mimeType: "video/mp4",
      byteSize: 8192,
      status,
    });
  }

  it("salva rascunho com vídeo pendente e registra vídeo e legenda para retenção", async () => {
    const { database, actor } = await seedActorAndCover();
    await insertVideo(database, {
      id: videoMediaIds[0],
      status: "pending",
    });
    await database.insert(mediaAssets).values({
      id: captionsMediaId,
      mediaKind: "captions",
      stagingObjectKey: "incoming/captions/pending.vtt",
      mimeType: "text/vtt",
      byteSize: 128,
      status: "pending",
    });

    const created = await createArticleDraft(database, {
      actor,
      input: inputWithVideos([
        videoNode(videoMediaIds[0], "manual", captionsMediaId),
      ]),
    });

    await expect(
      database
        .select({ mediaId: articleMediaReferences.mediaId })
        .from(articleMediaReferences)
        .where(eq(articleMediaReferences.articleId, created.article.id)),
    ).resolves.toEqual(
      expect.arrayContaining([
        { mediaId: coverMediaId },
        { mediaId: videoMediaIds[0] },
        { mediaId: captionsMediaId },
      ]),
    );
  });

  it("rejeita publicação quando o vídeo tem tipo incompatível", async () => {
    const { database, actor } = await seedActorAndCover();
    await database.insert(mediaAssets).values({
      id: videoMediaIds[0],
      mediaKind: "image",
      stagingObjectKey: "incoming/wrong-video/original",
      publicObjectKey: "news/wrong-video.webp",
      mimeType: "image/webp",
      byteSize: 2048,
      width: 800,
      height: 450,
      checksumSha256:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      status: "ready",
    });

    await expect(
      validateEditorialInputForPublication(database, {
        actor,
        input: inputWithVideos([videoNode(videoMediaIds[0], "autoplay")]),
      }),
    ).rejects.toBeInstanceOf(EditorialPublicationError);
  });

  it("rejeita publicação quando captionsMediaId não aponta para legenda", async () => {
    const { database, actor } = await seedActorAndCover();
    await insertVideo(database, {
      id: videoMediaIds[0],
      hasAudio: true,
    });

    await expect(
      validateEditorialInputForPublication(database, {
        actor,
        input: inputWithVideos([
          videoNode(videoMediaIds[0], "manual", coverMediaId),
        ]),
      }),
    ).rejects.toThrow(/legenda.*tipo de mídia incompatível/i);
  });

  it("exige legenda pronta para vídeo manual com áudio", async () => {
    const { database, actor } = await seedActorAndCover();
    await insertVideo(database, {
      id: videoMediaIds[0],
      hasAudio: true,
    });

    await expect(
      validateEditorialInputForPublication(database, {
        actor,
        input: inputWithVideos([videoNode(videoMediaIds[0], "manual")]),
      }),
    ).rejects.toThrow(/legenda.*vídeo manual.*áudio/i);
  });

  it("rejeita legenda cujo último cue ultrapassa a duração do vídeo", async () => {
    const { database, actor } = await seedActorAndCover();
    await insertVideo(database, {
      id: videoMediaIds[0],
      durationMs: 30_000,
      hasAudio: true,
    });
    await database.insert(mediaAssets).values({
      id: captionsMediaId,
      mediaKind: "captions",
      stagingObjectKey: "incoming/captions/ready.vtt",
      publicObjectKey: "news/captions/ready.vtt",
      mimeType: "text/vtt",
      byteSize: 128,
      durationMs: 30_001,
      checksumSha256:
        "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      status: "ready",
    });

    await expect(
      validateEditorialInputForPublication(database, {
        actor,
        input: inputWithVideos([
          videoNode(videoMediaIds[0], "manual", captionsMediaId),
        ]),
      }),
    ).rejects.toThrow(/legenda.*duração do vídeo/i);
  });

  it("limita autoplay a três blocos e sessenta segundos por vídeo", async () => {
    const { database, actor } = await seedActorAndCover();
    for (const [index, mediaId] of videoMediaIds.entries()) {
      await insertVideo(database, {
        id: mediaId,
        durationMs: index === 0 ? 60_001 : 30_000,
      });
    }

    await expect(
      validateEditorialInputForPublication(database, {
        actor,
        input: inputWithVideos([videoNode(videoMediaIds[0], "autoplay")]),
      }),
    ).rejects.toThrow(/autoplay.*60 segundos/i);

    await expect(
      validateEditorialInputForPublication(database, {
        actor,
        input: inputWithVideos(
          videoMediaIds.map((mediaId) => videoNode(mediaId, "autoplay")),
        ),
      }),
    ).rejects.toThrow(/no máximo 3.*autoplay/i);
  });
});
