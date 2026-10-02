export type MembershipInvitationEmailInput = {
  inviterDisplayName: string;
  expiresAt: Date;
  acceptUrl: string;
};

export type PlainTextEmail = {
  subject: string;
  text: string;
};

export function buildMembershipInvitationEmail(
  input: MembershipInvitationEmailInput,
): PlainTextEmail {
  const inviterDisplayName = input.inviterDisplayName.trim();
  const acceptUrl = new URL(input.acceptUrl);
  if (
    !inviterDisplayName ||
    /[\r\n]/u.test(inviterDisplayName) ||
    Number.isNaN(input.expiresAt.getTime()) ||
    (acceptUrl.protocol !== "https:" && acceptUrl.hostname !== "localhost") ||
    acceptUrl.username ||
    acceptUrl.password
  ) {
    throw new TypeError("Dados do convite inválidos para envio.");
  }

  const expiresAt = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Bahia",
  }).format(input.expiresAt);

  return {
    subject: "Convite para integrar a equipe do CMS NITE",
    text: `Olá,

Você recebeu um convite de Breno Cerqueira para integrar a equipe responsável pelo CMS NITE.

Para confirmar sua participação, aceite o convite até ${expiresAt} (horário de Salvador):

Aceitar convite:
${acceptUrl.href}

Após a confirmação, você será direcionado à autenticação institucional.
Entre utilizando este mesmo endereço de e-mail para concluir seu acesso.

Se você não reconhece este convite, nenhuma ação é necessária.

Atenciosamente,
CMS NITE`,
  };
}
