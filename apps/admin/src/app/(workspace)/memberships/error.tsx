"use client";

import { Button } from "@nite/cms-ui";

export default function MembershipsError({ reset }: { reset: () => void }) {
  return (
    <main className="m-4 grid max-w-xl gap-4 rounded-lg border border-status-error/35 bg-nite-surface p-6 sm:m-6 lg:m-8">
      <h1 className="font-heading text-heading-md font-semibold">
        Não foi possível carregar a equipe e os acessos
      </h1>
      <p className="text-nite-text-secondary">
        Verifique a conexão administrativa e tente novamente.
      </p>
      <Button type="button" onClick={reset} className="justify-self-start">
        Tentar novamente
      </Button>
    </main>
  );
}
