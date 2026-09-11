import "server-only";

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";

import type { MediaObjectStore } from "@nite/editorial";
import { readPublicMediaConfiguration } from "./public-media-config";
export { sharpImageProcessor } from "./sharp-image-processor";

const storageConfigurationSchema = z.object({
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_STAGING_BUCKET: z.string().min(1),
  R2_PUBLIC_BUCKET: z.string().min(1),
});

type StorageConfiguration = z.infer<typeof storageConfigurationSchema>;
type UploadUrlSigner = (
  command: PutObjectCommand,
  expiresInSeconds: number,
) => Promise<string>;

let objectStore: MediaObjectStore | undefined;

export function createMediaObjectStore(input: {
  configuration: StorageConfiguration;
  client: S3Client;
  signUploadUrl: UploadUrlSigner;
}): MediaObjectStore {
  const { configuration, client, signUploadUrl } = input;
  return {
    async createStagingUploadUrl(upload) {
      const command = new PutObjectCommand({
        Bucket: configuration.R2_STAGING_BUCKET,
        Key: upload.stagingObjectKey,
        ContentType: upload.contentType,
        ContentLength: upload.byteSize,
      });
      return {
        url: await signUploadUrl(command, upload.expiresInSeconds),
        requiredHeaders: { "Content-Type": upload.contentType },
        expiresAt: new Date(Date.now() + upload.expiresInSeconds * 1000),
      };
    },
    async getStagingObject(stagingObjectKey) {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: configuration.R2_STAGING_BUCKET,
          Key: stagingObjectKey,
        }),
      );
      if (!response.Body) throw new Error("Objeto sem conteúdo.");
      return response.Body.transformToByteArray();
    },
    async headStagingObject(stagingObjectKey) {
      const response = await client.send(
        new HeadObjectCommand({
          Bucket: configuration.R2_STAGING_BUCKET,
          Key: stagingObjectKey,
        }),
      );
      return {
        byteSize: response.ContentLength,
        contentType: response.ContentType,
        etag: response.ETag,
      };
    },
    async getStagingObjectRange(stagingObjectKey, start, end) {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: configuration.R2_STAGING_BUCKET,
          Key: stagingObjectKey,
          Range: `bytes=${start}-${end}`,
        }),
      );
      if (!response.Body) throw new Error("Objeto sem conteúdo.");
      return response.Body.transformToByteArray();
    },
    async copyStagingObjectToPublic(output) {
      const encodedSourceKey = output.stagingObjectKey
        .split("/")
        .map(encodeURIComponent)
        .join("/");
      await client.send(
        new CopyObjectCommand({
          Bucket: configuration.R2_PUBLIC_BUCKET,
          Key: output.publicObjectKey,
          CopySource: `${configuration.R2_STAGING_BUCKET}/${encodedSourceKey}`,
          CopySourceIfMatch: output.sourceEtag,
          ContentType: output.contentType,
          CacheControl: output.cacheControl,
          MetadataDirective: "REPLACE",
        }),
      );
    },
    async putPublicObject(output) {
      await client.send(
        new PutObjectCommand({
          Bucket: configuration.R2_PUBLIC_BUCKET,
          Key: output.publicObjectKey,
          Body: output.body,
          ContentType: output.contentType,
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
    },
    async deleteStagingObject(stagingObjectKey) {
      await client.send(
        new DeleteObjectCommand({
          Bucket: configuration.R2_STAGING_BUCKET,
          Key: stagingObjectKey,
        }),
      );
    },
    async deletePublicObject(publicObjectKey) {
      await client.send(
        new DeleteObjectCommand({
          Bucket: configuration.R2_PUBLIC_BUCKET,
          Key: publicObjectKey,
        }),
      );
    },
  };
}

export function getMediaObjectStore(): MediaObjectStore {
  if (objectStore) return objectStore;
  const configuration = storageConfigurationSchema.parse(process.env);
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${configuration.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: configuration.R2_ACCESS_KEY_ID,
      secretAccessKey: configuration.R2_SECRET_ACCESS_KEY,
    },
  });

  objectStore = createMediaObjectStore({
    configuration,
    client,
    signUploadUrl: (command, expiresInSeconds) =>
      getSignedUrl(client, command, { expiresIn: expiresInSeconds }),
  });

  return objectStore;
}

export function getPublicMediaUrl(objectKey: string | null | undefined) {
  if (!objectKey) return undefined;
  const publicMedia = readPublicMediaConfiguration(process.env);
  if (!publicMedia.configured) return undefined;
  return new URL(
    objectKey.split("/").map(encodeURIComponent).join("/"),
    publicMedia.baseUrl,
  ).toString();
}
