import {
  GetObjectCommand,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import * as mediaStorage from "./media-storage";

type StagedMediaStore = {
  createStagingUploadUrl(input: {
    stagingObjectKey: string;
    contentType: string;
    byteSize: number;
    expiresInSeconds: number;
  }): Promise<unknown>;
  getStagingObject(stagingObjectKey: string): Promise<Uint8Array>;
  putPublicObject(input: {
    publicObjectKey: string;
    body: Uint8Array;
    contentType: "image/webp";
  }): Promise<void>;
};

type StoreFactory = (input: {
  configuration: {
    R2_ACCOUNT_ID: string;
    R2_ACCESS_KEY_ID: string;
    R2_SECRET_ACCESS_KEY: string;
    R2_STAGING_BUCKET: string;
    R2_PUBLIC_BUCKET: string;
  };
  client: S3Client;
  signUploadUrl: (command: PutObjectCommand) => Promise<string>;
}) => StagedMediaStore;

function factory(): StoreFactory {
  const candidate: unknown = Reflect.get(
    mediaStorage,
    "createMediaObjectStore",
  );
  expect(candidate, "fábrica de storage com dois buckets").toBeTypeOf(
    "function",
  );
  if (typeof candidate !== "function") {
    throw new Error("createMediaObjectStore ausente");
  }
  return candidate as StoreFactory;
}

describe("storage de mídia R2", () => {
  it("envia e lê somente no staging, mas publica somente no bucket público sem deleção", async () => {
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
    const store = factory()({
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

    expect(presignedCommands[0]?.input).toMatchObject({
      Bucket: "nite-staging",
      Key: "incoming/asset",
    });
    expect(sentCommands).toHaveLength(2);
    expect((sentCommands[0] as GetObjectCommand).input).toMatchObject({
      Bucket: "nite-staging",
      Key: "incoming/asset",
    });
    expect((sentCommands[1] as PutObjectCommand).input).toMatchObject({
      Bucket: "nite-public",
      Key: "news/asset/processed.webp",
      CacheControl: "public, max-age=31536000, immutable",
    });
    expect("deleteObject" in store).toBe(false);
  });
});
