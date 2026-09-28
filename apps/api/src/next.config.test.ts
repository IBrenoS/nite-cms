import path from "node:path";
import { describe, expect, it } from "vitest";

import configuration from "../next.config";

describe("empacotamento da CMS API", () => {
  it("gera um artefato standalone traçado desde a raiz do monorepo", () => {
    const repositoryRoot = path.resolve(process.cwd(), "../..");

    expect(configuration.output).toBe("standalone");
    expect(configuration.outputFileTracingRoot).toBe(repositoryRoot);
  });
});
