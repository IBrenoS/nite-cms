import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { sharpImageProcessor } from "./sharp-image-processor";

describe("processador de imagens editorial", () => {
  it("normaliza orientação, remove metadados, limita a 2400 px e produz WebP", async () => {
    const source = await sharp({
      create: {
        width: 3000,
        height: 1000,
        channels: 3,
        background: { r: 24, g: 48, b: 96 },
      },
    })
      .png()
      .withMetadata({ orientation: 6, exif: { IFD0: { Copyright: "NITE" } } })
      .toBuffer();

    const result = await sharpImageProcessor.toWebp(source);
    const metadata = await sharp(result.body).metadata();

    expect(result).toMatchObject({ width: 800, height: 2400 });
    expect(metadata.format).toBe("webp");
    expect(metadata.orientation).toBeUndefined();
    expect(metadata.exif).toBeUndefined();
  });
});
