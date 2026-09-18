# TemplateKind fix

Add these three entries to `TEMPLATE_KINDS` and `COPY_TEMPLATE_KINDS` in `templateModel.ts` (after `'whatsapp'`):

```ts
  'calendar',
  'social_share',
  'waitlist',
```

Also import in `TemplatesPage.tsx` from lucide-react:

```ts
  CalendarPlus,
  Share2,
  ListOrdered,
```
