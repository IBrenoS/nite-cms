# Page dependency trees

## `/` — Matérias

Entry: `apps/admin/src/app/(workspace)/page.tsx`

Dependencies:

- `apps/admin/src/lib/auth.ts`
- `packages/editorial/src/editorial-queries.ts`
- `packages/cms-ui/src/button.tsx` through `buttonVariants`
  - `packages/cms-ui/src/utils.ts`
- `packages/cms-ui/src/empty-state.tsx`
  - `packages/cms-ui/src/utils.ts`
- `packages/cms-ui/src/status-badge.tsx`
  - `packages/cms-ui/src/utils.ts`
- Shared layout: `apps/admin/src/app/(workspace)/layout.tsx`
  - `apps/admin/src/components/sign-out-button.tsx`
  - `packages/cms-ui/src/chip.tsx`
- Global theme: `apps/admin/src/app/globals.css`
  - `packages/cms-ui/src/theme.css`

## `/memberships` — Memberships

Entry: `apps/admin/src/app/(workspace)/memberships/page.tsx`

Dependencies:

- `apps/admin/src/lib/auth.ts`
- `apps/admin/src/components/memberships-panel.tsx`
  - `apps/admin/src/app/(workspace)/memberships/actions.ts`
  - `packages/cms-ui/src/button.tsx`
  - `packages/cms-ui/src/input.tsx`
  - `packages/cms-ui/src/utils.ts`
- Shared layout: `apps/admin/src/app/(workspace)/layout.tsx`
  - `apps/admin/src/components/sign-out-button.tsx`
  - `packages/cms-ui/src/chip.tsx`
- Global theme: `apps/admin/src/app/globals.css`
  - `packages/cms-ui/src/theme.css`

## `/articles/new` — Nova matéria

Entry: `apps/admin/src/app/(workspace)/articles/new/page.tsx`

Dependencies:

- `apps/admin/src/lib/auth.ts`
- `apps/admin/src/components/article-editor.tsx`
  - `apps/admin/src/app/(workspace)/articles/actions.ts`
  - `apps/admin/src/lib/editorial-form.ts`
  - `apps/admin/src/lib/editorial-tiptap.ts`
  - `packages/editorial/src/article-schema.ts`
  - `packages/cms-ui/src/button.tsx`
  - `packages/cms-ui/src/input.tsx`
  - `packages/cms-ui/src/textarea.tsx`
  - `packages/cms-ui/src/status-badge.tsx`
  - `packages/cms-ui/src/utils.ts`
- Shared layout: `apps/admin/src/app/(workspace)/layout.tsx`
  - `apps/admin/src/components/sign-out-button.tsx`
  - `packages/cms-ui/src/chip.tsx`
- Global theme: `apps/admin/src/app/globals.css`
  - `packages/cms-ui/src/theme.css`

## `/articles/[id]/edit` — Editar matéria

Entry: `apps/admin/src/app/(workspace)/articles/[id]/edit/page.tsx`

Dependencies:

- `apps/admin/src/lib/auth.ts`
- `packages/editorial/src/editorial-queries.ts`
- `apps/admin/src/components/article-editor.tsx` and the same recursive dependencies as `/articles/new`
- Shared workspace layout and global theme.
