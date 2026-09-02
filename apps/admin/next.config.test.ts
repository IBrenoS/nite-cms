import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("configuração de imagens do Admin", () => {
  it("autoriza objetos abaixo da URL-base pública sem liberar outro host", async () => {
    vi.stubEnv("R2_PUBLIC_BASE_URL", "https://media.nite.test/");
    vi.resetModules();

    const { default: configuration } = await import("./next.config");

    expect(configuration.images?.remotePatterns).toEqual([
      {
        protocol: "https",
        hostname: "media.nite.test",
        port: "",
        pathname: "/**",
        search: "",
      },
    ]);
  });
});
