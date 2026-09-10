import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { createMediaObjectStore, getPublicMediaUrl } from "./media-storage";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("storage de mídia R2", () => {
  it("envia, lê e exclui objetos nos buckets corretos", async () => {
    const sentCommands: unknown[] = [];
    const presignedCommands: PutObjectCommand[] = [];
    const client = {
      async send(command: unknown) {
        sentCommands.push(command);
        if (command instanceof GetObjectCommand) {
          return {
            Body: {
              transformToByteArray: async () => new Uint8Array([1, 2, 3]),
            },
          };
        }
        return {};
      },
    } as unknown as S3Client;
    const store = createMediaObjectStore({
      configuration: {
        R2_ACCOUNT_ID: "account",
        R2_ACCESS_KEY_ID: "key",
        R2_SECRET_ACCESS_KEY: "secret",
        R2_STAGING_BUCKET: "nite-staging",
        R2_PUBLIC_BUCKET: "nite-public",
      },
      client,
      signUploadUrl: async (command) => {
        presignedCommands.push(command);
        return "https://upload.nite.test/signed";
      },
    });

    await store.createStagingUploadUrl({
      stagingObjectKey: "incoming/asset",
      contentType: "image/png",
      byteSize: 3,
      expiresInSeconds: 300,
    });
    await expect(store.getStagingObject("incoming/asset")).resolves.toEqual(
      new Uint8Array([1, 2, 3]),
    );
    await store.putPublicObject({
      publicObjectKey: "news/asset/processed.webp",
      body: new Uint8Array([4, 5, 6]),
      contentType: "image/webp",
    });
    await store.deleteStagingObject("incoming/asset");
    await store.deletePublicObject("news/asset/processed.webp");

    expect(presignedCommands[0]?.input).toMatchObject({
      Bucket: "nite-staging",
      Key: "incoming/asset",
    });
    expect(sentCommands).toHaveLength(4);
    expect((sentCommands[0] as GetObjectCommand).input).toMatchObject({
      Bucket: "nite-staging",
      Key: "incoming/asset",
    });
    expect((sentCommands[1] as PutObjectCommand).input).toMatchObject({
      Bucket: "nite-public",
      Key: "news/asset/processed.webp",
      CacheControl: "public, max-age=31536000, immutable",
    });
    expect((sentCommands[2] as DeleteObjectCommand).input).toMatchObject({
      Bucket: "nite-staging",
      Key: "incoming/asset",
    });
    expect((sentCommands[3] as DeleteObjectCommand).input).toMatchObject({
      Bucket: "nite-public",
      Key: "news/asset/processed.webp",
    });
  });

  it("resolve a chave pública sobre a mesma URL-base normalizada", () => {
    vi.stubEnv("R2_PUBLIC_BASE_URL", "https://media.nite.test/media");

    expect(getPublicMediaUrl("news/article/cover image.webp")).toBe(
      "https://media.nite.test/media/news/article/cover%20image.webp",
    );
  });

  it("mantém mídia indisponível quando a URL-base não está configurada", () => {
    vi.stubEnv("R2_PUBLIC_BASE_URL", "");

    expect(getPublicMediaUrl("news/article/cover.webp")).toBe(undefined);
  });
});
