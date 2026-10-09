# Redação Digital do NITE Design System — v0.1

## 1. Princípio visual

A Redação Digital do NITE é um ambiente editorial, não um dashboard SaaS genérico.

A interface deve transmitir:

**Editorial · Precisa · Sóbria · Contemporânea · Funcional**

A UI deve desaparecer quando o usuário está produzindo conteúdo e ganhar densidade quando ele está gerenciando conteúdo.

Existem, portanto, dois modos de densidade:

| Contexto                                         | Direção                |
| ------------------------------------------------ | ---------------------- |
| Gestão — matérias, equipe, categorias, histórico | Compacta e eficiente   |
| Criação — editor, preview, revisão               | Espaçosa e concentrada |

---

## 2. Cor

### Canvas e superfícies

A base será **Neutro Frio**.

| Token            | Valor inicial | Uso                            |
| ---------------- | ------------: | ------------------------------ |
| `canvas`         |     `#F7F8FA` | Fundo principal da aplicação   |
| `surface`        |     `#FFFFFF` | Painéis, editor, dialogs       |
| `surface-subtle` |     `#F2F4F7` | Áreas secundárias              |
| `surface-hover`  |     `#EEF1F5` | Hover discreto                 |
| `surface-active` |     `#E8EDF3` | Item selecionado               |
| `border-subtle`  |     `#E5E8EC` | Divisores                      |
| `border`         |     `#D9DEE5` | Inputs e elementos delimitados |
| `border-strong`  |     `#C4CBD4` | Ênfase pontual                 |

A diferença entre `canvas` e `surface` deve ser perceptível, mas pequena.

Não usar sombra para separar tudo.

### Texto

| Token            |     Valor |
| ---------------- | --------: |
| `text-primary`   | `#171A1F` |
| `text-secondary` | `#58616D` |
| `text-muted`     | `#68717C` |
| `text-disabled`  | `#A9B0B9` |
| `text-inverse`   | `#FFFFFF` |

O texto principal não será preto puro. `text-muted` preserva contraste WCAG AA sobre `surface` e `canvas` para texto pequeno.

### Azul NITE

O azul existente da marca permanece como fonte. Para a v0.1, o azul operacional da Redação Digital fica congelado em `#1D4ED8` através de um único token de marca; qualquer ajuste futuro de identidade deve acontecer somente nesse token.

```css
--nite-brand-blue: #1d4ed8;
--nite-primary: var(--nite-brand-blue);
```

Os estados devem ser derivados do token institucional, e não de `blue-600`, `blue-700`, `blue-800` espalhados pelo JSX.

```css
--primary: var(--nite-brand-blue);
--primary-hover: color-mix(in srgb, var(--primary) 88%, black);
--primary-active: color-mix(in srgb, var(--primary) 78%, black);
--primary-subtle: color-mix(in srgb, var(--primary) 8%, white);
--primary-border: color-mix(in srgb, var(--primary) 28%, white);
```

O azul deve indicar principalmente:

**ação → seleção → foco → navegação ativa → links**

Nunca deve virar cor decorativa dominante.

### Estados semânticos

| Estado  | Foreground   | Background     |
| ------- | ------------ | -------------- |
| Success | `#18794E`    | `#EAF7F0`      |
| Warning | `#A15C00`    | `#FFF5E0`      |
| Danger  | `#C93434`    | `#FFF0F0`      |
| Info    | primary NITE | primary subtle |

Status editoriais devem usar cores suaves.

“Publicada” não pinta uma linha de verde.
“Agendada” não transforma um card em amarelo.

---

## 3. Tipografia

Mantemos as três famílias existentes.

### Source Sans 3

Utilizada para toda a interface operacional.

| Token        | Tamanho / linha |    Peso | Uso                        |
| ------------ | --------------- | ------: | -------------------------- |
| `ui-xs`      | 12 / 16         | 400–600 | Metadata excepcional       |
| `ui-sm`      | 13 / 18         | 400–600 | Labels secundários         |
| `ui-md`      | 14 / 20         | 400–600 | **Base da interface**      |
| `ui-lg`      | 16 / 24         | 400–600 | Inputs importantes / texto |
| `heading-sm` | 18 / 24         |     600 | Seções                     |
| `heading-md` | 24 / 30         |     600 | Página                     |
| `heading-lg` | 32 / 38         |     600 | Casos excepcionais         |

**14px passa a ser o tamanho operacional padrão.**

`12px` deixa de ser tamanho padrão para botões, labels e controles.

### Newsreader

Reservada para conteúdo editorial.

| Token            | Tamanho / linha | Uso                          |
| ---------------- | --------------- | ---------------------------- |
| `editor-body`    | 18 / 30         | Corpo da matéria             |
| `editor-summary` | 18 / 27         | Linha fina                   |
| `editor-title`   | 40 / 44         | Título no editor             |
| `preview-title`  | 48 / 52         | Preview quando houver espaço |

Newsreader não deve aparecer em sidebar, filtros, settings ou tabelas.

### IBM Plex Mono

Uso muito controlado:

IDs, timestamps técnicos, slugs, dados de sistema e informação que realmente se beneficia de caráter monoespaçado.

Não usar apenas para “parecer técnico”.

---

## 4. Espaçamento

Base: **4px**.

| Token      | Valor |
| ---------- | ----: |
| `space-1`  |   4px |
| `space-2`  |   8px |
| `space-3`  |  12px |
| `space-4`  |  16px |
| `space-5`  |  20px |
| `space-6`  |  24px |
| `space-8`  |  32px |
| `space-10` |  40px |
| `space-12` |  48px |
| `space-16` |  64px |

Gestão trabalha principalmente entre 8–24px.

O editor pode utilizar 32–64px para preservar respiração visual.

Evitar valores arbitrários como `17px`, `22px`, `27px` sem motivo real.

---

## 5. Radius

A interface perde excessos de arredondamento e adota proporções firmes e sóbrias.

| Token         | Valor | Uso                         |
| ------------- | ----: | --------------------------- |
| `radius-sm`   |   6px | Badges / pequenos controles |
| `radius-md`   |   8px | Inputs / buttons            |
| `radius-lg`   |  10px | Cards / popovers            |
| `radius-xl`   |  12px | Dialogs                     |
| `radius-full` | 999px | Avatares / pills genuínas   |

Não utilizar `16–24px` como raio padrão.

Botões tradicionais não precisam parecer cápsulas.

---

## 6. Bordas e elevação

O sistema depende primeiro de **contraste de superfície e borda**, não de sombra.

```css
--border-width: 1px;

--shadow-popover:
  0 8px 24px rgb(16 24 40 / 0.08), 0 2px 6px rgb(16 24 40 / 0.04);

--shadow-dialog: 0 20px 50px rgb(16 24 40 / 0.14);
```

Tabelas, cards normais e painéis não recebem sombra por padrão.

Popover, dropdown, menu e dialog podem receber elevação.

---

## 7. Componentes interativos

Altura operacional padrão:

| Componente  |    Altura |
| ----------- | --------: |
| Button `sm` |      32px |
| Button `md` |      36px |
| Button `lg` |      40px |
| Input       |      40px |
| Select      |      40px |
| Search      |      40px |
| IconButton  | 36 × 36px |

Em mobile, áreas de toque nunca dependem apenas do tamanho visual do ícone (alvo mínimo de toque preservado).

### Button

Quatro variantes principais:

- `Primary`: Azul NITE. A principal ação da região.
- `Secondary`: Surface branca, border padrão.
- `Ghost`: Sem fundo persistente; hover sutil.
- `Danger`: Uso exclusivo para ações destrutivas.

Uma região normalmente terá **apenas uma ação Primary**.

Salvar e Publicar não disputam o mesmo peso visual: Publicar é a progressão principal do workflow.

---

## 8. Inputs

Anatomia padrão:

```text
Label
[ Input                                      ]
Helper text / erro
```

- Label: `14px / 600`.
- Input: `14–16px` (altura 40px).
- Placeholder: `text-muted`.

Focus:

```css
border-color: var(--primary);
outline: 3px solid var(--primary-subtle);
```

Erro:

```css
border-color: var(--danger);
```

A mensagem de erro deve explicar o problema. Não depender somente da cor vermelha.

---

## 9. Status e badges

Badges são pequenos, silenciosos e sem bordas agressivas.

```text
Publicada
Rascunho
Agendada
Arquivada
```

- Altura aproximada: `24px`.
- Padding horizontal: `8px`.
- Tipografia: `12–13px / 600`.
- Sem ícone salvo quando ele adiciona informação real.

---

## 10. Tables

Tabelas são a principal superfície de gestão.

A tabela não fica presa dentro de um card decorativo se não houver necessidade.

- Linha padrão: **52–60px**
- Hierarquia: Título principal / Metadata secundária
- Hover de linha: `surface-hover`
- Divisores horizontais sutis (`border-subtle`)
- Ações contextuais concentradas no menu `···`
- Checkbox apenas onde seleção múltipla realmente existir

---

## 11. Navegação

- Sidebar desktop: `240–256px` expandida.
- Rail: `64px` aproximadamente.
- Superfície neutra/branca (não um bloco azul).
- Item: `[ícone] Matérias`
- Estado ativo: `primary-subtle background`, `primary foreground`.
- A marca NITE aparece no topo sem competir com a navegação.
- Usuário e ações da conta ficam na região inferior.

---

## 12. Shell da página

Estrutura:

```text
Sidebar │ Page Header
        │
        │ Context actions
        │
        │ Main content
```

- Largura das áreas de gestão é fluida; formulários e leitura editorial limitam-se confortavelmente (ex: ~72ch no editor).
- Page Header:
  - Título
  - Descrição curta (esquerda) / Ação principal (direita)
- Margem horizontal desktop: aproximadamente `32px` (telas grandes: `40px`; mobile: `16px`).

---

## 13. Editor

O editor é tratado como uma experiência diferente do restante da Redação Digital.

- Canvas: **branco**
- Área externa: **canvas frio**
- Largura ideal do conteúdo: `680–760px` (~72ch).
- O próprio documento é a superfície — sem caixas e cards aninhados desnecessários.
- Header sticky (~56px) com breadcrumb, status/versão e ações alinhadas por hierarquia.
- Inspector lateral secundário ao canvas com três modos responsivos:
  - `rail` (desktop largo >= 1280px): barra adjacente de 336px com rolagem independente.
  - `drawer` (tablet / desktop intermediário 768px – 1279px): painel deslizante até 400px.
  - `sheet` (mobile < 768px): bottom sheet / painel de tela cheia.
  - O inspector nunca é empilhado abaixo do artigo.

---

## 14. Dialog e Sheet

O produto possui uma única infraestrutura compartilhada.

- `Dialog`: Centro da tela para confirmações, formulários curtos, ações destrutivas.
- `Sheet`: Painel lateral para filtros, inspector mobile/tablet e configurações contextuais.
- Responsabilidades da camada: focus trap, `Escape`, overlay, retorno de foco, scroll lock, labels e acessibilidade WCAG.
- Nenhuma página implementa sua própria versão ad-hoc de `role="dialog"`.

---

## 15. Toolbar

Toolbar é um primitive oficial estruturado:

```text
Toolbar
 ├─ ToolbarGroup
 │   ├─ ToolbarButton
 │   ├─ ToolbarButton
 │   └─ ToolbarButton
 ├─ Separator
 └─ ToolbarGroup
```

- Estados: default, hover, active, focus, disabled.
- Botões de formatação compactos (32px / `h-8`).
- Ações raramente utilizadas migram para menus contextuais.

---

## 16. Breakpoints

| Token            | Referência |
| ---------------- | ---------: |
| `mobile`         | ~560–640px |
| `editor-stack`   |      860px |
| `desktop`        |    ~1024px |
| `inspector-rail` |     1280px |
| `wide-editor`    |     1480px |

Racionalização sem quebrar o significado funcional no editor e nas listagens.

---

## 17. Motion

Motion é puramente funcional.

- Transições simples: `120–180ms`.
- Usar principalmente para: hover, menus, dialog, sheet, sidebar e mudança de estado.
- Nada quica, flutua ou desliza excessivamente.
- Respeito rigoroso a `prefers-reduced-motion`.

---

## 18. Acessibilidade

- WCAG AA de contraste por padrão.
- Foco visível (`var(--primary)` com anel de 3px `var(--primary-subtle)`).
- Navegação completa por teclado.
- Labels associadas em todos os controles.
- Dialogs com gerenciamento estrito de foco e retorno ao elemento acionador.
- Touch targets adequados.
- Estados nunca comunicados apenas por cor.

---

## 19. Primeiros primitives do `@nite/cms-ui`

A base do sistema oferece:

`Button`, `IconButton`, `Input`, `Textarea`, `Select`, `Field`, `Checkbox`, `Radio`, `Switch`, `Badge`, `Tabs`, `Dialog`, `Sheet`, `Popover`, `DropdownMenu`, `Tooltip`, `Alert`, `EmptyState`, `Table`, `Avatar`, `Skeleton`, `Spinner`, `Toolbar`, `Separator`.

Os componentes entram conforme as telas exigirem, com **uma única implementação oficial**.

---

## 20. Regras de governança

1. Não usar diretamente cores Tailwind como `blue-800`, `red-700`, `slate-950` dentro das páginas.
2. Não recriar `button`, `input`, `select`, modal ou badge quando existir primitive equivalente.
3. Não adicionar uma sombra para compensar falta de hierarquia.
4. Não criar card apenas para agrupar visualmente conteúdo.
5. Não usar `text-xs` como solução para encaixar informação.
6. Não introduzir novos valores arbitrários de radius, cor ou spacing sem primeiro verificar os tokens.
7. Não usar cor institucional como decoração.
8. Não modificar domínio, APIs ou comportamento editorial por causa de uma decisão estética.
9. A governança visual é verificada por `npm run check:design-system`, que bloqueia cores Tailwind diretas, controles HTML visuais recriados, `text-xs`, radius arbitrário, dialogs ad-hoc e breakpoints centrais fora dos tokens.

---

## 21. Mídias contextuais (Vídeo e Imagem)

- Blocos ricos no canvas: renderizados com ícone, metadados nítidos, legenda WebVTT e ações imediatas ("Editar" e "Remover").
- Edição in-place sem saltar o scroll da viewport.
- Remoção segura via histórico nativo (Ctrl+Z / Cmd+Z).
- Sem carregamento de players externos pesados dentro do canvas de edição; preview fiel concentrado na ação "Visualizar".

---

## 22. Resultado esperado

Uma pessoa deve conseguir reconhecer uma tela da Redação Digital do NITE mesmo sem ver o logo: pela tipografia, proporção, espaçamento, densidade, sobriedade editorial, uso disciplinado do azul NITE e coerência no comportamento dos componentes. O produto deve parecer **projetado**, não estilizado.
