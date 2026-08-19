# Template Handler Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TEMPLATE HANDLER SYSTEM                        │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT SIDE (React)                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  React Components (e.g., TemplatesPage.tsx)                │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                             │                                        │
│                             ↓                                        │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  useTemplateActions Hook                                    │    │
│  │  ┌──────────────────────────────────────────────────────┐  │    │
│  │  │ • view(id)                                           │  │    │
│  │  │ • download(id, format)                               │  │    │
│  │  │ • export(ids)                                        │  │    │
│  │  │ • import(chatbotId, templates, overwrite)            │  │    │
│  │  │ • duplicate(id, newName)                             │  │    │
│  │  │ • clone(id, targetChatbotId)                         │  │    │
│  │  └──────────────────────────────────────────────────────┘  │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                             │                                        │
│                             ↓                                        │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  templateApi.ts (Client API Functions)                      │    │
│  │  ┌──────────────────────────────────────────────────────┐  │    │
│  │  │ • viewTemplate(id)                                   │  │    │
│  │  │ • downloadTemplate(id, format)                       │  │    │
│  │  │ • exportTemplates(ids)                               │  │    │
│  │  │ • importTemplates(chatbotId, templates, overwrite)   │  │    │
│  │  │ • duplicateTemplate(id, newName)                     │  │    │
│  │  │ • cloneTemplateToAnotherChatbot(id, targetId)        │  │    │
│  │  └──────────────────────────────────────────────────────┘  │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                             │                                        │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  templateHelpers.ts (Utility Functions)                     │    │
│  │  ┌──────────────────────────────────────────────────────┐  │    │
│  │  │ Information:                                         │  │    │
│  │  │ • getTemplatePreview(), getTemplateSize()            │  │    │
│  │  │ • formatTemplateSize()                               │  │    │
│  │  │                                                      │  │    │
│  │  │ Validation:                                          │  │    │
│  │  │ • validateTemplateKey(), validateTemplateName()      │  │    │
│  │  │                                                      │  │    │
│  │  │ Search & Filter:                                     │  │    │
│  │  │ • searchTemplates(), sortTemplates()                 │  │    │
│  │  │ • groupTemplatesByKind()                             │  │    │
│  │  │                                                      │  │    │
│  │  │ Statistics:                                          │  │    │
│  │  │ • getTemplateStats()                                 │  │    │
│  │  │ • getRecentlyUpdatedTemplates()                      │  │    │
│  │  │                                                      │  │    │
│  │  │ Dependencies:                                        │  │    │
│  │  │ • getTemplateDependencies()                          │  │    │
│  │  │ • hasCircularDependency()                            │  │    │
│  │  │ • findTemplatesUsingTemplate()                       │  │    │
│  │  │                                                      │  │    │
│  │  │ File Operations:                                     │  │    │
│  │  │ • readTemplateFromFile()                             │  │    │
│  │  └──────────────────────────────────────────────────────┘  │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                             │                                        │
└─────────────────────────────┼────────────────────────────────────────┘
                              │
                              │ HTTP Requests
                              │ (fetch API)
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         SERVER SIDE (PHP)                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  API Router (api/index.php)                                 │    │
│  │  ┌──────────────────────────────────────────────────────┐  │    │
│  │  │ Route Mappings:                                      │  │    │
│  │  │ • /template/view      → view.php                     │  │    │
│  │  │ • /template/download  → download.php                 │  │    │
│  │  │ • /template/export    → export.php                   │  │    │
│  │  │ • /template/import    → import.php                   │  │    │
│  │  └──────────────────────────────────────────────────────┘  │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                             │                                        │
│                             ↓                                        │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  API Endpoints (api/template/)                              │    │
│  │                                                              │    │
│  │  ┌────────────────────────────────────────────────────┐    │    │
│  │  │  view.php                                          │    │    │
│  │  │  • GET /api/template/view?id=<uuid>                │    │    │
│  │  │  • Returns: full template data + metadata          │    │    │
│  │  └────────────────────────────────────────────────────┘    │    │
│  │                                                              │    │
│  │  ┌────────────────────────────────────────────────────┐    │    │
│  │  │  download.php                                      │    │    │
│  │  │  • GET /api/template/download?id=<uuid>&format=... │    │    │
│  │  │  • Supports: JSON and TXT formats                  │    │    │
│  │  │  • Returns: file download response                 │    │    │
│  │  └────────────────────────────────────────────────────┘    │    │
│  │                                                              │    │
│  │  ┌────────────────────────────────────────────────────┐    │    │
│  │  │  export.php                                        │    │    │
│  │  │  • POST /api/template/export                       │    │    │
│  │  │  • Body: { template_ids: [...] }                   │    │    │
│  │  │  • Returns: JSON bundle of templates               │    │    │
│  │  └────────────────────────────────────────────────────┘    │    │
│  │                                                              │    │
│  │  ┌────────────────────────────────────────────────────┐    │    │
│  │  │  import.php                                        │    │    │
│  │  │  • POST /api/template/import                       │    │    │
│  │  │  • Body: { chatbot_id, templates, overwrite }      │    │    │
│  │  │  • Returns: import results with stats              │    │    │
│  │  └────────────────────────────────────────────────────┘    │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                             │                                        │
│                             ↓                                        │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Authentication & Authorization (Auth.php)                  │    │
│  │  • Verify user authentication                               │    │
│  │  • Check instance membership                                │    │
│  │  • Validate permissions (editor role for writes)            │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                             │                                        │
│                             ↓                                        │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Database Access (SupabaseRest.php)                         │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                             │                                        │
└─────────────────────────────┼────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                        DATABASE (Supabase)                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Tables:                                                     │    │
│  │  • chatbot_templates (main template storage)                │    │
│  │  • chatbots (chatbot references)                             │    │
│  │  • instances (instance/organization data)                    │    │
│  │  • instance_members (permissions)                            │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Row Level Security (RLS):                                   │    │
│  │  • templates_select_member: Read access for members         │    │
│  │  • templates_write_editor: Write access for editors         │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                          DATA FLOW EXAMPLES                           │
└─────────────────────────────────────────────────────────────────────┘

Example 1: Download Template
────────────────────────────
Component → Hook.download('id', 'json')
         → API.downloadTemplate('id', 'json')
         → GET /api/template/download?id=...&format=json
         → Auth.verify()
         → DB.fetch template
         → DB.verify permissions
         → Response: file download (browser prompt)

Example 2: Import Templates
────────────────────────────
Component → Hook.import(chatbotId, templates, false)
         → API.importTemplates(chatbotId, templates, false)
         → POST /api/template/import
         → Auth.verify()
         → DB.check existing templates
         → DB.insert/update templates
         → Response: { imported: [...], skipped: [...], errors: [...] }
         → Hook invalidates cache
         → Component re-fetches updated list

Example 3: Search & Filter (Client-side only)
──────────────────────────────────────────────
Component → searchTemplates(templates, 'email', 'email')
         → Filter logic (no API call)
         → sortTemplates(results, 'name', 'asc')
         → Sort logic (no API call)
         → Return: filtered & sorted array

Example 4: Dependency Analysis (Client-side only)
──────────────────────────────────────────────────
Component → getTemplateDependencies(template)
         → Parse template content for {{templates.*.field}}
         → Return: ['dep1', 'dep2']
         → hasCircularDependency(template, allTemplates)
         → Recursive dependency check
         → Return: true/false


┌─────────────────────────────────────────────────────────────────────┐
│                        FUNCTION CATEGORIES                            │
└─────────────────────────────────────────────────────────────────────┘

SERVER FUNCTIONS (4)
├── view.php          - View single template
├── download.php      - Download as file
├── export.php        - Export multiple
└── import.php        - Import from bundle

CLIENT API FUNCTIONS (6)
├── viewTemplate()               - Fetch template data
├── downloadTemplate()           - Download as file
├── exportTemplates()            - Export multiple
├── importTemplates()            - Import from data
├── duplicateTemplate()          - Create copy
└── cloneTemplateToAnotherChatbot() - Clone to other bot

HELPER FUNCTIONS (17)
├── Information (3)
│   ├── getTemplatePreview()
│   ├── getTemplateSize()
│   └── formatTemplateSize()
├── Validation (2)
│   ├── validateTemplateKey()
│   └── validateTemplateName()
├── Search & Filter (3)
│   ├── searchTemplates()
│   ├── sortTemplates()
│   └── groupTemplatesByKind()
├── Statistics (2)
│   ├── getTemplateStats()
│   └── getRecentlyUpdatedTemplates()
├── Lookup (2)
│   ├── findTemplateByKey()
│   └── findTemplatesUsingTemplate()
├── Dependencies (2)
│   ├── getTemplateDependencies()
│   └── hasCircularDependency()
└── File Operations (1)
    └── readTemplateFromFile()

REACT HOOKS (2)
├── useTemplateActions()     - CRUD operations with cache
└── useBulkTemplateActions() - Bulk operations

EXISTING MODEL FUNCTIONS (25+)
└── Template creation, parsing, rendering, and shopping cart functions
