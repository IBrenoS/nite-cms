# E-mail de convite de membros via Resend

**Data:** 2026-10-02  
**Status:** desenho aprovado; implementação pendente

## Objetivo

Enviar automaticamente um e-mail transacional em texto puro quando um
administrador criar ou substituir um convite de acesso ao CMS. O envio deve ser
assíncrono, idempotente e observável, sem tornar a disponibilidade do Resend uma
pré-condição para registrar o convite.

O remetente será `CMS NITE <acesso@notify.unijorge.com.br>`. O subdomínio
`notify.unijorge.com.br` será autenticado no Resend por DNS. O e-mail informará
o endereço do CMS, o nível de acesso, quem fez o convite e a expiração. Não
haverá token de acesso: a aceitação continuará vinculada ao e-mail retornado
pelo Entra no primeiro login.

## Decisões arquiteturais

### Separação de responsabilidades

- `packages/editorial` cria o convite e o evento
  `membership.invitation.email.requested` na mesma transação.
- `packages/db` persiste convites, outbox, entregas de e-mail e eventos do
  provedor. JSONB continua `unknown` na persistência; a validação dos payloads
  pertence ao domínio ou ao Admin.
- `apps/admin` contém o adaptador Resend, o corpo em texto puro, o dispatcher da
  outbox e o endpoint público do webhook.
- O Resend é uma integração externa acessada somente por HTTPS. Nenhuma regra
  de domínio depende diretamente do SDK do provedor.

`outbox_events` representa a execução do comando de envio. O estado posterior
da mensagem pertence a `email_deliveries`; portanto, uma outbox concluída
significa que o Resend aceitou o envio ou que o comando foi encerrado de forma
determinística, não que o destinatário recebeu o e-mail.

### Fluxo de criação

1. O administrador cria ou substitui um convite.
2. A mesma transação grava o convite, a auditoria existente e um evento de
   outbox com `aggregate_id` igual ao ID do convite.
3. O payload da outbox contém somente os identificadores necessários. O
   destinatário, papel, expiração e autor do convite são lidos do estado atual
   do banco no momento do processamento.
4. Após o commit, a Server Action tenta processar a outbox imediatamente. Uma
   falha nessa tentativa não desfaz o convite.
5. O scheduler existente permanece como fallback para falhas transitórias,
   processos interrompidos e eventos ainda não consumidos.

Antes de enviar, o dispatcher confirma que o convite ainda está `pending` e não
expirou. Convites aceitos, revogados ou expirados encerram o evento sem envio.
Uma substituição cria um novo convite e um novo evento; a mensagem antiga não é
reaproveitada.

### Envio e idempotência

O dispatcher cria ou recupera uma `email_delivery` estável, associada de forma
única ao evento da outbox e ao convite. O envio ao Resend utiliza:

- `Idempotency-Key: membership-invitation/<outbox-event-id>`;
- uma tag com o ID local da entrega para correlação precoce de webhooks;
- `from` obtido de `RESEND_FROM_EMAIL`;
- URL do painel obtida de `CMS_PUBLIC_URL`;
- corpo somente em `text`, sem HTML e sem tracking de abertura ou clique.

O ID retornado pelo Resend é persistido como `provider_message_id`. Se o Resend
aceitar a mensagem e a gravação local falhar, a próxima tentativa reutilizará o
mesmo payload e a mesma chave. As oito tentativas atuais da outbox terminam bem
dentro da retenção de 24 horas da chave de idempotência do Resend.

Falhas transitórias — timeout, erro de rede, `429` e `5xx` — retornam erro ao
processador para aplicar o backoff existente. Erros permanentes — payload
inválido, autenticação, domínio não verificado e demais `4xx` não transitórios —
marcam a entrega como `failed` e encerram o evento, evitando retries inúteis.
Mensagens de erro armazenadas serão normalizadas, limitadas e não conterão
secrets nem o corpo completo da requisição.

## Persistência

### `email_deliveries`

Uma linha por comando lógico de envio:

- `id` UUID;
- `outbox_event_id` UUID único e referenciado;
- `invitation_id` UUID referenciado;
- `provider` com valor `resend`;
- `provider_message_id` único e opcional até a aceitação;
- `recipient_email` normalizado;
- `status`: `pending`, `sent`, `delivered`, `bounced`, `complained` ou `failed`;
- `last_provider_event_at` opcional;
- `failure_reason` sanitizado e opcional;
- timestamps de criação e atualização.

### `email_delivery_events`

Registro mínimo e idempotente dos webhooks:

- `provider_event_id` como chave única;
- `delivery_id` referenciado;
- `provider_event_type`;
- `provider_created_at`;
- `failure_reason` sanitizado e opcional;
- `received_at`.

O payload bruto do webhook não será persistido. A atualização da entrega e a
inserção do evento ocorrerão na mesma transação. Eventos duplicados serão
ignorados pela chave única. Eventos mais antigos que
`last_provider_event_at` serão registrados, mas não poderão regredir o estado
corrente.

## Webhook do Resend

O Admin exporá `POST /api/webhooks/resend` com estas propriedades:

1. leitura do corpo HTTP original como texto;
2. validação obrigatória dos headers Svix com `RESEND_WEBHOOK_SECRET`;
3. parsing estrito somente após a assinatura ser validada;
4. aceitação dos eventos `email.sent`, `email.delivered`, `email.bounced`,
   `email.complained`, `email.failed` e `email.suppressed`;
5. correlação preferencial pela tag da entrega e fallback pelo
   `provider_message_id`;
6. resposta `2xx` para eventos válidos já processados ou irrelevantes;
7. resposta `400` para assinatura ou payload inválido e `503` para falha
   transitória de persistência, permitindo retry pelo Resend.

`email.suppressed` será registrado como `failed`. Eventos de abertura e clique
não serão assinados nem armazenados, pois não são necessários para um convite
operacional.

## Apresentação no painel

A listagem de convites pendentes exibirá o estado do último envio:

- `Aguardando envio` para `pending` ou ausência de entrega;
- `Enviado` para `sent`;
- `Entregue` para `delivered`;
- `Devolvido` para `bounced`;
- `Marcado como spam` para `complained`;
- `Falha no envio` para `failed`.

O estado do e-mail não altera a validade do convite. Correção ou substituição
de e-mail usa o fluxo existente e gera uma nova entrega. Reenvio manual fica
fora deste escopo para evitar criar semântica adicional de duplicação antes de
haver necessidade operacional comprovada.

## Configuração operacional

O runtime do Admin receberá, por secret store e nunca pelo repositório:

- `RESEND_API_KEY`;
- `RESEND_WEBHOOK_SECRET`;
- `RESEND_FROM_EMAIL=CMS NITE <acesso@notify.unijorge.com.br>`;
- `CMS_PUBLIC_URL` com a origem HTTPS pública do CMS.

Os arquivos `.env.example` documentarão apenas nomes e valores não sensíveis.
O domínio será criado no Resend na região `sa-east-1`, com tracking de abertura
e clique desativado. A ativação depende da inclusão e verificação dos registros
DNS fornecidos pelo Resend para SPF e DKIM; DMARC deve ser mantido ou criado de
forma compatível com a política institucional.

O webhook assinará somente os eventos necessários e apontará para
`https://<cms-public-origin>/api/webhooks/resend`. Seu signing secret é exibido
na criação e deve ser salvo imediatamente no secret store.

## Segurança e privacidade

- API key e signing secret existem somente no runtime do Admin.
- A assinatura é validada antes de interpretar qualquer dado do webhook.
- O endpoint usa corpo bruto, limite de tamanho e respostas sem detalhes
  internos.
- O e-mail não concede acesso por link; o Entra e o convite pendente continuam
  sendo a autoridade.
- O banco armazena apenas metadados necessários à operação e auditoria.
- Logs não incluem destinatário completo, conteúdo, Authorization, API key ou
  signing secret.
- O domínio transacional isolado reduz o impacto sobre a reputação do domínio
  institucional principal.

## Testes e validação

A implementação seguirá TDD e cobrirá:

- criação e substituição de convite gravando outbox atomicamente;
- rollback integral quando a gravação da outbox falhar;
- dispatcher ignorando convite não pendente ou expirado;
- corpo plain text, remetente, URL, tags e chave idempotente corretos;
- classificação de erros transitórios e permanentes;
- persistência do `provider_message_id` sem duplicação;
- verificação de assinatura sobre o corpo original;
- webhook duplicado, fora de ordem, desconhecido e sem correlação;
- mapeamento de todos os estados suportados;
- consulta e apresentação do estado no painel;
- testes de schema/migration e teste PostgreSQL real quando o ambiente estiver
  configurado;
- lint, typecheck, testes e build dos workspaces afetados;
- `npm run check` uma vez sobre o estado final.

Testes não farão envio real. A validação operacional posterior usará os
endereços de teste oficiais do Resend e um convite controlado somente após a
migration, os secrets, o domínio e o webhook estarem configurados.

## Implantação e reversibilidade

A entrega será dividida em código/migration e configuração externa. Nenhuma
migration, secret, alteração DNS, criação de webhook, deploy ou envio real será
executado sem autorização operacional explícita.

A migration adicionará apenas tabelas, enums, índices e referências; não
reescreverá convites existentes. Enquanto as variáveis do Resend estiverem
ausentes, o health check deve indicar configuração incompleta de forma genérica
e o dispatcher não tentará enviar mensagens. A reversão operacional consiste em
desabilitar o webhook e remover os secrets; os registros de entrega permanecem
como histórico. A remoção física do schema exigiria migration posterior e não
faz parte deste trabalho.
