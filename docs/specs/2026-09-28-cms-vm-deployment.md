# Deploy do CMS em VM com Docker Compose

**Status:** aprovado para implementação

## Objetivo

Hospedar CMS Admin e CMS API na mesma VM Linux por Docker Compose, mantendo
Neon, Cloudflare R2 e Microsoft Entra como serviços externos. Somente Caddy
expõe portas públicas; Admin e API permanecem na rede interna do stack.

## Topologia

- Caddy recebe HTTP/HTTPS, emite certificados, comprime respostas e encaminha
  os hosts configurados para `admin:3001` e `api:3002`.
- Admin e API usam builds Next.js `standalone` independentes e executam como
  usuário não-root.
- O Admin mantém um cache persistente para otimização de imagens. Certificados
  e configuração dinâmica do Caddy usam volumes próprios.
- Neon, R2, Entra e o endpoint de revalidação do Portal são acessados por rede
  externa; nenhum banco ou object storage é criado pelo stack.

## Operação

- `admin`, `api`, `caddy` e `outbox-scheduler` iniciam no stack padrão.
- `migration` pertence exclusivamente ao profile `operations`; migrations
  nunca executam durante build, startup ou restart.
- O scheduler chama o endpoint interno protegido do outbox imediatamente e,
  após cada conclusão, espera 15 minutos antes da próxima chamada. Chamadas não
  se sobrepõem, têm timeout de 70 segundos e nunca registram secret ou payload.
- Admin expõe `GET /api/health`; sucesso confirma configuração administrativa e
  acesso ao Neon, enquanto falhas retornam apenas `503 unavailable`.
- A API mantém `GET /health` como readiness de leitura pública.

## Configuração e segurança

- Domínios, e-mail ACME, imagens e limites são interpolados pelo Compose.
- Variáveis sensíveis ficam em arquivos locais ignorados pelo Git e separados
  por responsabilidade: Admin, API e migration.
- Somente 80/tcp e 443/tcp são publicados. Containers de aplicação usam
  `no-new-privileges`, root filesystem somente leitura quando compatível,
  limites de CPU/RAM e logs com rotação.
- Valores padrão: Admin 1,5 GiB/1,5 CPU; API 512 MiB/0,75 CPU; Caddy
  256 MiB/0,5 CPU; scheduler 128 MiB/0,25 CPU.

## Deploy e rollback

O deploy inicial pode construir imagens localmente. As mesmas imagens recebem
nomes configuráveis para publicação posterior em registry com tags imutáveis.
O operador configura DNS, firewall, redirect URI do Entra e secrets, constrói
as imagens, executa a migration manual e inicia o stack. Rollback troca as tags
pelas imagens anteriores e não reverte migrations automaticamente.

## Fora de escopo

- Migrar Neon ou R2 para a VM.
- Alterar autenticação Microsoft Entra.
- Tornar o Portal público consumidor dinâmico da CMS API.
- Executar migrations, publicar conteúdo ou acessar produção nesta entrega.

## Critérios de aceite

- Compose validado sem publicar 3001/3002.
- Targets `admin` e `api` constroem artefatos standalone executáveis.
- Readiness do Admin e da API controla a saúde dos containers.
- Scheduler cobre configuração inválida, sucesso, resposta não-2xx, timeout e
  execução serial.
- Migration só aparece com o profile `operations` e requer credencial própria.
- Exemplos e diff não contêm secrets reais.

