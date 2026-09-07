# Admin UI routes

- `/` — `apps/admin/src/app/(workspace)/page.tsx`; authenticated workspace layout; editorial article operations table.
- `/articles/new` — `apps/admin/src/app/(workspace)/articles/new/page.tsx`; authenticated workspace layout; new article composition using `ArticleEditor`.
- `/articles/[id]/edit` — `apps/admin/src/app/(workspace)/articles/[id]/edit/page.tsx`; authenticated workspace layout; existing article editing, revision history and lifecycle actions.
- `/memberships` — `apps/admin/src/app/(workspace)/memberships/page.tsx`; authenticated workspace layout; admin-only team access management using `MembershipsPanel`.
- `/preview/articles/[id]` — `apps/admin/src/app/(workspace)/preview/articles/[id]/page.tsx`; authenticated workspace layout; CMS article preview.
- `/login` — `apps/admin/src/app/login/page.tsx`; root layout; Microsoft institutional login.

The App Router is file-based; there is no separate router configuration file.
