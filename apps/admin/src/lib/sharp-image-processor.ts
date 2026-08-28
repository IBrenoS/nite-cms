import sharp from "sharp";

import type { ImageProcessor } from "@nite/content/admin";

export const sharpImageProcessor: ImageProcessor = {
  async toWebp(input) {
    const result = await sharp(input, {
      failOn: "warning",
      limitInputPixels: 40_000_000,
    })
      .rotate()
      .resize({
        width: 2000,
        height: 2000,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    if (!result.info.width || !result.info.height) {
      throw new Error("Dimensões da imagem não identificadas.");
    }
    return {
      body: result.data,
      width: result.info.width,
      height: result.info.height,
    };
  },
};
