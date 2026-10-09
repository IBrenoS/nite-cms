# Migração de identidade para Redação Digital do NITE

## Estado da migração

- Produto exibido: **Redação Digital do NITE**.
- Repositório GitHub: `IBrenoS/nite-redacao` (renomeado em 09/10/2026).
- Checkout como submodule do Portal: `nite-redacao/`.
- Imagens novas: `ghcr.io/ibrenos/nite-redacao-{admin,api,scheduler,migration}`.
  O workflow publica também as tags anteriores durante a transição.
- Cloudflare em 09/10/2026: `redacao.nite.tec.br` e
  `api.redacao.nite.tec.br` têm registros A DNS-only para `177.69.94.53`;
  `cms.nite.tec.br` e `api.cms.nite.tec.br` foram removidos da zona.
- Microsoft Entra em 09/10/2026: aplicativo **Redação Digital do NITE** com
  callback Web `https://redacao.nite.tec.br/api/auth/callback/microsoft`.
  O callback de produção antigo foi removido; o de localhost permanece.
- Ingress, TLS e runtimes da VM ainda não foram migrados nem validados.

## Contratos mantidos por compatibilidade

`CMS_*`, `@nite/cms-*`, tabelas/migrations `cms_*`, o prefixo de cookie
`nite-cms`, a assinatura `cms-invitation-v1` e o nome do projeto Compose
`nite-cms` continuam válidos. Renomeá-los exige migrações próprias; a mudança
de identidade não altera o comportamento da API pública ou dos links já
emitidos. A configuração de remetente aceita o nome antigo enquanto o ambiente
é atualizado, mas novos convites usam a marca Redação Digital no conteúdo.

## Conclusão operacional na VM

1. Inspecione o ingress real do datacenter (nginx e Caddy) e configure os
   novos hostnames e certificados TLS. O teste HTTPS dirigido ao IP anterior
   apresentou erro de nome no certificado antes desta mudança. Não suponha
   que editar `CMS_ADMIN_DOMAIN`/`CMS_API_DOMAIN` no Compose baste para o nginx.
2. Configure `CMS_ADMIN_DOMAIN=redacao.nite.tec.br` e
   `CMS_API_DOMAIN=api.redacao.nite.tec.br` no `stack.env` implantado. Atualize
   `BETTER_AUTH_URL` e `CMS_PUBLIC_URL` no runtime do Admin para
   `https://redacao.nite.tec.br`. Reinicie os serviços afetados.
3. Configure `CMS_PUBLIC_API_URL=https://api.redacao.nite.tec.br/` e
   `CMS_PREVIEW_RESOLVE_URL=https://redacao.nite.tec.br/api/preview/resolve`
   no runtime do Portal e reinicie-o. O `wrangler.jsonc` versionado foi
   alinhado, mas não representa o runtime da VM.
4. Valide `GET /api/health` no Admin, `GET /health` e `GET /v2/news` na API,
   resposta protegida do resolver sem token, login Microsoft, aceite de
   convite, lista e matéria no Portal, e preview autenticado.
5. Revise clientes e links antigos: os domínios `cms.*` foram retirados do DNS
   por autorização explícita e não funcionam como aliases nesta fase.

Não copie secrets entre os ambientes. Nenhuma etapa acima executa migration de
banco ou troca automaticamente os valores implantados nos provedores.
