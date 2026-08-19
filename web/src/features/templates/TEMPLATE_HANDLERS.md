# Template Handler Functions

This document describes handler functions for **chatbot template records** (`chatbot_templates` — email, FAQ, catalogs, downloadable file layouts). For **uploaded media files** (PDFs in the Media library), see [`DOCUMENT_HANDLERS.md`](../../shared/lib/DOCUMENT_HANDLERS.md).

## Overview

The template handler system provides both server-side API endpoints and client-side utilities for viewing, downloading, importing, and exporting templates.

## Server-Side API Endpoints

### 1. View Template
**Endpoint:** `GET /api/template/view?id=<uuid>`

Retrieves full template data including content.

**Query Parameters:**
- `id` (required): Template UUID

**Response:**
```json
{
  "template": {
    "id": "uuid",
    "key": "welcome_email",
    "name": "Welcome Email",
    "description": "Email sent to new users",
    "kind": "email",
    "content": {...},
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  "chatbot_id": "uuid",
  "instance_id": "uuid"
}
```

**Example:**
```typescript
const result = await viewTemplate('template-uuid-here')
console.log(result.template.name)
```

---

### 2. Download Template
**Endpoint:** `GET /api/template/download?id=<uuid>&format=<json|txt>`

Downloads a template as a file.

**Query Parameters:**
- `id` (required): Template UUID
- `format` (optional): `json` or `txt` (default: `json`)

**Response:** File download (browser will prompt save dialog)

**Example:**
```typescript
await downloadTemplate('template-uuid-here', 'json')
```

---

### 3. Export Templates
**Endpoint:** `POST /api/template/export`

Exports multiple templates as a JSON bundle.

**Request Body:**
```json
{
  "template_ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Response:** JSON file download with all templates

**Example:**
```typescript
await exportTemplates(['uuid1', 'uuid2', 'uuid3'])
```

---

### 4. Import Templates
**Endpoint:** `POST /api/template/import`

Imports templates from a JSON bundle.

**Request Body:**
```json
{
  "chatbot_id": "uuid",
  "templates": [
    {
      "key": "welcome_msg",
      "name": "Welcome Message",
      "description": "Greeting for new users",
      "kind": "message",
      "content": {"text": "Welcome!"}
    }
  ],
  "overwrite": false
}
```

**Response:**
```json
{
  "imported": [
    {"id": "uuid", "key": "welcome_msg", "action": "created"}
  ],
  "skipped": [],
  "errors": [],
  "total": 1,
  "success_count": 1
}
```

**Example:**
```typescript
const result = await importTemplates(
  'chatbot-uuid',
  [
    {
      key: 'faq_hours',
      name: 'Hours FAQ',
      kind: 'faq',
      content: { intro: 'Our hours', items: [...] }
    }
  ],
  false // don't overwrite existing
)
console.log(`Imported ${result.success_count} templates`)
```

---

## Client-Side Functions

### Template API Functions (`templateApi.ts`)

#### `viewTemplate(templateId: string)`
Fetches complete template data including content.

```typescript
const { template, chatbot_id } = await viewTemplate('template-id')
```

#### `downloadTemplate(templateId: string, format?: 'json' | 'txt')`
Downloads a template as a file.

```typescript
await downloadTemplate('template-id', 'json')
```

#### `exportTemplates(templateIds: string[])`
Exports multiple templates to a JSON file.

```typescript
await exportTemplates(['id1', 'id2', 'id3'])
```

#### `importTemplates(chatbotId, templates, overwrite?)`
Imports templates from data.

```typescript
const result = await importTemplates('chatbot-id', templates, false)
```

#### `duplicateTemplate(templateId: string, newName?: string)`
Creates a copy of a template.

```typescript
const copy = await duplicateTemplate('template-id', 'Copy of Template')
```

#### `cloneTemplateToAnotherChatbot(templateId, targetChatbotId)`
Clones a template to another chatbot.

```typescript
await cloneTemplateToAnotherChatbot('template-id', 'target-chatbot-id')
```

---

### Template Helper Functions (`templateHelpers.ts`)

#### `getTemplatePreview(template, maxLength?)`
Gets a preview text of the template.

```typescript
const preview = getTemplatePreview(template, 100)
```

#### `getTemplateSize(template)` / `formatTemplateSize(bytes)`
Gets and formats template size.

```typescript
const bytes = getTemplateSize(template)
const formatted = formatTemplateSize(bytes) // "2.5 KB"
```

#### `validateTemplateKey(key)` / `validateTemplateName(name)`
Validates template key and name.

```typescript
const keyValidation = validateTemplateKey('my_template')
if (!keyValidation.valid) {
  console.error(keyValidation.error)
}
```

#### `searchTemplates(templates, query, kindFilter?)`
Searches templates by query and kind.

```typescript
const results = searchTemplates(allTemplates, 'email', 'email')
```

#### `sortTemplates(templates, sortBy, order?)`
Sorts templates by various criteria.

```typescript
const sorted = sortTemplates(templates, 'name', 'asc')
```

#### `groupTemplatesByKind(templates)`
Groups templates by their kind.

```typescript
const grouped = groupTemplatesByKind(templates)
// { email: [...], faq: [...], ... }
```

#### `getTemplateStats(templates)`
Gets statistics about templates.

```typescript
const stats = getTemplateStats(templates)
// { total: 10, byKind: [...], totalSize: 50000, averageSize: 5000 }
```

#### `getRecentlyUpdatedTemplates(templates, limit?)`
Gets recently updated templates.

```typescript
const recent = getRecentlyUpdatedTemplates(templates, 5)
```

#### `findTemplateByKey(templates, key)`
Finds a template by its key.

```typescript
const template = findTemplateByKey(templates, 'welcome_email')
```

#### `findTemplatesUsingTemplate(templates, targetKey)`
Finds templates that reference another template.

```typescript
const dependent = findTemplatesUsingTemplate(templates, 'welcome_email')
```

#### `getTemplateDependencies(template)`
Gets list of template keys this template depends on.

```typescript
const deps = getTemplateDependencies(template)
// ['hours_main', 'contact_info']
```

#### `hasCircularDependency(template, allTemplates)`
Checks if template has circular dependencies.

```typescript
const hasCircular = hasCircularDependency(template, allTemplates)
```

#### `readTemplateFromFile(file)`
Reads templates from an uploaded file.

```typescript
const { templates } = await readTemplateFromFile(file)
```

---

### React Hook (`useTemplateActions.ts`)

#### `useTemplateActions(chatbotId?)`
React hook for template actions with automatic cache invalidation.

```typescript
function MyComponent() {
  const { view, download, export: exportFn, import: importFn, duplicate, clone } = useTemplateActions(chatbotId)
  
  const handleView = async () => {
    const result = await view('template-id')
    console.log(result)
  }
  
  const handleDownload = async () => {
    await download('template-id', 'json')
  }
  
  const handleExport = async () => {
    await exportFn(['id1', 'id2'])
  }
  
  const handleImport = async () => {
    const result = await importFn(chatbotId, templates)
    console.log(`Imported ${result.success_count} templates`)
  }
  
  const handleDuplicate = async () => {
    await duplicate('template-id', 'New Name')
  }
  
  return (...)
}
```

#### `useBulkTemplateActions()`
Hook for bulk operations on templates.

```typescript
function BulkActions() {
  const { bulkExport, bulkDelete } = useBulkTemplateActions()
  
  const handleBulkExport = async (selectedIds: string[]) => {
    await bulkExport(selectedIds)
  }
  
  const handleBulkDelete = async (selectedIds: string[]) => {
    await bulkDelete(selectedIds)
  }
  
  return (...)
}
```

---

## Usage Examples

### Example 1: Download Template as JSON
```typescript
import { downloadTemplate } from '@/features/templates/templateApi'

async function handleDownloadJson(templateId: string) {
  try {
    await downloadTemplate(templateId, 'json')
    // Browser will prompt download
  } catch (error) {
    console.error('Download failed:', error)
  }
}
```

### Example 2: Export Multiple Templates
```typescript
import { exportTemplates } from '@/features/templates/templateApi'

async function exportSelected(selectedTemplateIds: string[]) {
  try {
    await exportTemplates(selectedTemplateIds)
    console.log('Templates exported successfully')
  } catch (error) {
    console.error('Export failed:', error)
  }
}
```

### Example 3: Import Templates with Validation
```typescript
import { importTemplates } from '@/features/templates/templateApi'
import { readTemplateFromFile } from '@/features/templates/templateHelpers'

async function handleFileUpload(file: File, chatbotId: string) {
  try {
    const { templates } = await readTemplateFromFile(file)
    const result = await importTemplates(chatbotId, templates, false)
    
    if (result.errors.length > 0) {
      console.warn('Some templates failed:', result.errors)
    }
    
    console.log(`Successfully imported ${result.success_count} templates`)
    
    if (result.skipped.length > 0) {
      console.log('Skipped templates (already exist):', result.skipped)
    }
  } catch (error) {
    console.error('Import failed:', error)
  }
}
```

### Example 4: Duplicate and Clone Templates
```typescript
import { duplicateTemplate, cloneTemplateToAnotherChatbot } from '@/features/templates/templateApi'

async function handleDuplicateAndClone(templateId: string, targetChatbotId: string) {
  const duplicate = await duplicateTemplate(templateId, 'Copy of Template')
  console.log('Created duplicate:', duplicate.id)
  
  const cloned = await cloneTemplateToAnotherChatbot(templateId, targetChatbotId)
  console.log('Cloned to another chatbot:', cloned.id)
}
```

### Example 5: Search and Filter Templates
```typescript
import { searchTemplates, sortTemplates, groupTemplatesByKind } from '@/features/templates/templateHelpers'

function TemplateManager({ templates }: { templates: ChatbotTemplate[] }) {
  const [query, setQuery] = useState('')
  const [kindFilter, setKindFilter] = useState<TemplateKind | 'all'>('all')
  
  const filtered = searchTemplates(templates, query, kindFilter)
  const sorted = sortTemplates(filtered, 'name', 'asc')
  const grouped = groupTemplatesByKind(sorted)
  
  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      {Object.entries(grouped).map(([kind, items]) => (
        <div key={kind}>
          <h3>{kind}</h3>
          {items.map(t => <div key={t.id}>{t.name}</div>)}
        </div>
      ))}
    </div>
  )
}
```

### Example 6: Template Dependency Analysis
```typescript
import { getTemplateDependencies, findTemplatesUsingTemplate, hasCircularDependency } from '@/features/templates/templateHelpers'

function analyzeDependencies(template: ChatbotTemplate, allTemplates: ChatbotTemplate[]) {
  const deps = getTemplateDependencies(template)
  console.log(`${template.name} depends on:`, deps)
  
  const dependents = findTemplatesUsingTemplate(allTemplates, template.key)
  console.log(`Templates using ${template.name}:`, dependents.map(t => t.name))
  
  const circular = hasCircularDependency(template, allTemplates)
  if (circular) {
    console.warn(`Warning: ${template.name} has circular dependencies!`)
  }
}
```

---

## Template typed inputs

Copy-style templates (email, FAQ, message, menu, hours, legal, receipt, **downloadable file**) declare an **input contract** on the Templates tab. The body uses `{{inputs.key}}` instead of embedding chatbot variables directly.

When a template is inserted on a Message, Question, End, Email, or OTP step:

1. The step still references `{{templates.key.text}}`, `.html`, `.subject`, or `.file`.
2. The inspector shows **Template inputs** — bind each declared input to `{{vars.*}}`, `{{steps.*}}`, or a literal.
3. Bindings are stored on the step as `templateBindings[templateKey][inputKey]`.
4. At send time, bindings resolve into `inputs` and the template body is filled.

Store catalogs (`kind: cart`) do **not** use this pattern.

```typescript
// Step config (simplified)
{
  text: 'Here is your agreement: {{templates.agreement.file}}',
  templateBindings: {
    agreement: {
      name: '{{vars.full_name}}',
      email: '{{steps.ask_email.response}}',
      signature: '{{vars.signature}}',
    },
  },
}
```

Problems flags required inputs with empty bindings on the inserting step.

---

## Security & Permissions

All API endpoints require authentication and verify:
1. User is authenticated
2. User has access to the instance
3. For write operations (import, delete), user has editor role or higher

## Error Handling

All functions throw errors that should be caught:

```typescript
try {
  await downloadTemplate(templateId)
} catch (error) {
  if (error instanceof Error) {
    console.error('Error:', error.message)
  }
}
```

## Type Definitions

```typescript
type TemplateKind = 'email' | 'faq' | 'cart' | 'menu' | 'message' | 'hours' | 'legal' | 'receipt' | 'document'

type TemplateInput = {
  key: string
  label: string
  type: 'string' | 'number' | 'boolean' | 'date' | 'file'
  required: boolean
}

type TemplateContent =
  | EmailContent
  | FaqContent
  | CartContent
  | MenuContent
  | MessageContent
  | HoursContent
  | LegalContent
  | ReceiptContent
  | DocumentContent

// Copy-style content includes inputs: TemplateInput[] (cart does not)

interface ChatbotTemplate {
  id: string
  chatbot_id: string
  key: string
  name: string
  description: string | null
  kind: TemplateKind
  content: TemplateContent
  deleted_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}
```
