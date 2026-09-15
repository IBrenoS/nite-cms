# Redação Digital NITE — Diretrizes de Design (DESIGN.md)

## 1. Fundamentos Visuais

- **Tema e Contraste**: Tema claro padrão, com superfícies de alto contraste e foco rigoroso em acessibilidade (WCAG 2.2 AA).
- **Cores da Marca NITE**:
  - Marca Primária: Azul profundo NITE (`--nite-brand-primary`).
  - Superfícies: `--nite-surface` (#ffffff), seções auxiliares `--nite-section`.
  - Bordas: Sutis e consistentes (`--nite-border-subtle`, `--nite-border-strong`).
  - Status semânticos: `done` (verde), `warning` (âmbar), `error` (vermelho), `archived` (cinza neutro).
- **Tipografia**:
  - **Source Sans 3**: Interface geral, labels, botões, navegação, inputs e cards.
  - **Newsreader**: Exclusivo para o corpo do texto editorial (canvas de escrita e citações).
  - **IBM Plex Mono**: Exclusivo para identificadores técnicos (versões `vX`, contadores numéricos e slugs `/atualizacoes/...`).
- **Geometria e Espaçamento**:
  - Espaçamentos estritamente baseados na grade de 4 px (4, 8, 12, 16, 20, 24, 32 px).
  - Raio de controles e botões: 8 px (`rounded-md` / `rounded-lg`).
  - Raio de superfícies e diálogos modais: máximo de 12 px (`rounded-xl`).

## 2. Shell e Geometria do Editor

O editor possui três superfícies fundamentais:

1. **Header Sticky**:
   - Altura compacta (~56 px).
   - Breadcrumb/retorno a "Matérias".
   - Título da tela ("Nova matéria" ou "Editar matéria") e badge de status/versão.
   - Ações principais:
     - "Salvar rascunho" / "Salvar revisão" (secundária).
     - "Visualizar" com dropdown de CMS e Portal (intermediária).
     - "Publicar matéria" (para novos rascunhos) ou "Publicar alterações" (para matéria publicada com edições pendentes) (primária).
   - Faixa de status/notificação com `aria-live` imediatamente abaixo do header, informando salvamentos, erros e link de salto para campos inválidos.

2. **Canvas Central de Escrita**:
   - Largura máxima de 760 px, centralizada na área disponível.
   - Espaçamento inicial compacto: o título começa a no máximo 32 px abaixo do header.
   - Título editorial com altura inicial de uma linha e autoexpansão conforme o texto cresce (evita espaços vazios desnecessários).
   - Resumo (linha fina) integrado organicamente ao canvas, sem caixas aninhadas pesadas.
   - Área do corpo com min-height confortável e orientação discreta quando vazio ("Comece a escrever a matéria…").
   - Toolbar com separação nítida entre formatação de texto e adição de blocos de mídia.

3. **Inspector Lateral com Três Modos Responsivos**:
   - **`rail` (Desktop largo >= 1280 px)**: Barra lateral fixa com largura de 340–350 px com rolagem independente, mantendo configurações e preparação sempre visíveis ao lado do texto.
   - **`drawer` (Tablet / Desktop intermediário 768 px – 1279 px)**: Painel deslizante à direita acionado por barra sticky inferior: "Preparação X/6 · Configurações", permitindo consulta e fechamento rápidos com `Escape`.
   - **`sheet` (Mobile < 768 px)**: Painel de tela cheia ou bottom sheet acessível, acionado pelo mesmo gatilho sticky.
   - **Regra de Ouro**: O inspector nunca é empilhado abaixo do artigo.

## 3. Mídias Contextuais (Vídeo e Imagem)

- **Blocos ricos no Canvas**: Vídeos e imagens inseridos são renderizados como blocos visuais nítidos e informativos, com ícone, tipo, metadados (modo de reprodução, largura, legenda WebVTT, texto alt) e ações imediatas ("Editar" e "Remover").
- **Edição In-Place**: Clicar em "Editar" abre os controles imediatamente junto à mídia no canvas, sem deslocar a viewport para o topo da página.
- **Rótulos e Acessibilidade**: Todos os campos possuem rótulos visíveis permanentes, contadores de caracteres e textos de ajuda curtos.
- **Remoção Segura**: Remoção imediata pelo nó com reversibilidade nativa pelo histórico de desfazer (Ctrl+Z / Cmd+Z), sem modais burocráticos.
- **Sem player ou thumbnails externas pesadas**: Conforme contratos, o editor não faz requisição nem resolve URLs públicas de vídeo dentro do canvas — o preview real fica reservado à ação "Visualizar".

## 4. Central de Matérias

- Sem rolagem horizontal nos filtros de status.
- Layout tabular a partir de 860 px de largura útil.
- Card editorial compacto de duas linhas abaixo de 860 px, agrupando título, resumo e capa na linha superior, e metadados secundários (categoria, status, versão, atualização) em uma faixa compacta na linha inferior.
- CTA "Editar" explícito e acessível.

## 5. Diálogos e Confirmações

- Diálogo acessível em `<dialog>` para confirmações editoriais (publicação, despublicação, arquivamento e restauração).
- Foco inicial controlado, suporte a Escape e retorno automático de foco ao elemento disparador.
- Sem uso de `window.confirm`, `window.alert` ou `window.prompt`.
