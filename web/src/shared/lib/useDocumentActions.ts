/**
 * React Hook for Document Operations
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { DocumentKind } from './documentApi'
import {
  viewDocument,
  downloadDocument,
  openDocument,
  renameDocument,
  copyDocument,
  moveDocument,
  deleteDocument,
  listDocuments,
  uploadDocument,
} from './documentApi'

export const documentQueryKey = (instanceId: string, chatbotId: string, kind: DocumentKind) =>
  ['documents', instanceId, chatbotId, kind] as const

export function useDocuments(instanceId: string, chatbotId: string, kind: DocumentKind = 'media') {
  return useQuery({
    queryKey: documentQueryKey(instanceId, chatbotId, kind),
    queryFn: () => listDocuments(instanceId, chatbotId, kind),
    enabled: !!instanceId && !!chatbotId,
  })
}

export function useDocumentActions(instanceId: string, chatbotId: string, kind: DocumentKind = 'media') {
  const qc = useQueryClient()

  const view = useMutation({
    mutationFn: (filename: string) => viewDocument(instanceId, chatbotId, filename, kind),
  })

  const download = useMutation({
    mutationFn: (filename: string) => downloadDocument(instanceId, chatbotId, filename, kind),
  })

  const open = useMutation({
    mutationFn: async (filename: string) => {
      openDocument(instanceId, chatbotId, filename, kind)
    },
  })

  const rename = useMutation({
    mutationFn: ({ oldName, newName }: { oldName: string; newName: string }) =>
      renameDocument(instanceId, chatbotId, oldName, newName, kind),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: documentQueryKey(instanceId, chatbotId, kind) })
    },
  })

  const copy = useMutation({
    mutationFn: ({ filename, newName }: { filename: string; newName?: string }) =>
      copyDocument(instanceId, chatbotId, filename, newName, kind),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: documentQueryKey(instanceId, chatbotId, kind) })
    },
  })

  const move = useMutation({
    mutationFn: ({
      filename,
      targetChatbotId,
      targetKind,
    }: {
      filename: string
      targetChatbotId: string
      targetKind: DocumentKind
    }) => moveDocument(instanceId, chatbotId, filename, targetChatbotId, kind, targetKind),
    onSuccess: async (_, variables) => {
      await qc.invalidateQueries({ queryKey: documentQueryKey(instanceId, chatbotId, kind) })
      await qc.invalidateQueries({
        queryKey: documentQueryKey(instanceId, variables.targetChatbotId, variables.targetKind),
      })
    },
  })

  const remove = useMutation({
    mutationFn: (filename: string) => deleteDocument(instanceId, chatbotId, filename, kind),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: documentQueryKey(instanceId, chatbotId, kind) })
    },
  })

  const upload = useMutation({
    mutationFn: (file: File) => uploadDocument(file, instanceId, chatbotId, kind),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: documentQueryKey(instanceId, chatbotId, kind) })
    },
  })

  const viewByName = useCallback(
    async (filename: string) => {
      return view.mutateAsync(filename)
    },
    [view],
  )

  const downloadByName = useCallback(
    async (filename: string) => {
      return download.mutateAsync(filename)
    },
    [download],
  )

  const openByName = useCallback(
    async (filename: string) => {
      return open.mutateAsync(filename)
    },
    [open],
  )

  const renameFile = useCallback(
    async (oldName: string, newName: string) => {
      return rename.mutateAsync({ oldName, newName })
    },
    [rename],
  )

  const copyFile = useCallback(
    async (filename: string, newName?: string) => {
      return copy.mutateAsync({ filename, newName })
    },
    [copy],
  )

  const moveFile = useCallback(
    async (filename: string, targetChatbotId: string, targetKind: DocumentKind) => {
      return move.mutateAsync({ filename, targetChatbotId, targetKind })
    },
    [move],
  )

  const deleteFile = useCallback(
    async (filename: string) => {
      return remove.mutateAsync(filename)
    },
    [remove],
  )

  const uploadFile = useCallback(
    async (file: File) => {
      return upload.mutateAsync(file)
    },
    [upload],
  )

  return {
    view: viewByName,
    download: downloadByName,
    open: openByName,
    rename: renameFile,
    copy: copyFile,
    move: moveFile,
    delete: deleteFile,
    upload: uploadFile,
    isLoading:
      view.isPending ||
      download.isPending ||
      open.isPending ||
      rename.isPending ||
      copy.isPending ||
      move.isPending ||
      remove.isPending ||
      upload.isPending,
    error:
      view.error ||
      download.error ||
      open.error ||
      rename.error ||
      copy.error ||
      move.error ||
      remove.error ||
      upload.error,
  }
}

export function useBulkDocumentActions(instanceId: string, chatbotId: string, kind: DocumentKind = 'media') {
  const qc = useQueryClient()

  const bulkDelete = useMutation({
    mutationFn: async (filenames: string[]) => {
      const promises = filenames.map((filename) => deleteDocument(instanceId, chatbotId, filename, kind))
      return Promise.all(promises)
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: documentQueryKey(instanceId, chatbotId, kind) })
    },
  })

  const bulkUpload = useMutation({
    mutationFn: async (files: File[]) => {
      const promises = files.map((file) => uploadDocument(file, instanceId, chatbotId, kind))
      return Promise.all(promises)
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: documentQueryKey(instanceId, chatbotId, kind) })
    },
  })

  return {
    bulkDelete: bulkDelete.mutateAsync,
    bulkUpload: bulkUpload.mutateAsync,
    isLoading: bulkDelete.isPending || bulkUpload.isPending,
    error: bulkDelete.error || bulkUpload.error,
  }
}
