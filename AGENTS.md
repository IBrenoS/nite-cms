# Portal NITE — instruções para agentes

## Contexto do projeto

- Monorepo npm workspaces orquestrado por Turbo.
- `apps/web`: aplicação Next.js 16, React 19, UI, assets e testes Vitest/Playwright.
- `packages/content`: dados JSON canônicos, schemas Zod, tipos e consultas.
- `docs`: arquitetura, produto, design system e specs ativas.
- Execute os comandos públicos a partir da raiz do repositório.

Antes de alterar código, leia os arquivos relacionados, os testes próximos e a documentação aplicável. Preserve alterações existentes no worktree que não pertençam à tarefa.

## Limites obrigatórios

- Consuma conteúdo somente por `@nite/content`; não use imports profundos nem caminhos físicos entre workspaces.
- Mantenha filtragem editorial, autorização, ordenação e resolução por slug em `packages/content`.
- Mantenha rotas, componentes, tema, SEO, navegação e integrações de UI em `apps/web`.
- Ao mudar a API pública de `@nite/content`, valide os dois workspaces e preserve retrocompatibilidade quando aplicável.
- Não invente dados institucionais, métricas, pessoas, autorizações, vagas, datas ou funcionalidades. Use apenas conteúdo público aprovado.
- Preserve TypeScript estrito, acessibilidade WCAG AA, navegação por teclado e `prefers-reduced-motion`.
- Reutilize tokens e componentes existentes; não crie dependências ou abstrações sem necessidade comprovada.
- Em `apps/web`, siga também o `AGENTS.md` local e consulte a documentação da versão instalada do Next.js antes de usar APIs ou convenções do framework.

## Implementação

- Faça a menor alteração que resolva integralmente o problema e a acompanhe de teste quando houver comportamento observável.
- Investigue a causa raiz antes de corrigir bugs.
- Não refatore código não relacionado nem altere contratos, conteúdo público ou snapshots silenciosamente.
- Atualize `docs/architecture.md`, `docs/product.md` ou `docs/design-system.md` quando a mudança invalidar uma decisão documentada.

## Validação progressiva

Não execute toda a bateria após cada edição ou comando. Use a menor verificação capaz de detectar regressões no escopo atual e amplie somente quando o impacto aumentar:

1. Durante a implementação, execute o arquivo de teste diretamente relacionado.
   - Web: `npm run test --workspace=@nite/web -- <arquivo.test.tsx>`
   - Conteúdo: `npm run test --workspace=@nite/content -- <arquivo.test.ts>`
2. Se vários arquivos do mesmo workspace forem afetados, execute `npm run test --workspace=<workspace>`.
3. Se a mudança cruzar workspaces, use `npm run test:affected` e os typechecks envolvidos.
4. Execute `npm run check` uma única vez no encerramento de uma alteração de código, após agrupar as correções. Repita-o somente se uma mudança posterior puder invalidar seu resultado.
5. Playwright é manual: execute `npm run test:visual` apenas quando layout, responsividade, navegação ou renderização visual puderem mudar. Atualize snapshots somente quando a diferença for intencional e revisada.

Alterações apenas em documentação ou instruções não exigem testes de aplicação, build ou suíte visual. Nesse caso, valide somente formatação, links, caminhos e comandos mencionados.

## Comandos de referência

- `npm run dev`: desenvolvimento do app web.
- `npm run lint`: ESLint em todos os workspaces.
- `npm run typecheck`: tipos em todos os workspaces.
- `npm run test`: todos os testes unitários.
- `npm run test:affected`: testes dos workspaces afetados.
- `npm run check`: format check, dead code, lint, typecheck, testes e build.
- `npm run test:visual -- --list`: lista os casos Playwright sem executá-los.

## Entrega

Informe objetivamente: arquivos alterados, comportamento resultante, validações realmente executadas e riscos ou pendências. Não declare sucesso sem evidência do comando correspondente; diferencie falhas preexistentes de regressões causadas pela tarefa.
