# Deploy do CMS em VM com Docker Compose

## Escopo e topologia

Este runbook instala somente CMS Admin, CMS API, scheduler do outbox e Caddy em
uma VM Linux `amd64`. Neon, Cloudflare R2, Microsoft Entra e o Portal continuam
externos. A execução dos comandos em produção exige autorização operacional;
este documento não autoriza migration, mudança de DNS ou publicação editorial.

Somente Caddy publica portas no host:

```text
Internet -> Caddy :80/:443 -> Admin :3001
                            -> API   :3002
                    Admin <- Scheduler interno

Admin/API -> Neon e R2 por HTTPS/TLS
Admin     -> Entra e webhook do Portal por HTTPS
```

O profile `operations` contém a migration e não participa de `up` ou restart.
Os volumes persistentes guardam somente estado do Caddy e cache do Next.js; os
dados editoriais permanecem no Neon e os objetos permanecem no R2.

## Capacidade inicial

Os limites padrão dos serviços permanentes somam 2.432 MiB (2,375 GiB) e 3
vCPU:

| Serviço   | Memória máxima | CPU máxima |
| --------- | -------------: | ---------: |
| Admin     |      1.536 MiB |       1,50 |
| API       |        512 MiB |       0,75 |
| Caddy     |        256 MiB |       0,50 |
| Scheduler |        128 MiB |       0,25 |

A migration pode acrescentar temporariamente 512 MiB e 0,50 CPU. Esses valores
são limites, não reservas e não representam consumo medido. Como ponto de
partida operacional, use uma VM com 4 vCPU, 4 GiB de RAM e folga de disco para
imagens, logs e cache. Reutilize uma VM existente somente se ela mantiver essa
folga durante seus próprios picos; caso contrário, prefira isolamento em uma
VM nova.

Após o primeiro ciclo editorial representativo, acompanhe `docker stats` e as
métricas do host. Reduza ou aumente os limites em `stack.env` com base em
percentis e eventos de OOM/throttling, não apenas no uso ocioso.

## Pré-requisitos da VM

- Linux `amd64` atualizado, Docker Engine 29+ e Docker Compose v5+;
- usuário de operação autorizado a usar Docker; acesso ao grupo `docker`
  equivale a acesso administrativo ao host;
- relógio sincronizado por NTP;
- saída DNS e TCP/443 para Neon, R2, Entra, Portal, ACME e registry de imagens;
- entrada TCP/80 e TCP/443; UDP/443 é opcional para HTTP/3, mas está publicado
  pelo Compose;
- SSH limitado às redes/identidades administrativas;
- backup e plano de recuperação do Neon definidos antes de qualquer migration.

Confirme as versões:

```bash
docker version
docker compose version
```

Reserve um diretório controlado pelo operador, faça checkout de uma revisão
aprovada e execute todos os comandos seguintes na raiz do CMS.

## DNS, firewall e TLS

1. Crie registros `A` e, se aplicável, `AAAA` para os hosts do Admin e da API
   apontando para o endereço público da VM.
2. Libere somente `80/tcp`, `443/tcp`, opcionalmente `443/udp` e o SSH
   administrativo. Não publique `3001` nem `3002`.
3. Defina `CMS_ADMIN_DOMAIN` e `CMS_API_DOMAIN` apenas com os hostnames de
   produção, sem path. O Caddy obtém e renova certificados automaticamente.
4. Se Cloudflare estiver na frente dos hosts, use TLS **Full (strict)** e
   preserve um certificado público válido no origin. Não habilite HSTS com
   subdomínios neste stack.

Para um smoke local sem HTTPS, os valores podem ter o formato
`http://admin.localhost` e `http://api.localhost`. Não use esse formato em
produção.

## Microsoft Entra

No app registration usado pelo CMS, registre como Web redirect URI:

```text
https://<CMS_ADMIN_DOMAIN>/api/auth/callback/microsoft
```

Defina `BETTER_AUTH_URL` como a origem exata do Admin, sem barra final, e use o
mesmo hostname cadastrado no Entra. Revise tenant, client ID, client secret e o
object ID do bootstrap admin antes do primeiro login. Não reutilize o secret do
Entra como secret de Better Auth, preview, revalidação ou cron.

## Arquivos de configuração e secrets

Crie os arquivos locais a partir dos exemplos versionados:

```bash
cp deploy/vm/stack.env.example deploy/vm/stack.env
cp deploy/vm/admin.env.example deploy/vm/admin.env
cp deploy/vm/api.env.example deploy/vm/api.env
cp deploy/vm/scheduler.env.example deploy/vm/scheduler.env
cp deploy/vm/migration.env.example deploy/vm/migration.env
chmod 600 deploy/vm/stack.env deploy/vm/admin.env deploy/vm/api.env deploy/vm/scheduler.env deploy/vm/migration.env
```

Edite os arquivos com um mecanismo que não grave valores em histórico de shell
ou logs. Todos os arquivos reais são ignorados pelo Git.

- `stack.env`: domínios, e-mail ACME, nomes/tags das imagens, paths dos arquivos
  de ambiente e limites de recursos;
- `admin.env`: Neon administrativo, Better Auth, Entra, R2, preview e
  revalidação;
- `api.env`: login Neon read-only e base pública do R2;
- `scheduler.env`: um único `CRON_SECRET` de pelo menos 32 caracteres,
  compartilhado apenas com o Admin, e intervalo opcional;
- `migration.env`: login Neon com ownership/DDL, usado somente pelo profile
  manual.

Não coloque a credencial de migration, credenciais R2 de escrita, Entra ou
secrets do Admin na API. Para a matriz completa de permissões, consulte
[`cms-rollout.md`](cms-rollout.md).

## Validação e build

Valide interpolação, env files, Caddyfile e topologia antes do build:

```bash
docker compose --env-file deploy/vm/stack.env -f compose.production.yml config --quiet
docker run --rm \
  --env-file deploy/vm/stack.env \
  -v "$PWD/deploy/vm/Caddyfile:/etc/caddy/Caddyfile:ro" \
  caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

Construa as quatro imagens a partir da revisão aprovada:

```bash
docker compose --env-file deploy/vm/stack.env -f compose.production.yml build admin api outbox-scheduler migration
```

O build nunca acessa o banco nem aplica migrations. Em um registry, configure
os quatro nomes de imagem em `stack.env`, use uma tag imutável comum
(`CMS_IMAGE_TAG`) e publique pelo processo de CI/registry adotado. Não use
`latest` para produção ou rollback.

## Migration manual

Antes da primeira inicialização ou de uma versão que exija schema novo:

1. confirme backup/restauração do Neon;
2. confirme que a imagem de migration tem a mesma tag da versão a publicar;
3. execute uma única vez:

```bash
docker compose --env-file deploy/vm/stack.env -f compose.production.yml --profile operations run --rm migration
```

Interrompa o rollout se o comando falhar. Não acrescente migration ao
Dockerfile, `entrypoint`, health check, `up` ou política de restart. Não reverta
migrations automaticamente durante rollback da aplicação.

## Inicialização e atualização

Para imagens construídas na própria VM:

```bash
docker compose --env-file deploy/vm/stack.env -f compose.production.yml up -d --remove-orphans
```

Para imagens já publicadas em registry:

```bash
docker compose --env-file deploy/vm/stack.env -f compose.production.yml pull
docker compose --env-file deploy/vm/stack.env -f compose.production.yml up -d --no-build --remove-orphans
```

`migration` permanece ausente porque seu profile não foi habilitado. O
scheduler espera o Admin ficar saudável, chama o outbox imediatamente e depois
a cada 900.000 ms. Cada chamada tem timeout de 70 segundos e a seguinte só
começa depois que a anterior termina.

## Smoke tests

Confira estado e health checks:

```bash
docker compose --env-file deploy/vm/stack.env -f compose.production.yml ps
curl --fail --silent --show-error https://<CMS_ADMIN_DOMAIN>/api/health
curl --fail --silent --show-error https://<CMS_API_DOMAIN>/health
```

As respostas saudáveis são `{"status":"ok"}`. Falha de configuração ou Neon
retorna `503` com `{"status":"unavailable"}`, sem causa ou credencial.

Em seguida:

1. confirme que `https://<CMS_API_DOMAIN>/v2/news` responde pelo contrato
   público esperado;
2. confirme que `/api/cron/outbox` sem Bearer retorna `401`;
3. faça login pelo Entra e valide uma leitura no Admin;
4. valide upload/preview/revalidação com dados exclusivos de homologação antes
   de liberar publicação real;
5. confirme externamente que as portas 3001 e 3002 não estão acessíveis.

## Observabilidade e operação

Os logs de containers usam `json-file`, com cinco arquivos de até 10 MiB por
serviço. O access log do Caddy é JSON em stdout. O scheduler registra apenas
evento, status ou nome genérico de erro; não registra Bearer nem corpo da
resposta.

```bash
docker compose --env-file deploy/vm/stack.env -f compose.production.yml logs --since 30m
docker compose --env-file deploy/vm/stack.env -f compose.production.yml ps
docker stats
docker system df
```

Alarme pelo menos para container unhealthy/restarting, HTTP 5xx, latência,
OOM, disco do host, renovação TLS e falhas repetidas do scheduler. Monitore
Neon e R2 nos respectivos provedores. Não encaminhe env, headers de
autorização, cookies ou payload editorial para logs.

## Rollback por tag

1. suspenda mutações editoriais se houver risco de incompatibilidade;
2. altere somente `CMS_IMAGE_TAG` em `stack.env` para a tag imutável anterior;
3. recupere e suba as imagens sem rebuild:

```bash
docker compose --env-file deploy/vm/stack.env -f compose.production.yml pull
docker compose --env-file deploy/vm/stack.env -f compose.production.yml up -d --no-build --remove-orphans
```

4. repita os smoke tests e acompanhe logs e outbox.

Não reverta schema ou exclua dados/objetos R2 automaticamente. Se a versão
anterior não for compatível com o schema atual, mantenha a aplicação suspensa e
execute o plano de recuperação aprovado. Os volumes do Caddy devem ser
preservados; removê-los perde o estado local de certificados e configuração.
