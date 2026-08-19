# Template Handler Functions - Quick Start

This directory contains comprehensive template handling functionality for viewing, downloading, importing, and exporting document templates.

## Files Overview

- **`templateApi.ts`** - Client-side API functions for template operations
- **`templateHelpers.ts`** - Utility functions for template manipulation
- **`useTemplateActions.ts`** - React hooks for template operations
- **`TEMPLATE_HANDLERS.md`** - Complete documentation
- **`templateHandlers.check.ts`** - Test suite

## Quick Examples

### View a Template

```typescript
import { viewTemplate } from '@/features/templates/templateApi'

const { template } = await viewTemplate('template-id')
console.log(template.name, template.content)
```

### Download a Template

```typescript
import { downloadTemplate } from '@/features/templates/templateApi'

// Download as JSON
await downloadTemplate('template-id', 'json')

// Download as text
await downloadTemplate('template-id', 'txt')
```

### Export Multiple Templates

```typescript
import { exportTemplates } from '@/features/templates/templateApi'

await exportTemplates(['id-1', 'id-2', 'id-3'])
```

### Import Templates

```typescript
import { importTemplates } from '@/features/templates/templateApi'

const result = await importTemplates(
  'chatbot-id',
  [
    {
      key: 'welcome',
      name: 'Welcome Message',
      kind: 'message',
      content: { text: 'Welcome!' }
    }
  ],
  false // don't overwrite existing
)
```

### Duplicate a Template

```typescript
import { duplicateTemplate } from '@/features/templates/templateApi'

const copy = await duplicateTemplate('template-id', 'Copy Name')
```

### Search and Filter

```typescript
import { searchTemplates, sortTemplates } from '@/features/templates/templateHelpers'

const filtered = searchTemplates(templates, 'email', 'email')
const sorted = sortTemplates(filtered, 'name', 'asc')
```

### Using React Hook

```typescript
import { useTemplateActions } from '@/features/templates/useTemplateActions'

function MyComponent() {
  const { view, download, export: exportFn } = useTemplateActions(chatbotId)
  
  return (
    <button onClick={() => download('template-id', 'json')}>
      Download
    </button>
  )
}
```

## API Endpoints

- `GET /api/template/view?id=<uuid>` - View template
- `GET /api/template/download?id=<uuid>&format=<json|txt>` - Download template
- `POST /api/template/export` - Export multiple templates
- `POST /api/template/import` - Import templates

## Available Functions

### API Functions (templateApi.ts)
- `viewTemplate(id)` - Get template data
- `downloadTemplate(id, format)` - Download as file
- `exportTemplates(ids)` - Export multiple
- `importTemplates(chatbotId, templates, overwrite)` - Import from data
- `duplicateTemplate(id, name)` - Create copy
- `cloneTemplateToAnotherChatbot(id, targetId)` - Clone to another chatbot

### Helper Functions (templateHelpers.ts)
- `getTemplatePreview(template, maxLength)` - Get preview text
- `getTemplateSize(template)` - Get size in bytes
- `formatTemplateSize(bytes)` - Format size string
- `validateTemplateKey(key)` - Validate key format
- `validateTemplateName(name)` - Validate name format
- `searchTemplates(templates, query, kind)` - Search templates
- `sortTemplates(templates, sortBy, order)` - Sort templates
- `groupTemplatesByKind(templates)` - Group by kind
- `getTemplateStats(templates)` - Get statistics
- `findTemplateByKey(templates, key)` - Find by key
- `getTemplateDependencies(template)` - Get dependencies
- `hasCircularDependency(template, all)` - Check circular deps
- `readTemplateFromFile(file)` - Read from file

### React Hooks (useTemplateActions.ts)
- `useTemplateActions(chatbotId)` - Hook for template operations
- `useBulkTemplateActions()` - Hook for bulk operations

## For Complete Documentation

See **[TEMPLATE_HANDLERS.md](./TEMPLATE_HANDLERS.md)** for full API reference, examples, and type definitions.
