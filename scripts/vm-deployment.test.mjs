import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

const repositoryRoot = path.resolve(import.meta.dirname, "..");

function readRepositoryFile(filePath) {
  return readFileSync(path.join(repositoryRoot, filePath), "utf8");
}

function readComposeConfiguration() {
  const fixtureDirectory = mkdtempSync(
    path.join(tmpdir(), "nite-cms-compose-"),
  );
  const fixtures = {
    CMS_ADMIN_ENV_FILE: path.join(fixtureDirectory, "admin.env"),
    CMS_API_ENV_FILE: path.join(fixtureDirectory, "api.env"),
    CMS_SCHEDULER_ENV_FILE: path.join(fixtureDirectory, "scheduler.env"),
    CMS_MIGRATION_ENV_FILE: path.join(fixtureDirectory, "migration.env"),
  };

  try {
    writeFileSync(
      fixtures.CMS_ADMIN_ENV_FILE,
      [
        "DATABASE_ADMIN_URL=postgresql://example.invalid/cms",
        `BETTER_AUTH_SECRET=${"a".repeat(32)}`,
        "BETTER_AUTH_URL=http://admin.localhost",
        "MICROSOFT_CLIENT_ID=example",
        "MICROSOFT_CLIENT_SECRET=example",
        "MICROSOFT_TENANT_ID=10000000-0000-4000-8000-000000000001",
      ].join("\n"),
    );
    writeFileSync(
      fixtures.CMS_API_ENV_FILE,
      "DATABASE_PUBLIC_URL=postgresql://example.invalid/cms\n",
    );
    writeFileSync(
      fixtures.CMS_SCHEDULER_ENV_FILE,
      [`CRON_SECRET=${"s".repeat(32)}`, "OUTBOX_INTERVAL_MS=1200000"].join(
        "\n",
      ),
    );
    writeFileSync(
      fixtures.CMS_MIGRATION_ENV_FILE,
      "DATABASE_MIGRATION_URL=postgresql://example.invalid/cms\n",
    );

    const output = execFileSync(
      "docker",
      [
        "compose",
        "--env-file",
        "deploy/vm/stack.env.example",
        "-f",
        "compose.production.yml",
        "--profile",
        "operations",
        "config",
        "--format",
        "json",
      ],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: { ...process.env, ...fixtures },
      },
    );

    return JSON.parse(output);
  } finally {
    rmSync(fixtureDirectory, { recursive: true, force: true });
  }
}

describe("deploy de produção em VM", () => {
  it("define imagens separadas, Node 22 e runtimes não-root", () => {
    const dockerfile = readRepositoryFile("Dockerfile");

    assert.match(dockerfile, /FROM node:22-bookworm-slim AS dependencies/);
    for (const target of ["admin", "api", "scheduler", "migration"]) {
      assert.match(dockerfile, new RegExp(` AS ${target}(?:\\s|$)`));
    }
    assert.match(dockerfile, /USER node/);
    assert.match(dockerfile, /CMD \["node", "apps\/admin\/server\.js"\]/);
    assert.match(dockerfile, /CMD \["node", "apps\/api\/server\.js"\]/);
  });

  it("expõe somente Caddy e mantém migration em profile manual", () => {
    const configuration = readComposeConfiguration();
    const services = configuration.services;

    assert.deepEqual(Object.keys(services).sort(), [
      "admin",
      "api",
      "caddy",
      "migration",
      "outbox-scheduler",
    ]);
    assert.ok(services.caddy.ports.some(({ target }) => target === 80));
    assert.ok(services.caddy.ports.some(({ target }) => target === 443));
    assert.equal(services.admin.ports, undefined);
    assert.equal(services.api.ports, undefined);
    assert.deepEqual(services.migration.profiles, ["operations"]);
    assert.equal(services.migration.restart, "no");
    assert.equal(
      services["outbox-scheduler"].environment.OUTBOX_INTERVAL_MS,
      "1200000",
    );
    assert.equal(
      services.admin.healthcheck.test.at(-1).includes("/api/health"),
      true,
    );
    assert.equal(
      services.api.healthcheck.test.at(-1).includes("/health"),
      true,
    );
  });

  it("aplica hardening, rotação de logs e limites ajustáveis", () => {
    const services = readComposeConfiguration().services;

    for (const serviceName of ["caddy", "admin", "api", "outbox-scheduler"]) {
      const service = services[serviceName];
      assert.equal(service.restart, "unless-stopped");
      assert.equal(service.read_only, true);
      assert.ok(
        service.security_opt.some((option) =>
          /^no-new-privileges(?:=|:)true$/.test(option),
        ),
      );
      assert.deepEqual(service.logging.options, {
        "max-file": "5",
        "max-size": "10m",
      });
    }

    assert.equal(services.admin.mem_limit, "1610612736");
    assert.equal(services.admin.cpus, 1.5);
    assert.equal(services.api.mem_limit, "536870912");
    assert.equal(services.api.cpus, 0.75);
    assert.equal(services.caddy.mem_limit, "268435456");
    assert.equal(services.caddy.cpus, 0.5);
    assert.equal(services["outbox-scheduler"].mem_limit, "134217728");
    assert.equal(services["outbox-scheduler"].cpus, 0.25);
  });

  it("configura HTTPS, compressão, HSTS, proxy e logs JSON no Caddy", () => {
    const caddyfile = readRepositoryFile("deploy/vm/Caddyfile");

    assert.match(caddyfile, /\{\$CMS_ADMIN_DOMAIN\}/);
    assert.match(caddyfile, /\{\$CMS_API_DOMAIN\}/);
    assert.match(caddyfile, /encode zstd gzip/);
    assert.match(caddyfile, /Strict-Transport-Security/);
    assert.match(caddyfile, /reverse_proxy admin:3001/);
    assert.match(caddyfile, /reverse_proxy api:3002/);
    assert.match(caddyfile, /format json/);
  });

  it("mantém exemplos sem credenciais preenchidas e ignora arquivos reais", () => {
    const gitignore = readRepositoryFile(".gitignore");
    const exampleFiles = [
      "deploy/vm/admin.env.example",
      "deploy/vm/api.env.example",
      "deploy/vm/scheduler.env.example",
      "deploy/vm/migration.env.example",
    ];

    assert.match(gitignore, /deploy\/vm\/\*\.env/);
    assert.match(gitignore, /!deploy\/vm\/\*\.env\.example/);

    for (const exampleFile of exampleFiles) {
      const contents = readRepositoryFile(exampleFile);
      for (const line of contents.split(/\r?\n/)) {
        if (/^[A-Z][A-Z0-9_]*(?:SECRET|URL|KEY|ID)=/.test(line)) {
          assert.match(line, /^[A-Z][A-Z0-9_]*=$/);
        }
      }
    }
  });
});
