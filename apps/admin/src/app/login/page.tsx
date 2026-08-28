import { redirect } from "next/navigation";
import { Chip } from "@nite/ui";

import { getCmsContext } from "@/lib/auth";
import { SignInButton } from "./sign-in-button";

export default async function LoginPage() {
  const context = await getCmsContext();
  if (context.status === "authenticated") redirect("/");

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-5 py-12">
      <div
        aria-hidden="true"
        className="admin-grid absolute inset-0 opacity-30"
      />
      <section className="nite-panel relative z-10 grid w-full max-w-lg gap-7 rounded-2xl border border-nite-border-subtle p-7 sm:p-10">
        <div className="grid gap-4">
          <Chip>NITE / Operação editorial</Chip>
          <h1 className="font-heading text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            CMS NITE
          </h1>
          <p className="max-w-md leading-7 text-nite-text-secondary">
            Ambiente separado do portal público para criar, revisar e publicar
            matérias institucionais.
          </p>
        </div>

        {context.status === "unconfigured" ? (
          <div className="grid gap-3 rounded-xl border border-status-warning/40 bg-status-warning/10 p-4">
            <p className="font-semibold text-status-warning">
              Configuração pendente
            </p>
            <p className="text-sm leading-6 text-nite-text-secondary">
              Defina no ambiente de execução: {context.missing.join(", ")}.
              Nenhum valor sensível é exibido nesta tela.
            </p>
          </div>
        ) : context.status === "forbidden" ? (
          <p role="alert" className="text-sm leading-6 text-status-error">
            Sua conta Microsoft foi autenticada, mas não possui uma membership
            editorial ativa.
          </p>
        ) : (
          <SignInButton />
        )}
      </section>
    </main>
  );
}
