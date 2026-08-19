/** Document file handlers — re-export entry point. */
export {
  copyDocument,
  createDocumentHandlers,
  deleteDocument,
  downloadDocument,
  getDocumentUrl,
  getDownloadUrl,
  listDocuments,
  moveDocument,
  openDocument,
  renameDocument,
  uploadDocument,
  viewDocument,
  type DocumentFile,
  type DocumentHandlers,
  type DocumentInfo,
  type DocumentKind,
  type DocumentScope,
} from '@/shared/lib/documentApi'

export {
  filterDocumentsByType,
  formatDocumentDate,
  formatFileSize,
  generateUniqueFilename,
  getDocumentCategory,
  getDocumentIcon,
  getDocumentStats,
  getFileExtension,
  getFileNameWithoutExtension,
  groupDocumentsByType,
  isAudioFile,
  isImageFile,
  isOfficeFile,
  isPdfFile,
  isTextFile,
  isVideoFile,
  searchDocuments,
  sortDocuments,
  validateFilename,
} from '@/shared/lib/documentHelpers'

export {
  documentQueryKey,
  useBulkDocumentActions,
  useDocumentActions,
  useDocuments,
} from '@/shared/lib/useDocumentActions'
