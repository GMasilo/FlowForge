# Template Handler Functions - Complete Function Reference

## Summary

This document provides a complete list of all template handler functions available in the application.

---

## API Endpoints

### 1. View Template
**Endpoint:** `GET /api/template/view?id=<uuid>`

Retrieves full template data including content and metadata.

### 2. Download Template
**Endpoint:** `GET /api/template/download?id=<uuid>&format=<json|txt>`

Downloads a template as a JSON or text file.

### 3. Export Templates
**Endpoint:** `POST /api/template/export`

Exports multiple templates as a JSON bundle.

### 4. Import Templates
**Endpoint:** `POST /api/template/import`

Imports templates from a JSON bundle.

---

## Client-Side API Functions (templateApi.ts)

### Core Operations
| Function | Description | Returns |
|----------|-------------|---------|
| `viewTemplate(id)` | Fetch complete template data | `Promise<{template, chatbot_id, instance_id}>` |
| `downloadTemplate(id, format)` | Download template as file | `Promise<void>` |
| `exportTemplates(ids)` | Export multiple templates | `Promise<void>` |
| `importTemplates(chatbotId, templates, overwrite)` | Import templates | `Promise<ImportResult>` |
| `duplicateTemplate(id, newName)` | Create a copy of template | `Promise<ChatbotTemplate>` |
| `cloneTemplateToAnotherChatbot(id, targetId)` | Clone to another chatbot | `Promise<ChatbotTemplate>` |

### Existing Functions
| Function | Description |
|----------|-------------|
| `fetchChatbotTemplates(chatbotId)` | Fetch all templates for chatbot |
| `createChatbotTemplate(input)` | Create new template |
| `updateChatbotTemplate(id, patch)` | Update existing template |
| `deleteChatbotTemplate(id)` | Soft delete template |
| `publishedTemplatesFromRows(rows)` | Convert rows to published format |

---

## Helper Functions (templateHelpers.ts)

### Template Information
| Function | Description | Returns |
|----------|-------------|---------|
| `getTemplatePreview(template, maxLength)` | Get preview text | `string` |
| `getTemplateSize(template)` | Get content size in bytes | `number` |
| `formatTemplateSize(bytes)` | Format size as readable string | `string` |

### Validation
| Function | Description | Returns |
|----------|-------------|---------|
| `validateTemplateKey(key)` | Validate key format | `{valid: boolean, error?: string}` |
| `validateTemplateName(name)` | Validate name format | `{valid: boolean, error?: string}` |

### Search & Filter
| Function | Description | Returns |
|----------|-------------|---------|
| `searchTemplates(templates, query, kind?)` | Search templates | `ChatbotTemplate[]` |
| `sortTemplates(templates, sortBy, order)` | Sort templates | `ChatbotTemplate[]` |
| `groupTemplatesByKind(templates)` | Group by kind | `Record<string, ChatbotTemplate[]>` |

### Statistics
| Function | Description | Returns |
|----------|-------------|---------|
| `getTemplateStats(templates)` | Get statistics | `{total, byKind, totalSize, averageSize}` |
| `getRecentlyUpdatedTemplates(templates, limit)` | Get recently updated | `ChatbotTemplate[]` |

### Template Lookup
| Function | Description | Returns |
|----------|-------------|---------|
| `findTemplateByKey(templates, key)` | Find by key | `ChatbotTemplate \| undefined` |
| `findTemplatesUsingTemplate(templates, key)` | Find dependents | `ChatbotTemplate[]` |

### Dependency Analysis
| Function | Description | Returns |
|----------|-------------|---------|
| `getTemplateDependencies(template)` | Get dependencies | `string[]` |
| `hasCircularDependency(template, all)` | Check circular deps | `boolean` |

### File Operations
| Function | Description | Returns |
|----------|-------------|---------|
| `readTemplateFromFile(file)` | Read from file | `Promise<{templates, version?}>` |

---

## React Hooks (useTemplateActions.ts)

### useTemplateActions(chatbotId?)
Returns object with methods:
- `view(id)` - View template
- `download(id, format)` - Download template
- `export(ids)` - Export templates
- `import(chatbotId, templates, overwrite)` - Import templates
- `duplicate(id, newName)` - Duplicate template
- `clone(id, targetId)` - Clone template
- `isLoading` - Loading state
- `error` - Error state

### useBulkTemplateActions()
Returns object with methods:
- `bulkExport(ids)` - Export multiple
- `bulkDelete(ids)` - Delete multiple
- `selectTemplates(templates, filter)` - Select with filter
- `isLoading` - Loading state
- `error` - Error state

---

## Existing Template Functions (templateModel.ts)

### Constants
- `TEMPLATE_KINDS` - All template kinds
- `TEMPLATE_KIND_META` - Metadata for each kind
- `WEEKDAYS` - Days of the week

### Template Creation
| Function | Description |
|----------|-------------|
| `emptyTemplateContent(kind)` | Create empty content |
| `starterTemplateContent(kind)` | Create sample content |
| `emptyStoreCategory(name)` | Create empty category |
| `emptyStoreProduct(categoryId)` | Create empty product |
| `emptyStoreFee(name)` | Create empty fee |

### Template Processing
| Function | Description |
|----------|-------------|
| `parseTemplateContent(kind, raw)` | Parse raw content |
| `renderTemplateText(kind, content)` | Render as text |
| `formatTemplateMoney(amount, currency)` | Format money |
| `templateExprValue(args)` | Create expression value |

### Template Utilities
| Function | Description |
|----------|-------------|
| `insertSnippet(key, kind)` | Create insert snippet |
| `keyFromTemplateName(name, kind)` | Generate key from name |
| `isTemplateKind(value)` | Type guard for kind |
| `templatesExprMap(rows)` | Create expression map |

### Shopping Cart Functions
| Function | Description |
|----------|-------------|
| `buildShopCart(catalog, qtyById)` | Build cart from quantities |
| `qtyMapFromShopAnswer(answer)` | Extract quantities from answer |
| `cartCatalogFromExpr(value)` | Get catalog from expression |
| `shopCartDisplayText(cart)` | Format cart display text |
| `productMaxQty(product)` | Get max quantity for product |

### Receipt Functions
| Function | Description |
|----------|-------------|
| `renderReceiptFromCart(content, cart, payment)` | Render receipt |
| `renderReceiptHtml(text)` | Convert to HTML |
| `findCartInVars(vars)` | Find cart in variables |
| `findPaymentInVars(vars, steps)` | Find payment in variables |

---

## Quick Function Count

- **API Endpoints:** 4
- **API Functions:** 6 new + 5 existing = 11 total
- **Helper Functions:** 17
- **React Hooks:** 2 (with multiple methods each)
- **Model Functions:** 25+
- **Total Functions:** 55+ functions available

---

## Common Use Cases

### 1. Download a Template
```typescript
import { downloadTemplate } from '@/features/templates/templateApi'
await downloadTemplate(templateId, 'json')
```

### 2. Search Templates
```typescript
import { searchTemplates, sortTemplates } from '@/features/templates/templateHelpers'
const results = searchTemplates(templates, 'email')
const sorted = sortTemplates(results, 'name', 'asc')
```

### 3. Export Multiple Templates
```typescript
import { exportTemplates } from '@/features/templates/templateApi'
await exportTemplates(['id1', 'id2', 'id3'])
```

### 4. Import with Validation
```typescript
import { importTemplates, readTemplateFromFile } from '@/features/templates/templateApi'
import { validateTemplateKey } from '@/features/templates/templateHelpers'

const { templates } = await readTemplateFromFile(file)
const validated = templates.filter(t => validateTemplateKey(t.key).valid)
const result = await importTemplates(chatbotId, validated, false)
```

### 5. Analyze Dependencies
```typescript
import { getTemplateDependencies, hasCircularDependency } from '@/features/templates/templateHelpers'

const deps = getTemplateDependencies(template)
const circular = hasCircularDependency(template, allTemplates)
```

---

## See Also

- **[TEMPLATE_HANDLERS.md](./TEMPLATE_HANDLERS.md)** - Complete documentation with detailed examples
- **[README.md](./README.md)** - Quick start guide
- **[templateHandlers.check.ts](./templateHandlers.check.ts)** - Test suite
