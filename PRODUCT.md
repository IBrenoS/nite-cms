# Redação Digital NITE — Documento de Produto (PRODUCT.md)

## 1. Visão Geral

A **Redação Digital NITE** é a ferramenta editorial interna responsável pela criação, curadoria, revisão e publicação de matérias e atualizações no Portal NITE. O objetivo da experiência do usuário é fornecer um ambiente de redação fluido, moderno e focado na produção textual e audiovisual, distanciando-se do aspecto de formulário burocrático ou sistema administrativo frio.

## 2. Público-Alvo e Usuários

- **Jornalistas e Redatores**: Foco em escrita contínua, estruturação de tópicos (H2/H3), citações, links e adição harmônica de imagens e vídeos no corpo do texto.
- **Social Media e Editores de Conteúdo**: Foco em titulação atraente, resumos impactantes (linha fina), curadoria de capas (16:9), otimização de busca (SEO) e agilidade na publicação.
- **Publishers e Gestores de Comunicação**: Acompanhamento do ciclo de vida editorial (rascunho, revisão, publicado, arquivado) e governança de publicações.

## 3. Fluxos Principais

1. **Central de Matérias**:
   - Visão panorâmica da fila editorial.
   - Navegação por status (Todas, Rascunhos, Publicadas, Arquivadas) e busca por título/slug/categoria.
   - Apresentação em grade tabular compacta em larguras úteis a partir de 860 px, e card editorial de duas linhas em larguras menores.

2. **Nova Matéria e Edição de Matéria**:
   - Header com ações hierarquizadas: Salvar (secundário), Visualizar (intermediário), Publicar (primário com distinção clara entre primeira publicação e atualização de conteúdo já publicado).
   - Canvas de escrita limpo e focado, com título autoexpansível e resumo integrados ao documento editorial.
   - Orientação visual no canvas vazio ("Comece a escrever a matéria…") sem reduzir o canvas a uma caixa de formulário.
   - Mídias contextuais (vídeo e imagem) com controles inline e in-place (`NodeView`), eliminando saltos de foco e permitindo edição e remoção imediatas.
   - Inspector lateral (`rail`, `drawer`, `sheet`) contínuo e ordenado: Preparação e pendências, Publicação essencial, Capa, Opções complementares, SEO e Estado editorial.

## 4. Diretrizes de Qualidade e Conformidade

- **WCAG 2.2 Nível AA**: Contraste suficiente, rótulos permanentes em todos os campos, navegação completa por teclado, anúncios acessíveis (`aria-live`) e foco previsível.
- **Segurança Operacional e Confirmações**: Diálogos acessíveis em `<dialog>` com título, explicação das consequências e foco restaurado, eliminando completamente `window.confirm`, `window.alert` e `window.prompt`.
- **Prevenção de Perdas**: Preservação do aviso nativo `beforeunload` para alterações não salvas.
