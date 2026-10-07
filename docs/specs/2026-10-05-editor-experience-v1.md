# NITE CMS — Editor v1

Status: implementado para validação final.

## Objetivo

Transformar a edição de matéria em uma superfície de redação. O documento é o centro da experiência; publicação e revisão vivem em um Inspector próprio. O redesign preserva domínio editorial, APIs, persistência e o NITE CMS Design System v0.1.

## Contrato de experiência

### Workspace desktop (>= inspector-rail / 1280px)

- O Editor ocupa a viewport disponível.
- O documento e o Inspector possuem scroll vertical independente.
- O Inspector é uma coluna estrutural de altura integral, não um card que termina antes da matéria.
- O documento permanece centrado e limitado a 760px; o corpo preserva medida de leitura de 72ch.
- O header editorial permanece visível e concentra contexto, salvar, preview e publicação.

### Inspector de publicação

- Tabs: `Publicação` e `Revisões`.
- O checklist de preparação é acionável e leva ao campo correspondente.
- Configurações seguem a hierarquia:
  1. `Essencial` — categoria, assinatura, capa e texto alternativo.
  2. `Apresentação` — legenda e crédito da capa (opcionais).
  3. `Distribuição` — data de evento e destaque (opcionais).
  4. `Busca e URL` — slug e SEO (avançado).
  5. `Estado editorial` — despublicar, arquivar, restaurar ou excluir.
- Grupos opcionais/avançados ficam recolhidos quando não precisam de atenção.

### Toolbar

- A toolbar é sticky dentro do scroll do documento.
- Formatação principal permanece compacta.
- Inserção de mídia passa por uma única ação `Inserir`, com opções `Imagem` e `Vídeo`.

### Mídia inline

- Capa e mídia inline continuam entidades editoriais distintas.
- Imagem e vídeo são enviados com estados claros de upload, processamento, erro e sucesso.
- Imagem aceita JPEG/PNG/WebP; vídeo aceita MP4; legenda aceita WebVTT.
- Imagem/vídeo inseridos são renderizados como conteúdo editorial no documento.
- Informações técnicas (IDs de mídia, detalhes de pipeline) não aparecem no fluxo normal.
- Ao selecionar uma mídia, aparecem controles contextuais para substituir, largura, detalhes/opções e remover.
- Legenda, crédito, descrição acessível, playback e WebVTT aparecem apenas quando relevantes.
- Erros de upload permitem tentar novamente ou remover/cancelar.
- Ao acionar `Inserir > Imagem` ou `Inserir > Vídeo` em qualquer ponto de scroll, o painel de upload precisa ficar imediatamente visível.
- Após a inserção, o editor retorna a visualização ao ponto do documento onde a mídia foi adicionada.

### Publicação

- `Publicar` continua sendo a ação primária.
- Quando a matéria possui pendências, publicar abre um preflight com a lista dos problemas.
- Cada pendência leva diretamente ao campo correspondente.
- Quando a validação passa, permanece a confirmação editorial antes da publicação.

### Tablet e mobile

- Abaixo do rail permanente, o Inspector abre via `Sheet`.
- No mobile, o documento continua sendo a superfície principal.
- O dock inferior preserva salvar / preview quando disponível / ajustes / publicar.
- A toolbar permanece acessível durante a escrita, com overflow horizontal controlado quando necessário.

## Não objetivos

- Não alterar regras de domínio editorial.
- Não alterar schema do banco ou endpoints sem necessidade funcional comprovada.
- Não modificar a experiência Matérias v1 já fechada.
- Não reabrir decisões do Design System v0.1.
