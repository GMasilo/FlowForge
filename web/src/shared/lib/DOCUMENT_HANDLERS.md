# Document file handlers

Client utilities for **stored document files** — PDFs, Office docs, images, and other uploads under `api/files/{instance}/{chatbot}/`. These are **not** chatbot template JSON (`chatbot_templates`); use [template handlers](../features/templates/TEMPLATE_HANDLERS.md) for that.

## Files

| File | Purpose |
|------|---------|
| `documentApi.ts` | API functions (`view`, `download`, `open`, CRUD) |
| `documentHelpers.ts` | Search, sort, validate filenames, format sizes |
| `useDocumentActions.ts` | React Query hooks |
| `documents.ts` | Barrel re-export |

## Quick start

```typescript
import { createDocumentHandlers } from '@/shared/lib/documents'

const docs = createDocumentHandlers({
  instanceId: '…',
  chatbotId: '…',
  kind: 'media', // or 'conversation'
})

await docs.view('report.pdf')       // metadata + preview
await docs.download('report.pdf')   // save to disk
docs.open('report.pdf')             // new tab inline preview
await docs.list()
await docs.upload(file)
await docs.delete('old.pdf')
```

## React hook

```typescript
import { useDocumentActions, useDocuments } from '@/shared/lib/documents'

const { data: files } = useDocuments(instanceId, chatbotId)
const { view, download, open, upload, delete: removeFile } = useDocumentActions(instanceId, chatbotId)

await download('agreement.pdf')
```

## Server endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/document/view` | Metadata, MIME, optional text preview |
| GET | `/document/download` | Force-download (authenticated) |
| GET | `/file/get` | Inline display (used by `open`) |
| GET | `/file/list` | List files in a folder |
| POST | `/file/upload` | Upload |
| POST | `/file/delete` | Delete |
| POST | `/document/rename` | Rename |
| POST | `/document/copy` | Copy |
| POST | `/document/move` | Move between chatbots or kinds |

Query params for GET: `instance_id`, `chatbot_id`, `name`, `kind` (`media` | `conversation`).

## Generated downloadable files (templates)

Filled PDF/Word/Excel from a **Downloadable file** template (`{{templates.key.file}}`) are built client-side at click time — not via these handlers. See [Templates documentation](/docs#templates) and the downloadable-files section in `content.ts`.

## Tests

```bash
npx vite-node src/shared/lib/documentHandlers.check.ts
```
