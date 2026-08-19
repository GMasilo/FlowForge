/**
 * Document Helper Functions
 * Utility functions for document file management
 */

import type { DocumentFile } from './documentApi'

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts[parts.length - 1]!.toLowerCase() : ''
}

/**
 * Get filename without extension
 */
export function getFileNameWithoutExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  return lastDot > 0 ? filename.substring(0, lastDot) : filename
}

/**
 * Check if file is an image
 */
export function isImageFile(filename: string): boolean {
  const ext = getFileExtension(filename)
  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)
}

/**
 * Check if file is a video
 */
export function isVideoFile(filename: string): boolean {
  const ext = getFileExtension(filename)
  return ['mp4', 'webm', 'ogg', 'mov', 'avi'].includes(ext)
}

/**
 * Check if file is audio
 */
export function isAudioFile(filename: string): boolean {
  const ext = getFileExtension(filename)
  return ['mp3', 'wav', 'ogg', 'aac', 'm4a'].includes(ext)
}

/**
 * Check if file is a PDF
 */
export function isPdfFile(filename: string): boolean {
  return getFileExtension(filename) === 'pdf'
}

/**
 * Check if file is an Office document
 */
export function isOfficeFile(filename: string): boolean {
  const ext = getFileExtension(filename)
  return ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)
}

/**
 * Check if file is a text file
 */
export function isTextFile(filename: string): boolean {
  const ext = getFileExtension(filename)
  return ['txt', 'md', 'csv', 'json', 'xml', 'html', 'css', 'js', 'ts'].includes(ext)
}

/**
 * Get document type category
 */
export function getDocumentCategory(filename: string): string {
  if (isImageFile(filename)) return 'Image'
  if (isVideoFile(filename)) return 'Video'
  if (isAudioFile(filename)) return 'Audio'
  if (isPdfFile(filename)) return 'PDF'
  if (isOfficeFile(filename)) return 'Document'
  if (isTextFile(filename)) return 'Text'
  return 'File'
}

/**
 * Get icon name for file type (for lucide-react icons)
 */
export function getDocumentIcon(filename: string): string {
  if (isImageFile(filename)) return 'Image'
  if (isVideoFile(filename)) return 'Video'
  if (isAudioFile(filename)) return 'Music'
  if (isPdfFile(filename)) return 'FileText'
  if (isOfficeFile(filename)) return 'FileSpreadsheet'
  if (isTextFile(filename)) return 'FileCode'
  return 'File'
}

/**
 * Validate filename
 */
export function validateFilename(filename: string): { valid: boolean; error?: string } {
  if (!filename.trim()) {
    return { valid: false, error: 'Filename cannot be empty' }
  }

  if (filename.length > 200) {
    return { valid: false, error: 'Filename must be 200 characters or less' }
  }

  if (filename.includes('/') || filename.includes('\\')) {
    return { valid: false, error: 'Filename cannot contain / or \\' }
  }

  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.[A-Za-z0-9]+$/.test(filename)) {
    return { valid: false, error: 'Invalid filename format' }
  }

  const ext = getFileExtension(filename)
  const allowedExtensions = [
    'jpg', 'jpeg', 'png', 'gif', 'webp',
    'mp3', 'wav', 'ogg',
    'mp4', 'webm',
    'pdf', 'txt', 'csv',
    'doc', 'docx', 'xls', 'xlsx',
    'zip'
  ]

  if (!allowedExtensions.includes(ext)) {
    return { valid: false, error: `File type .${ext} is not allowed` }
  }

  return { valid: true }
}

/**
 * Search documents by query
 */
export function searchDocuments(documents: DocumentFile[], query: string): DocumentFile[] {
  const q = query.trim().toLowerCase()
  if (!q) return documents

  return documents.filter((doc) => {
    return (
      doc.filename.toLowerCase().includes(q) ||
      doc.key.toLowerCase().includes(q) ||
      doc.mime.toLowerCase().includes(q)
    )
  })
}

/**
 * Sort documents
 */
export function sortDocuments(
  documents: DocumentFile[],
  sortBy: 'name' | 'size' | 'date' | 'type',
  order: 'asc' | 'desc' = 'asc',
): DocumentFile[] {
  const sorted = [...documents].sort((a, b) => {
    let comparison = 0

    switch (sortBy) {
      case 'name':
        comparison = a.filename.localeCompare(b.filename)
        break
      case 'size':
        comparison = a.size - b.size
        break
      case 'date':
        comparison = new Date(a.modified_at).getTime() - new Date(b.modified_at).getTime()
        break
      case 'type':
        comparison = a.mime.localeCompare(b.mime)
        break
    }

    return order === 'asc' ? comparison : -comparison
  })

  return sorted
}

/**
 * Filter documents by type
 */
export function filterDocumentsByType(
  documents: DocumentFile[],
  type: 'all' | 'image' | 'video' | 'audio' | 'pdf' | 'document' | 'text',
): DocumentFile[] {
  if (type === 'all') return documents

  return documents.filter((doc) => {
    switch (type) {
      case 'image':
        return isImageFile(doc.filename)
      case 'video':
        return isVideoFile(doc.filename)
      case 'audio':
        return isAudioFile(doc.filename)
      case 'pdf':
        return isPdfFile(doc.filename)
      case 'document':
        return isOfficeFile(doc.filename)
      case 'text':
        return isTextFile(doc.filename)
      default:
        return true
    }
  })
}

/**
 * Group documents by type
 */
export function groupDocumentsByType(documents: DocumentFile[]): Record<string, DocumentFile[]> {
  const grouped: Record<string, DocumentFile[]> = {
    images: [],
    videos: [],
    audio: [],
    pdfs: [],
    documents: [],
    text: [],
    other: [],
  }

  for (const doc of documents) {
    if (isImageFile(doc.filename)) {
      grouped.images.push(doc)
    } else if (isVideoFile(doc.filename)) {
      grouped.videos.push(doc)
    } else if (isAudioFile(doc.filename)) {
      grouped.audio.push(doc)
    } else if (isPdfFile(doc.filename)) {
      grouped.pdfs.push(doc)
    } else if (isOfficeFile(doc.filename)) {
      grouped.documents.push(doc)
    } else if (isTextFile(doc.filename)) {
      grouped.text.push(doc)
    } else {
      grouped.other.push(doc)
    }
  }

  return grouped
}

/**
 * Get document statistics
 */
export function getDocumentStats(documents: DocumentFile[]) {
  const grouped = groupDocumentsByType(documents)
  const totalSize = documents.reduce((sum, doc) => sum + doc.size, 0)

  return {
    total: documents.length,
    byType: {
      images: grouped.images.length,
      videos: grouped.videos.length,
      audio: grouped.audio.length,
      pdfs: grouped.pdfs.length,
      documents: grouped.documents.length,
      text: grouped.text.length,
      other: grouped.other.length,
    },
    totalSize,
    averageSize: documents.length > 0 ? totalSize / documents.length : 0,
    formattedTotalSize: formatFileSize(totalSize),
    formattedAverageSize: formatFileSize(documents.length > 0 ? totalSize / documents.length : 0),
  }
}

/**
 * Format date
 */
export function formatDocumentDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return 'Today'
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `${months} month${months > 1 ? 's' : ''} ago`
  } else {
    const years = Math.floor(diffDays / 365)
    return `${years} year${years > 1 ? 's' : ''} ago`
  }
}

/**
 * Generate unique filename if name exists
 */
export function generateUniqueFilename(existingFiles: DocumentFile[], desiredName: string): string {
  const ext = getFileExtension(desiredName)
  const stem = getFileNameWithoutExtension(desiredName)

  let filename = desiredName
  let counter = 1

  while (existingFiles.some((f) => f.filename === filename)) {
    filename = `${stem}_${counter}.${ext}`
    counter++
  }

  return filename
}
