# CMS NITE — instruções para agentes

## Contexto

- Monorepo independente com npm workspaces e Turbo; execute comandos a partir da raiz.
- `apps/admin`: autenticação Better Auth/Entra, comandos editoriais, preview, mídia e outbox.
- `apps/api`: API pública read-only versionada em `/v2`.
- `packages/editorial`: regras e validações do domínio.
- `packages/db`: schema Drizzle, conexão e migrations PostgreSQL.
- `packages/cms-ui`: componentes exclusivos do painel.

Antes de alterar, leia a implementação, os tipos, os testes e a documentação relacionados. Preserve mudanças existentes que não pertençam à tarefa e investigue a causa raiz antes de corrigir um problema.

## Arquitetura e implementação

- O Portal NITE é um sistema externo; consuma notícias pela API pública HTTPS e integre o preview privado por HTTPS com tokens HMAC. Não use imports, paths, banco, migrations ou credenciais compartilhadas. Não há webhook de revalidação editorial.
- Entre workspaces, use apenas exports públicos dos packages; não importe arquivos físicos. `packages/db` não depende de `packages/editorial`: JSONB permanece `unknown` na persistência e é validado no domínio.
- `apps/admin` concentra autenticação e escrita, usando `DATABASE_ADMIN_URL`. `apps/api` usa `DATABASE_PUBLIC_URL` e acessa somente o read model público. Migrations usam exclusivamente `DATABASE_MIGRATION_URL`.
- Faça a menor alteração que resolva integralmente o problema. Reutilize padrões existentes e evite refatorações, abstrações ou dependências sem necessidade comprovada.
- Preserve TypeScript estrito. Não use `any`, casts inseguros ou supressões de lint para contornar erros.
- Mudanças em contratos públicos, schema, migrations, autenticação, RBAC ou integrações externas exigem análise de impacto, compatibilidade e testes dos consumidores afetados.
- Atualize specs e runbooks quando uma decisão ou procedimento documentado deixar de ser verdadeiro.

## Validação progressiva

Use a menor verificação capaz de detectar regressões no escopo atual e amplie conforme o impacto:

1. Durante a implementação, execute primeiro o teste diretamente relacionado: `npm run test --workspace=<workspace> -- <arquivo.test.ts>`.
2. Se a mudança afetar vários arquivos do mesmo workspace, execute os testes, lint e typecheck desse workspace.
3. Se cruzar workspaces ou alterar contratos, schema, configuração compartilhada ou dependências, valide também os consumidores e integrações afetados.
4. Para alterações de código, execute `npm run check` uma única vez sobre o estado final, depois de agrupar as correções. Repita-o somente se uma mudança posterior puder invalidar o resultado; não refaça a bateria completa após alterações sem relação com o que ela valida.
5. Alterações apenas em documentação ou instruções não exigem testes, build ou E2E da aplicação. Valide somente formatação, referências e `git diff --check`.
6. Execute testes PostgreSQL reais ou Playwright apenas quando o comportamento correspondente for afetado e o ambiente estiver configurado.

Ao concluir, informe quais verificações foram executadas após a alteração final, quais resultados anteriores continuam válidos e quais verificações não foram executadas ou ficaram pendentes, com o motivo.

## Segurança operacional

- Nunca registre secrets nem altere arquivos `.env` ou credenciais sem autorização.
- Não execute migrations, deploy, ações de produção ou operações destrutivas sem autorização explícita. Migrations autorizadas partem da raiz com `npm run db:migrate`.
- Não invente recursos, credenciais ou estados de provedores. Diferencie checks locais de homologação operacional real.
