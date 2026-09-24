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
  - Base operacional entre 14 e 16 px. Metadados realmente secundários podem usar 12–13 px; textos operacionais não usam 10–11 px.
- **Geometria e Espaçamento**:
  - Espaçamentos estritamente baseados na grade de 4 px (4, 8, 12, 16, 20, 24, 32 px).
  - Raio de controles e botões: 8 px (`rounded-md` / `rounded-lg`).
  - Raio de superfícies e diálogos modais: máximo de 12 px (`rounded-xl`).
  - Controles possuem 40 px no desktop e alvo mínimo de 44 px em dispositivos com ponteiro coarse.

## 2. Shell do Workspace

- Superfícies autenticadas formam uma grade contínua, sem offsets independentes ou centralizações que criem faixas vazias entre navegação, conteúdo e inspector.
- Em larguras a partir de 1280 px, a sidebar possui 224 px e pode ser recolhida para 64 px; a preferência fica apenas no `localStorage` do navegador.
- Entre 768 e 1279 px, a navegação usa rail de 64 px com nomes acessíveis e tooltips nativos.
- Abaixo de 768 px, uma app bar de 56 px oferece navegação móvel explícita e menu de conta com identidade, nível de acesso e saída.
- O controle de recolher fica no cabeçalho, ao lado da marca. No rail compacto, o bloco “N” passa a ser o acionador de expansão: revela o ícone ao hover e foco, e o mantém visível em ponteiros coarse; no mobile, o menu explícito substitui essa interação.
- O tema claro permanece o único tema exposto. Elevação é reservada a menus, drawers, sheets e dialogs.

## 3. Geometria do Editor

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
   - Superfície editorial contínua que começa imediatamente após a navegação e ocupa toda a coluna disponível até o inspector.
   - Apenas a medida de leitura é limitada a aproximadamente 65–72 caracteres; título, resumo, toolbar e corpo ficam alinhados à mesma origem.
   - Espaçamento inicial compacto: o título começa a no máximo 32 px abaixo do header.
   - Título editorial com altura inicial de uma linha e autoexpansão conforme o texto cresce (evita espaços vazios desnecessários).
   - Resumo (linha fina) integrado organicamente ao canvas, sem caixas aninhadas pesadas.
   - Área do corpo com min-height confortável e orientação discreta quando vazio ("Comece a escrever a matéria…").
   - Toolbar com separação nítida entre formatação de texto e adição de blocos de mídia.

3. **Inspector Lateral com Três Modos Responsivos**:
   - **`rail` (Desktop largo >= 1280 px)**: Barra lateral adjacente de 336 px com rolagem independente, mantendo preparação e configurações visíveis ao lado do texto.
   - **`drawer` (Tablet / Desktop intermediário 768 px – 1279 px)**: Painel deslizante à direita com até 400 px, acionado pela barra sticky inferior e fechável com `Escape`.
   - **`sheet` (Mobile < 768 px)**: Painel de tela cheia/bottom sheet acionado pelo dock inferior único.
   - **Regra de Ouro**: O inspector nunca é empilhado abaixo do artigo.

## 4. Mídias Contextuais (Vídeo e Imagem)

- **Blocos ricos no Canvas**: Vídeos e imagens inseridos são renderizados como blocos visuais nítidos e informativos, com ícone, tipo, metadados (modo de reprodução, largura, legenda WebVTT, texto alt) e ações imediatas ("Editar" e "Remover").
- **Edição In-Place**: Clicar em "Editar" abre os controles imediatamente junto à mídia no canvas, sem deslocar a viewport para o topo da página.
- **Rótulos e Acessibilidade**: Todos os campos possuem rótulos visíveis permanentes, contadores de caracteres e textos de ajuda curtos.
- **Remoção Segura**: Remoção imediata pelo nó com reversibilidade nativa pelo histórico de desfazer (Ctrl+Z / Cmd+Z), sem modais burocráticos.
- **Sem player ou thumbnails externas pesadas**: Conforme contratos, o editor não faz requisição nem resolve URLs públicas de vídeo dentro do canvas — o preview real fica reservado à ação "Visualizar".

## 5. Central de Matérias

- Em até 559 px, os quatro status usam uma grade 2×2 visível sem rolagem; acima disso, ocupam uma faixa horizontal estável. A busca ocupa toda a largura no mobile e filtros avançados abrem em sheet.
- Layout tabular a partir de 860 px de largura útil.
- Card editorial compacto de duas linhas abaixo de 860 px, agrupando título, resumo e capa na linha superior, e metadados secundários (categoria, status, versão, atualização) em uma faixa compacta na linha inferior.
- CTA "Editar" explícito e acessível.

## 6. Diálogos e Confirmações

- Diálogo acessível em `<dialog>` para confirmações editoriais (publicação, despublicação, arquivamento e restauração).
- Foco inicial controlado, suporte a Escape e retorno automático de foco ao elemento disparador.
- Sem uso de `window.confirm`, `window.alert` ou `window.prompt`.
