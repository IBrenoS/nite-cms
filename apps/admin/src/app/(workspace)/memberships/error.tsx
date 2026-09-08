"use client";

import { Button } from "@nite/cms-ui";

export default function MembershipsError({ reset }: { reset: () => void }) {
  return (
    <main className="grid max-w-xl gap-4 rounded-xl border border-status-error/35 p-6">
      <h1 className="font-heading text-2xl font-semibold">
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
