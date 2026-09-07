# NITE CMS — Redação Digital

## Product context

NITE CMS is a private editorial operations product used by social-media and publishing staff to create, review, preview and publish Nite News articles. It also lets administrators manage Microsoft Entra-backed team access. The CMS is an extension of the NITE ecosystem, but its interface has an independent editorial language. Preserve only the NITE blue/cyan colors and the “NITE CMS” institutional signature.

## Experience principles

1. Make editorial state and the next safe action obvious.
2. Use familiar newsroom language in Brazilian Portuguese; keep infrastructure terminology secondary and contextual.
3. Prioritize writing and scanning over decoration.
4. Preserve explicit manual save, immutable revisions, preview gating and explicit publication confirmation.
5. Do not imply autosave, analytics, media-library routes, scheduling or collaboration features that do not exist.
6. Make advanced fields discoverable without placing them in the primary writing path.

## Visual direction

- Style: professional digital newsroom with calm operational density.
- Default surface: light workspace for long-form readability; dark graphite sidebar and chrome.
- Brand usage: NITE cobalt/sky only for signature, primary actions, focus and selected navigation. No gradients, neon effects or portal-style glassmorphism.
- UI typography: Source Sans 3 for navigation, controls, labels, tables and operational headings.
- Editorial typography: Newsreader for article titles, article-canvas headings and preview-like content only.
- Monospace: IBM Plex Mono only for slugs, versions and technical identifiers.
- Color palette: canvas `#F6F7F9`, surface `#FFFFFF`, sidebar `#11151B`, primary text `#18202A`, secondary text `#66717F`, subtle border `#DDE2E8`, primary `#1D4ED8`, accent `#0EA5E9`.
- Semantic colors: draft slate, published emerald, archived neutral, warning amber, destructive rose.
- Radius: 8px controls, 10px cards, 12px drawers. Avoid pill shapes except status badges and compact filters.
- Shadow: subtle and functional; reserve elevation for drawers, sticky action bars and menus.
- Spacing: 4px base grid, 16–24px within controls/cards, 32–40px between page sections.
- Icons: restrained outline icons with text labels; never use emoji as product icons.

## Shared desktop shell

- Target viewport: 1440×1000 desktop, responsive down to mobile.
- Left sidebar: 248px wide, dark graphite, “NITE CMS” signature at top.
- Navigation: “Matérias” as the primary content route; “Equipe e acessos” only for administrators.
- User identity and “Sair” live in the sidebar footer.
- Main content uses a maximum readable width without copying the Portal header.
- Mobile: sidebar becomes a sheet; filters and secondary actions collapse progressively.

## Page 1 — Central de matérias

Job: let publishers understand the editorial queue and continue work quickly.

- Page title “Matérias” with a concise operational description.
- Primary action “Nova matéria”.
- Compact summary cards for Rascunhos, Publicadas and Arquivadas, derived only from current records.
- Search by title/slug and filters for status/category.
- Editorial list rows include cover placeholder/thumbnail, title, summary, category, status, revision version and last update when available.
- Primary row action is “Editar”; secondary actions remain visually quiet.
- Empty state explains that a draft is private until explicit publication.
- Do not show analytics or unsupported workflow stages.

## Page 2 — Equipe e acessos

Job: help administrators understand who can access the CMS and safely change access.

- Page title “Equipe e acessos”; “membership” is not user-facing primary terminology.
- Summary counts for active people, publishers and administrators.
- Search plus role/state filters over the directory.
- People table includes display name, institutional email or fallback identifier, role, state and actions.
- Primary action “Adicionar pessoa” opens a right-side drawer.
- Drawer fields: display name, institutional email, role and a grouped “Dados do Microsoft Entra” section containing Object ID with explanatory help.
- Existing create-and-activate behavior remains explicit.
- Deactivation is available through contextual actions and must not be confused with deletion.
- Role changes and activation changes expose pending, success and error feedback.

## Page 3 — Nova matéria

Job: guide a social-media publisher from blank draft to a publishable article without hiding important editorial requirements.

- Header includes breadcrumb back to Matérias, title “Nova matéria” and unsaved-state language.
- Central writing column is approximately 760–820px.
- Title uses a large editorial input; summary follows with character guidance.
- Body editor has grouped formatting controls: structure, emphasis, lists, quotation and link.
- Inline-image controls are contextual to the body, not a permanent bulky form row.
- Right rail is sticky and contains completion checklist, publication settings, cover and SEO.
- Category and byline are visible publication essentials; slug is an advanced field and explains permanent locking after first publication.
- Cover uses a clear dropzone/preview area and keeps alternative text mandatory.
- SEO is collapsed by default with character counters.
- Persistent actions: “Salvar rascunho”, “Visualizar” and “Publicar”.
- Before the first save, preview is disabled with clear help; do not imply an unavailable preview.
- Publishing remains explicit and high-confidence, with validation errors summarized and linked to fields.

## Responsive behavior

- Under tablet width, summary cards wrap and article rows become compact cards.
- Editor settings move from the right rail into an accessible drawer or accordion.
- Sticky actions remain reachable without covering form fields.
- Minimum touch target is 44px; keyboard focus is always visible.

## Motion

- 160–220ms ease-out for hover, menu and drawer transitions.
- No decorative page-load animation.
- Respect reduced motion.

## Content voice

Direct, calm and operational Brazilian Portuguese. Prefer “pessoa”, “acesso”, “rascunho”, “revisão” and “publicar”. Explain Entra identifiers only where needed. Avoid marketing copy inside the workspace.
