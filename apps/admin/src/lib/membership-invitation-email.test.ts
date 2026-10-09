import { describe, expect, it } from "vitest";

import { buildMembershipInvitationEmail } from "./membership-invitation-email";

describe("mensagem de convite à Redação Digital", () => {
  it("gera o texto formal aprovado sem revelar nível de acesso", () => {
    const message = buildMembershipInvitationEmail({
      inviterDisplayName: "Breno NITE",
      expiresAt: new Date("2026-10-09T12:00:00.000Z"),
      acceptUrl:
        "https://cms.nite.test/invitations/accept/start?id=convite&signature=assinatura",
    });

    expect(message.subject).toBe(
      "Convite para integrar a Redação Digital do NITE",
    );
    expect(message.text).toBe(`Olá,

Você recebeu um convite de Breno NITE para integrar a equipe da Redação Digital do NITE.

Para confirmar sua participação, aceite o convite até 9 de outubro de 2026 às 09:00 (horário de Salvador):

Aceitar convite:
https://cms.nite.test/invitations/accept/start?id=convite&signature=assinatura

Após a confirmação, você será direcionado à autenticação institucional.
Entre utilizando este mesmo endereço de e-mail para concluir seu acesso.

Se você não reconhece este convite, nenhuma ação é necessária.

Atenciosamente,
Redação Digital do NITE`);

    expect(`${message.subject}\n${message.text}`.toLowerCase()).not.toMatch(
      /\b(admin|publisher|administrativo|editorial)\b/u,
    );
    expect(message).not.toHaveProperty("html");
  });
});
