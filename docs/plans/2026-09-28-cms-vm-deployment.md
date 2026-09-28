# Plano de implementação — CMS em VM com Docker Compose

**Spec:** `docs/specs/2026-09-28-cms-vm-deployment.md`

## Restrições globais

- Neon, R2 e Microsoft Entra permanecem externos.
- Não executar migration nem acessar produção.
- Não adicionar dependências de runtime para scheduler ou infraestrutura.
- Preservar Node 22, TypeScript estrito e os contratos públicos existentes.
- Nenhum secret ou arquivo de ambiente real pode entrar no Git.

## Review Focus

- Configuração ausente deve falhar fechada sem revelar valores.
- Health check não pode expor exceções ou credenciais.
- Scheduler não pode sobrepor chamadas nem registrar authorization/body.
- Migrations não podem fazer parte do startup normal.
- Admin/API não podem publicar portas diretamente no host.

### Task 1: Builds standalone do monorepo

**Arquivos:** `apps/admin/next.config.test.ts`, `apps/admin/next.config.ts`,
`apps/api/next.config.test.ts`, `apps/api/next.config.ts`.

- [ ] Escrever testes que exijam `output: "standalone"` e
  `outputFileTracingRoot` igual à raiz do CMS.
- [ ] Executar os testes e observar falha pela configuração ausente.
- [ ] Implementar a configuração mínima nos dois apps.
- [ ] Executar os testes direcionados e builds dos dois workspaces.

### Task 2: Readiness do Admin

**Arquivos:** `apps/admin/src/lib/health.ts`,
`apps/admin/src/app/api/health/route.ts` e testes próximos.

- [ ] Escrever testes para banco disponível, configuração ausente e falha de
  banco; respostas externas devem ser apenas `ok` ou `unavailable`.
- [ ] Observar a falha antes de criar a implementação.
- [ ] Implementar consulta mínima ao Neon por `DATABASE_ADMIN_URL`.
- [ ] Executar os testes direcionados do Admin.

### Task 3: Scheduler do outbox

**Arquivos:** `deploy/vm/outbox-scheduler.mjs` e
`deploy/vm/outbox-scheduler.test.mjs`.

- [ ] Escrever testes para defaults, configuração inválida, sucesso, não-2xx,
  timeout e serialização das execuções.
- [ ] Observar falha por módulo inexistente.
- [ ] Implementar parser de ambiente, chamada protegida e loop cancelável sem
  dependências externas.
- [ ] Executar `node --test deploy/vm/outbox-scheduler.test.mjs`.

### Task 4: Imagens e stack Compose

**Arquivos:** `Dockerfile`, `.dockerignore`, `compose.production.yml`,
`deploy/vm/Caddyfile`, exemplos de ambiente e `scripts/vm-deployment.test.mjs`.

- [ ] Escrever teste estrutural que execute/valide os artefatos observáveis:
  targets de imagem, serviços, profiles, portas, health checks, limites e
  ausência de valores sensíveis nos exemplos.
- [ ] Observar falha pelos artefatos inexistentes.
- [ ] Criar Dockerfile multi-stage, Compose, Caddyfile e exemplos mínimos.
- [ ] Executar teste estrutural e `docker compose config` com fixtures locais.
- [ ] Construir os targets `admin` e `api`.

### Task 5: Runbook operacional

**Arquivos:** `README.md` e `docs/runbooks/cms-vm-deployment.md`.

- [ ] Documentar preparação, DNS, firewall, Entra, secrets, build, migration,
  startup, smoke, observabilidade e rollback por imagem anterior.
- [ ] Validar formatação, comandos, links e ausência de secrets.

### Task 6: Verificação final

- [ ] Iniciar stack local sem credenciais reais apenas quando os serviços
  permitirem fixtures seguras; caso Neon impeça readiness, validar os containers
  individualmente sem chamar recursos externos.
- [ ] Executar `npm run check` uma vez no estado final.
- [ ] Executar `git diff --check`, revisar o diff e procurar material sensível.
- [ ] Realizar revisão final independente do conjunto da alteração.

