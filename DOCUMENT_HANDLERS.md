# Document Handler Functions

Comprehensive functions for managing document files (PDFs, images, videos, Office documents, etc.)

## Overview

The document handler system provides server-side API endpoints and client-side utilities for viewing, downloading, uploading, renaming, copying, moving, and deleting document files.

## Server-Side API Endpoints

### 1. View Document
**Endpoint:** `GET /api/document/view`

Get document metadata and preview.

**Query Parameters:**
- `instance_id` (required): Instance UUID
- `chatbot_id` (required): Chatbot UUID
- `name` (required): Filename
- `kind` (optional): `media` or `conversation` (default: `media`)

**Response:**
```json
{
  "ok": true,
  "filename": "report.pdf",
  "key": "report_pdf",
  "kind": "media",
  "size": 1048576,
  "mime": "application/pdf",
  "extension": "pdf",
  "modified_at": "2024-01-01T00:00:00Z",
  "url": "/api/file/get?...",
  "path": "files/.../media/report.pdf",
  "is_image": false,
  "is_video": false,
  "is_audio": false,
  "is_pdf": true,
  "is_text": false,
  "is_office_doc": false,
  "preview": null,
  "image_info": null,
  "readable": true
}
```

### 2. Download Document
**Endpoint:** `GET /api/document/download`

Download document with force-download header.

**Query Parameters:**
- Same as view endpoint

**Response:** File download (browser save dialog)

### 3. Rename Document
**Endpoint:** `POST /api/document/rename`

Rename a document file.

**Request Body:**
```json
{
  "instance_id": "uuid",
  "chatbot_id": "uuid",
  "old_name": "oldfile.pdf",
  "new_name": "newfile.pdf",
  "kind": "media"
}
```

### 4. Copy Document
**Endpoint:** `POST /api/document/copy`

Create a copy of a document.

**Request Body:**
```json
{
  "instance_id": "uuid",
  "chatbot_id": "uuid",
  "name": "document.pdf",
  "new_name": "document_copy.pdf",
  "kind": "media"
}
```

### 5. Move Document
**Endpoint:** `POST /api/document/move`

Move document between chatbots or kinds.

**Request Body:**
```json
{
  "instance_id": "uuid",
  "source_chatbot_id": "uuid",
  "target_chatbot_id": "uuid",
  "name": "document.pdf",
  "source_kind": "media",
  "target_kind": "conversation"
}
```

---

## Client-Side Functions

### API Functions (`documentApi.ts`)

#### `viewDocument(instanceId, chatbotId, filename, kind?)`
Get document metadata and preview.

```typescript
const doc = await viewDocument('instance-id', 'chatbot-id', 'report.pdf')
console.log(doc.size, doc.is_pdf, doc.preview)
```

#### `downloadDocument(instanceId, chatbotId, filename, kind?)`
Download document (triggers browser download).

```typescript
await downloadDocument('instance-id', 'chatbot-id', 'report.pdf')
```

#### `renameDocument(instanceId, chatbotId, oldName, newName, kind?)`
Rename a document.

```typescript
await renameDocument('instance-id', 'chatbot-id', 'old.pdf', 'new.pdf')
```

#### `copyDocument(instanceId, chatbotId, filename, newName?, kind?)`
Copy a document.

```typescript
const result = await copyDocument('instance-id', 'chatbot-id', 'doc.pdf', 'doc_copy.pdf')
```

#### `moveDocument(instanceId, sourceChatbotId, filename, targetChatbotId, sourceKind?, targetKind?)`
Move document to another chatbot or kind.

```typescript
await moveDocument('instance-id', 'source-bot', 'doc.pdf', 'target-bot')
```

#### `deleteDocument(instanceId, chatbotId, filename, kind?)`
Delete a document.

```typescript
await deleteDocument('instance-id', 'chatbot-id', 'doc.pdf')
```

#### `listDocuments(instanceId, chatbotId, kind?)`
List all documents.

```typescript
const docs = await listDocuments('instance-id', 'chatbot-id')
```

#### `uploadDocument(file, instanceId, chatbotId, kind?, sessionId?, nodeKey?)`
Upload a document.

```typescript
const result = await uploadDocument(file, 'instance-id', 'chatbot-id')
```

#### `getDocumentUrl(instanceId, chatbotId, filename, kind?)`
Get URL for inline display.

```typescript
const url = getDocumentUrl('instance-id', 'chatbot-id', 'image.png')
```

#### `getDownloadUrl(instanceId, chatbotId, filename, kind?)`
Get download URL.

```typescript
const url = getDownloadUrl('instance-id', 'chatbot-id', 'doc.pdf')
```

---

### Helper Functions (`documentHelpers.ts`)

#### File Information
- `formatFileSize(bytes)` - Format size as readable string
- `getFileExtension(filename)` - Get file extension
- `getFileNameWithoutExtension(filename)` - Get name without extension
- `getDocumentCategory(filename)` - Get category (Image, Video, etc.)
- `getDocumentIcon(filename)` - Get icon name for file type

#### File Type Checks
- `isImageFile(filename)` - Check if image
- `isVideoFile(filename)` - Check if video
- `isAudioFile(filename)` - Check if audio
- `isPdfFile(filename)` - Check if PDF
- `isOfficeFile(filename)` - Check if Office document
- `isTextFile(filename)` - Check if text file

#### Validation
- `validateFilename(filename)` - Validate filename format

#### Search & Filter
- `searchDocuments(documents, query)` - Search by query
- `sortDocuments(documents, sortBy, order)` - Sort documents
- `filterDocumentsByType(documents, type)` - Filter by type
- `groupDocumentsByType(documents)` - Group by type

#### Statistics
- `getDocumentStats(documents)` - Get comprehensive stats

#### Utilities
- `formatDocumentDate(dateString)` - Format date as relative
- `generateUniqueFilename(existingFiles, desiredName)` - Generate unique name

---

### React Hooks (`useDocumentActions.ts`)

#### `useDocuments(instanceId, chatbotId, kind?)`
Query hook to fetch documents.

```typescript
const { data: documents, isLoading } = useDocuments(instanceId, chatbotId)
```

#### `useDocumentActions(instanceId, chatbotId, kind?)`
Hook for document operations with cache invalidation.

```typescript
function MyComponent() {
  const { view, download, rename, copy, move, delete: deleteDoc, upload } = 
    useDocumentActions(instanceId, chatbotId)
  
  const handleView = async () => {
    const doc = await view('document.pdf')
    console.log(doc)
  }
  
  const handleDownload = async () => {
    await download('document.pdf')
  }
  
  const handleRename = async () => {
    await rename('old.pdf', 'new.pdf')
  }
  
  return (...)
}
```

#### `useBulkDocumentActions(instanceId, chatbotId, kind?)`
Hook for bulk operations.

```typescript
const { bulkDelete, bulkUpload } = useBulkDocumentActions(instanceId, chatbotId)

await bulkDelete(['file1.pdf', 'file2.pdf'])
await bulkUpload([file1, file2, file3])
```

---

## Usage Examples

### Example 1: View Document Details
```typescript
import { viewDocument } from '@/shared/lib/documentApi'

const doc = await viewDocument('instance-id', 'chatbot-id', 'report.pdf')
console.log(`Size: ${doc.size}, Type: ${doc.mime}`)
if (doc.is_pdf) {
  console.log('This is a PDF document')
}
```

### Example 2: Download Document
```typescript
import { downloadDocument } from '@/shared/lib/documentApi'

await downloadDocument('instance-id', 'chatbot-id', 'report.pdf')
// Browser download dialog appears
```

### Example 3: Upload and List Documents
```typescript
import { uploadDocument, listDocuments } from '@/shared/lib/documentApi'

// Upload
const result = await uploadDocument(file, 'instance-id', 'chatbot-id')
console.log('Uploaded:', result.filename)

// List all
const documents = await listDocuments('instance-id', 'chatbot-id')
console.log(`Total documents: ${documents.length}`)
```

### Example 4: Search and Filter
```typescript
import { listDocuments } from '@/shared/lib/documentApi'
import { searchDocuments, filterDocumentsByType, sortDocuments } from '@/shared/lib/documentHelpers'

const docs = await listDocuments('instance-id', 'chatbot-id')
const searched = searchDocuments(docs, 'report')
const pdfs = filterDocumentsByType(searched, 'pdf')
const sorted = sortDocuments(pdfs, 'date', 'desc')
```

### Example 5: React Component
```typescript
import { useDocuments, useDocumentActions } from '@/shared/lib/useDocumentActions'
import { formatFileSize } from '@/shared/lib/documentHelpers'

function DocumentList({ instanceId, chatbotId }) {
  const { data: documents, isLoading } = useDocuments(instanceId, chatbotId)
  const { download, delete: deleteDoc } = useDocumentActions(instanceId, chatbotId)
  
  if (isLoading) return <div>Loading...</div>
  
  return (
    <div>
      {documents?.map(doc => (
        <div key={doc.filename}>
          <span>{doc.filename}</span>
          <span>{formatFileSize(doc.size)}</span>
          <button onClick={() => download(doc.filename)}>Download</button>
          <button onClick={() => deleteDoc(doc.filename)}>Delete</button>
        </div>
      ))}
    </div>
  )
}
```

### Example 6: File Upload with Progress
```typescript
import { useDocumentActions } from '@/shared/lib/useDocumentActions'
import { validateFilename } from '@/shared/lib/documentHelpers'

function FileUploader({ instanceId, chatbotId }) {
  const { upload, isLoading } = useDocumentActions(instanceId, chatbotId)
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const validation = validateFilename(file.name)
    if (!validation.valid) {
      alert(validation.error)
      return
    }
    
    try {
      const result = await upload(file)
      console.log('Uploaded:', result.filename)
    } catch (error) {
      console.error('Upload failed:', error)
    }
  }
  
  return (
    <input 
      type="file" 
      onChange={handleFileChange} 
      disabled={isLoading}
    />
  )
}
```

---

## Supported File Types

- **Images:** jpg, jpeg, png, gif, webp
- **Audio:** mp3, wav, ogg
- **Video:** mp4, webm
- **Documents:** pdf, txt, csv
- **Office:** doc, docx, xls, xlsx
- **Archives:** zip

---

## Security

All endpoints require:
- ✅ User authentication
- ✅ Chatbot access verification
- ✅ File type validation
- ✅ Filename sanitization
- ✅ Size limits (10MB default)
- ✅ MIME type verification

---

## Type Definitions

```typescript
type DocumentKind = 'media' | 'conversation'

interface DocumentInfo {
  filename: string
  key: string
  kind: DocumentKind
  size: number
  mime: string
  extension: string
  modified_at: string
  url: string
  path: string
  is_image: boolean
  is_video: boolean
  is_audio: boolean
  is_pdf: boolean
  is_text: boolean
  is_office_doc: boolean
  preview?: string | null
  image_info?: { width: number; height: number; type: string } | null
  readable: boolean
}

interface DocumentFile {
  filename: string
  key: string
  size: number
  mime: string
  modified_at: string
  url: string
  path: string
}
```
