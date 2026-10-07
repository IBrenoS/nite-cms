import { cookies } from "next/headers";
import { Chip } from "@nite/cms-ui";

import { getDatabase } from "@nite/cms-db/database";
import { readAdminConfiguration } from "@/lib/auth-config";
import { readEmailConfiguration } from "@/lib/email-config";
import {
  decodeInvitationAcceptanceCookie,
  INVITATION_ACCEPTANCE_COOKIE,
  validateInvitationAcceptance,
} from "@/lib/invitation-acceptance";
import { AcceptInvitationButton } from "./accept-button";

function InvitationShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5 py-12">
      <section className="grid w-full max-w-xl gap-7 rounded-xl border border-border-subtle bg-surface p-7 sm:p-10">
        <Chip>CMS NITE / Convite</Chip>
        {children}
      </section>
    </main>
  );
}

function InvalidInvitation() {
  return (
    <InvitationShell>
      <div className="grid gap-3">
        <h1 className="font-heading text-heading-lg font-semibold tracking-tight">
          Convite indisponível
        </h1>
        <p className="leading-7 text-nite-text-secondary">
          Este convite não está disponível. Solicite um novo convite à pessoa
          responsável pela equipe.
        </p>
      </div>
    </InvitationShell>
  );
}

export default async function InvitationAcceptPage() {
  const cookieStore = await cookies();
  const reference = decodeInvitationAcceptanceCookie(
    cookieStore.get(INVITATION_ACCEPTANCE_COOKIE)?.value,
  );
  const adminConfiguration = readAdminConfiguration(process.env);
  const emailConfiguration = readEmailConfiguration(process.env);
  if (
    !reference ||
    !adminConfiguration.configured ||
    !emailConfiguration.configured
  ) {
    return <InvalidInvitation />;
  }

  const validation = await validateInvitationAcceptance(
    getDatabase(adminConfiguration.configuration),
    reference,
    emailConfiguration.configuration.invitationLinkSecret,
  );
  if (validation.status !== "valid") return <InvalidInvitation />;

  const expiresAt = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Bahia",
  }).format(validation.invitation.expiresAt);

  return (
    <InvitationShell>
      <div className="grid gap-4">
        <h1 className="font-heading text-heading-lg font-semibold tracking-tight">
          Convite para integrar a equipe do CMS NITE
        </h1>
        <p className="leading-7 text-nite-text-secondary">
          Você recebeu um convite de {validation.invitation.inviterDisplayName}{" "}
          para integrar a equipe responsável pelo CMS NITE.
        </p>
        <p className="leading-7 text-nite-text-secondary">
          Confirme sua participação até {expiresAt}. Em seguida, autentique-se
          com o mesmo endereço institucional que recebeu o convite.
        </p>
      </div>
      <AcceptInvitationButton />
    </InvitationShell>
  );
}
