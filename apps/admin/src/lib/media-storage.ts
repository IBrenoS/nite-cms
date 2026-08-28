import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";

import type { MediaObjectStore } from "@nite/content/admin";
export { sharpImageProcessor } from "./sharp-image-processor";

const storageConfigurationSchema = z.object({
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
});

let objectStore: MediaObjectStore | undefined;

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

  objectStore = {
    async createUploadUrl(input) {
      const command = new PutObjectCommand({
        Bucket: configuration.R2_BUCKET,
        Key: input.objectKey,
        ContentType: input.contentType,
        ContentLength: input.byteSize,
      });
      return {
        url: await getSignedUrl(client, command, {
          expiresIn: input.expiresInSeconds,
        }),
        requiredHeaders: { "Content-Type": input.contentType },
        expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000),
      };
    },
    async getObject(objectKey) {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: configuration.R2_BUCKET,
          Key: objectKey,
        }),
      );
      if (!response.Body) throw new Error("Objeto sem conteúdo.");
      return response.Body.transformToByteArray();
    },
    async putObject(input) {
      await client.send(
        new PutObjectCommand({
          Bucket: configuration.R2_BUCKET,
          Key: input.objectKey,
          Body: input.body,
          ContentType: input.contentType,
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
    },
    async deleteObject(objectKey) {
      await client.send(
        new DeleteObjectCommand({
          Bucket: configuration.R2_BUCKET,
          Key: objectKey,
        }),
      );
    },
  };

  return objectStore;
}

export function getPublicMediaUrl(objectKey: string | null | undefined) {
  if (!objectKey) return undefined;
  const result = z.url().safeParse(process.env.R2_PUBLIC_BASE_URL);
  if (!result.success) return undefined;
  const baseUrl = result.data.endsWith("/") ? result.data : `${result.data}/`;
  return new URL(
    objectKey.split("/").map(encodeURIComponent).join("/"),
    baseUrl,
  ).toString();
}
