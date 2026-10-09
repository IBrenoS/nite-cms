import { describe, expect, it } from "vitest";

import { readEmailConfiguration } from "./email-config";

const configuredEnvironment = {
  RESEND_API_KEY: "re_test_key",
  RESEND_WEBHOOK_SECRET: "whsec_test_secret",
  RESEND_FROM_EMAIL: "Redação Digital do NITE <acesso@notify.nite.tec.br>",
  CMS_PUBLIC_URL: "https://cms.nite.test",
  INVITATION_LINK_SECRET: "convite-secreto-com-pelo-menos-32-bytes",
};

describe("configuração de e-mail transacional", () => {
  it("classifica todas as variáveis ausentes sem revelar valores", () => {
    expect(readEmailConfiguration({})).toEqual({
      configured: false,
      issues: [
        { field: "RESEND_API_KEY", reason: "missing" },
        { field: "RESEND_WEBHOOK_SECRET", reason: "missing" },
        { field: "RESEND_FROM_EMAIL", reason: "missing" },
        { field: "CMS_PUBLIC_URL", reason: "missing" },
        { field: "INVITATION_LINK_SECRET", reason: "missing" },
      ],
    });
  });

  it("retorna somente a configuração completa validada", () => {
    expect(readEmailConfiguration(configuredEnvironment)).toEqual({
      configured: true,
      configuration: {
        apiKey: configuredEnvironment.RESEND_API_KEY,
        webhookSecret: configuredEnvironment.RESEND_WEBHOOK_SECRET,
        fromEmail: configuredEnvironment.RESEND_FROM_EMAIL,
        publicUrl: configuredEnvironment.CMS_PUBLIC_URL,
        invitationLinkSecret: configuredEnvironment.INVITATION_LINK_SECRET,
      },
    });
  });

  it("mantém compatibilidade com o remetente configurado antes da renomeação", () => {
    expect(
      readEmailConfiguration({
        ...configuredEnvironment,
        RESEND_FROM_EMAIL: "CMS NITE <acesso@notify.nite.tec.br>",
      }),
    ).toMatchObject({ configured: true });
  });

  it.each([
    "http://cms.nite.test",
    "https://usuario:senha@cms.nite.test",
    "https://cms.nite.test/caminho",
  ])("rejeita origem pública insegura ou não canônica: %s", (publicUrl) => {
    const result = readEmailConfiguration({
      ...configuredEnvironment,
      CMS_PUBLIC_URL: publicUrl,
    });
    expect(result).toEqual({
      configured: false,
      issues: [{ field: "CMS_PUBLIC_URL", reason: "invalid" }],
    });
    expect(JSON.stringify(result)).not.toContain(publicUrl);
  });

  it("aceita HTTP apenas para desenvolvimento em localhost", () => {
    expect(
      readEmailConfiguration({
        ...configuredEnvironment,
        CMS_PUBLIC_URL: "http://localhost:3001",
      }),
    ).toMatchObject({
      configured: true,
      configuration: { publicUrl: "http://localhost:3001" },
    });
  });

  it("rejeita secret curto e remetente diferente sem expor os valores", () => {
    const environment = {
      ...configuredEnvironment,
      RESEND_FROM_EMAIL: "Outro <outro@example.com>",
      INVITATION_LINK_SECRET: "segredo-curto",
    };
    const result = readEmailConfiguration(environment);

    expect(result).toEqual({
      configured: false,
      issues: [
        { field: "RESEND_FROM_EMAIL", reason: "invalid" },
        { field: "INVITATION_LINK_SECRET", reason: "invalid" },
      ],
    });
    expect(JSON.stringify(result)).not.toContain(environment.RESEND_FROM_EMAIL);
    expect(JSON.stringify(result)).not.toContain(
      environment.INVITATION_LINK_SECRET,
    );
  });
});
