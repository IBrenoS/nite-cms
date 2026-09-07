# Extractable components

No isolated layout component is currently suitable for extraction.

The authenticated shell is implemented directly in `apps/admin/src/app/(workspace)/layout.tsx` and is coupled to server-side authentication and membership checks. The redesign will use that file as source context, but will not create a reusable Superdesign component from it. Basic primitives such as Button, Input, Textarea, Card and StatusBadge are intentionally kept inline according to the Superdesign extraction rules.
