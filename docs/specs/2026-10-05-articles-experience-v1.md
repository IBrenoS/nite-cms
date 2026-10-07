# NITE CMS — Matérias v1

Data: 2026-10-05

Status: fechado

## Objetivo

Transformar a página de Matérias de uma listagem administrativa genérica em uma mesa de trabalho editorial da Redação Digital, preservando integralmente o NITE CMS Design System v0.1 e os contratos existentes de backend.

## Direção de produto

A experiência prioriza histórias em vez de registros. A interface usa linguagem editorial humana, reduz metadados administrativos permanentes e deixa o conteúdo reconhecer-se como conteúdo jornalístico antes mesmo de a matéria ser aberta.

Referência de categoria de produto: ferramentas editoriais como Ghost, usando a referência apenas para hierarquia e fluxo, sem copiar identidade visual ou componentes. A identidade visual continua sendo a do NITE CMS.

## Contrato implementado

### Navegação

- Marca visível: `NITE` + `Redação Digital`.
- Grupo `REDAÇÃO`: `Matérias`.
- Grupo administrativo `GESTÃO`: `Equipe`.
- A página administrativa continua intitulada `Equipe e acessos`; apenas a navegação é abreviada.
- Nenhuma rota inexistente é adicionada para preencher a sidebar.

### Cabeçalho de Matérias

- Título: `Matérias`.
- Descrição: `Acompanhe o que está em produção e o que já foi publicado.`
- CTA principal: `Nova matéria`.
- O total encontrado deixa de ocupar a descrição porque as contagens passam a viver nas visões editoriais.

### Visões editoriais

- `Todas` → sem filtro de status.
- `Em produção` → `status=draft`.
- `Publicadas` → `status=published`.
- `Arquivadas` → `status=archived`.
- A linguagem de domínio/backend permanece inalterada.
- Busca e categoria são preservadas ao trocar de visão.

### Barra editorial

- Busca por título ou slug permanece o controle principal.
- Categoria é o filtro explícito disponível no desktop.
- O select de estado foi removido; estado é controlado pelas visões editoriais.
- Em mobile, a categoria é acessada por `Sheet` de filtros.
- A visão atual é preservada ao buscar ou alterar categoria.
- Quando busca/categoria estão ativas, `Limpar filtros` preserva a visão atual.

### Índice editorial

No desktop, a lista continua semanticamente baseada no primitive `Table`, mas a apresentação deixa de usar colunas administrativas dominantes.

Informação permanente por matéria:

1. capa;
2. título editorial;
3. resumo;
4. categoria;
5. atualização;
6. estado editorial;
7. menu contextual.

`Revisão` deixa de ser metadata permanente da listagem. A versão continua disponível no domínio e no editor.

O título da matéria usa `Newsreader` para reforçar que o objeto principal da tela é conteúdo editorial. Controles, metadados, filtros e estados continuam em `Source Sans 3`.

### Mobile

- A representação muda de table-like para article row/card editorial.
- Capa, título e resumo formam o primeiro nível de leitura.
- Categoria e atualização aparecem como metadata secundária.
- Estado e ação contextual ficam abaixo, sem comprimir a informação em colunas.
- As quatro visões editoriais permanecem integralmente visíveis em uma grade de quatro colunas nas larguras mobile de referência, sem cortar `Arquivadas`.
- A navegação principal abre em `Sheet` lateral pela esquerda, sobre o conteúdo, sem alterar a geometria ou empurrar a página.
- O `Sheet` usa a infraestrutura acessível do Design System, com backdrop, `Escape`, gerenciamento de foco e ação de fechamento explícita.

### Empty states

Três situações são distintas:

1. Redação sem nenhuma matéria: `Nenhuma matéria por aqui`, com CTA `Nova matéria`.
2. Busca/categoria sem resultados: `Nenhuma matéria corresponde aos filtros`, com `Limpar filtros`.
3. Visão editorial vazia: mensagem contextual para a etapa do fluxo.

## Restrições

- Não alterar schemas, queries de domínio, autenticação, upload, publicação, revisão, infraestrutura ou deploy.
- Não criar novos estados editoriais no backend.
- Não adicionar dashboard, KPIs ou rotas apenas para ornamentar a experiência.
- Continuar obedecendo a governança do Design System v0.1.
