import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const snapshotPath = fileURLToPath(
  new URL("../drizzle/meta/0013_snapshot.json", import.meta.url),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError(`${path} must be an object`);
  }

  return value;
}

describe("Drizzle migration metadata", () => {
  it("records the final editorial video schema in the 0013 snapshot", async () => {
    const snapshot: unknown = JSON.parse(await readFile(snapshotPath, "utf8"));
    const root = requireRecord(snapshot, "snapshot");
    const enums = requireRecord(root.enums, "snapshot.enums");
    const mediaKind = requireRecord(
      enums["public.media_kind"],
      "snapshot.enums.public.media_kind",
    );

    expect(mediaKind).toMatchObject({
      name: "media_kind",
      schema: "public",
      values: ["image", "video", "captions"],
    });

    const tables = requireRecord(root.tables, "snapshot.tables");
    const mediaAssets = requireRecord(
      tables["public.media_assets"],
      "snapshot.tables.public.media_assets",
    );
    const columns = requireRecord(
      mediaAssets.columns,
      "snapshot.tables.public.media_assets.columns",
    );

    expect(columns).toMatchObject({
      media_kind: {
        name: "media_kind",
        type: "media_kind",
        typeSchema: "public",
        notNull: true,
        default: "'image'",
      },
      duration_ms: { name: "duration_ms", type: "integer", notNull: false },
      video_codec: {
        name: "video_codec",
        type: "varchar(32)",
        notNull: false,
      },
      has_audio: { name: "has_audio", type: "boolean", notNull: false },
      object_etag: {
        name: "object_etag",
        type: "varchar(255)",
        notNull: false,
      },
    });

    const checks = requireRecord(
      mediaAssets.checkConstraints,
      "snapshot.tables.public.media_assets.checkConstraints",
    );
    expect(Object.keys(checks)).toEqual(
      expect.arrayContaining([
        "media_assets_duration_check",
        "media_assets_kind_metadata_check",
        "media_assets_ready_metadata_check",
      ]),
    );

    const kindMetadata = requireRecord(
      checks.media_assets_kind_metadata_check,
      "media_assets_kind_metadata_check",
    );
    const readyMetadata = requireRecord(
      checks.media_assets_ready_metadata_check,
      "media_assets_ready_metadata_check",
    );
    expect(kindMetadata.value).toEqual(expect.stringContaining("media_kind"));
    expect(kindMetadata.value).toEqual(expect.stringContaining("video_codec"));
    expect(readyMetadata.value).toEqual(expect.stringContaining("duration_ms"));
    expect(readyMetadata.value).toEqual(expect.stringContaining("object_etag"));
    expect(readyMetadata.value).toEqual(
      expect.stringContaining(
        'media_kind" = \'captions\' and "media_assets"."mime_type" = \'text/vtt\'',
      ),
    );
    expect(readyMetadata.value).toEqual(
      expect.stringContaining(
        'checksum_sha256" is not null and "media_assets"."duration_ms" is not null',
      ),
    );
  });
});
