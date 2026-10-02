# Convites de equipe por Resend

## Limite deste runbook

Este documento prepara, homologa e opera o envio transacional de convites do
CMS NITE. Ele não autoriza criação de recursos no Resend, alteração de DNS,
armazenamento de secrets, migration, deploy nem envio real.

O Admin cria o convite e o evento de outbox na mesma transação. O processador
envia o texto puro pelo Resend e registra o identificador do provedor. O
endpoint `POST /api/webhooks/resend` valida a assinatura sobre o corpo bruto e
registra eventos idempotentes de envio, entrega, bounce, reclamação, falha e
supressão. Convite, entrega e membership são estados distintos: o e-mail não
concede acesso, e somente o aceite seguido da autenticação institucional com o
mesmo endereço cria a membership.

## Preparação

Antes de alterar qualquer ambiente:

1. Liste convites `pending` legados. Defina se cada pessoa ainda deve receber o
   convite; não dispare retroativamente sem revisão administrativa.
2. No Resend, crie `notify.unijorge.com.br` na região de São Paulo
   (`sa-east-1`). Não use o domínio raiz para esse fluxo.
3. Publique no DNS institucional exatamente os registros SPF e DKIM fornecidos
   pelo Resend. Alinhe a política DMARC com a equipe responsável pelo domínio e
   valide que ela cobre o subdomínio sem enfraquecer a política existente.
4. Aguarde o domínio aparecer como verificado. Mantenha open tracking e click
   tracking desabilitados; o fluxo não depende desses eventos.
5. Crie uma API key com permissão somente de envio e restrita ao domínio
   `notify.unijorge.com.br`. Armazene o valor uma única vez no gerenciador de
   secrets do ambiente; nunca em arquivo versionado ou log.
6. Crie um webhook para
   `https://<origem-do-admin>/api/webhooks/resend`, selecionando somente
   `email.sent`, `email.delivered`, `email.bounced`, `email.complained`,
   `email.failed` e `email.suppressed`. Armazene imediatamente o signing secret
   no mesmo gerenciador de secrets.
7. Gere `INVITATION_LINK_SECRET` aleatório com no mínimo 32 bytes. Ele é
   exclusivo dos links de convite e não deve reutilizar secrets de autenticação,
   cron, preview ou webhook.

## Variáveis do CMS Admin

Configure somente no runtime do Admin:

```text
RESEND_API_KEY=<secret de envio restrito ao domínio>
RESEND_WEBHOOK_SECRET=<signing secret do webhook>
RESEND_FROM_EMAIL=CMS NITE <acesso@notify.unijorge.com.br>
CMS_PUBLIC_URL=https://<origem-canônica-do-admin>
INVITATION_LINK_SECRET=<secret aleatório exclusivo>
```

`CMS_PUBLIC_URL` deve ser a origem HTTPS pública, sem path, query ou fragmento.
Os cinco valores são obrigatórios para o health do Admin. A API pública e o
Portal não recebem essas variáveis.

## Rollout autorizado

Execute a sequência abaixo somente na janela aprovada:

1. Confirme a decisão sobre os convites pendentes legados.
2. Configure e verifique domínio, SPF, DKIM e DMARC.
3. Crie a API key e o webhook; salve os dois secrets antes de sair das telas de
   criação.
4. Configure as cinco variáveis no ambiente alvo, sem imprimi-las.
5. Faça backup e aplique manualmente as migrations, a partir da raiz, com
   `DATABASE_MIGRATION_URL`:

   ```text
   npm run db:migrate
   ```

6. Publique o Admin e confirme que `/health` está saudável. Não envie convites
   enquanto a configuração estiver incompleta.
7. Em homologação, envie mensagens controladas aos endereços oficiais
   `delivered@resend.dev`, `bounced@resend.dev` e `complained@resend.dev`.
   Confirme no painel **Equipe e acessos** as transições `Enviado`, `Entregue`,
   `Devolvido` e `Marcado como spam`, conforme o cenário.
8. Confirme no Resend que o webhook respondeu `2xx` e que retries ou replays do
   mesmo evento não duplicam o histórico local.
9. Só então envie um convite controlado a uma conta institucional dedicada.
   Confirme recebimento, aceite explícito, redirecionamento à autenticação,
   rejeição de login com endereço diferente e criação da membership apenas com
   o endereço convidado.

Os endereços `@resend.dev` simulam eventos e não substituem a validação final
com uma caixa institucional controlada.

## Observabilidade e resposta a falhas

- `Aguardando envio` indica que a entrega ainda não foi aceita pelo provedor;
  confirme o estado da outbox e a configuração antes de reenviar.
- `Enviado` indica aceite pela API do Resend, não entrega na caixa postal.
- `Entregue` vem do webhook `email.delivered`.
- `Devolvido`, `Marcado como spam` e `Falha no envio` exigem investigação antes
  de qualquer novo convite. Não tente contornar a suppression list.
- Compare pelo identificador da entrega e pelo `email_id` do Resend. Não copie
  corpo do webhook, link assinado, API key ou signing secret para tickets e
  logs.
- Preserve o histórico de `email_deliveries`, `email_delivery_events`, outbox e
  convites durante a investigação.

## Rollback

1. Suspenda novos convites administrativos.
2. Desabilite o webhook no Resend e remova do runtime a API key e o signing
   secret. Isso interrompe novos envios e eventos sem apagar histórico.
3. Reverta o código para a versão anterior conforme o procedimento normal de
   deploy. Não faça migration reversa automática e não exclua registros de
   convite, entrega ou outbox.
4. Corrija a causa, restaure secrets novos se houver suspeita de exposição,
   repita os testes controlados e somente então reabra o fluxo.

O rollback não invalida links já emitidos. Quando necessário, revogue os
convites afetados no CMS; a substituição cria novo convite, novo link e novo
prazo.
