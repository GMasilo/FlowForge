import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { ChatbotTemplate } from '@/shared/types/database'
import {
  viewTemplate,
  downloadTemplate,
  exportTemplates,
  importTemplates,
  duplicateTemplate,
  cloneTemplateToAnotherChatbot,
  chatbotTemplatesQueryKey,
} from '@/features/templates/templateApi'
import type { TemplateKind, TemplateContent } from '@/features/templates/templateModel'

export function useTemplateActions(chatbotId?: string) {
  const qc = useQueryClient()

  const view = useMutation({
    mutationFn: viewTemplate,
  })

  const download = useMutation({
    mutationFn: ({ templateId, format }: { templateId: string; format?: 'json' | 'txt' }) =>
      downloadTemplate(templateId, format),
  })

  const exportMutation = useMutation({
    mutationFn: exportTemplates,
  })

  const importMutation = useMutation({
    mutationFn: ({
      chatbotId,
      templates,
      overwrite,
    }: {
      chatbotId: string
      templates: Array<{
        key: string
        name: string
        description?: string
        kind: TemplateKind
        content: TemplateContent
      }>
      overwrite?: boolean
    }) => importTemplates(chatbotId, templates, overwrite),
    onSuccess: async (_, variables) => {
      if (variables.chatbotId) {
        await qc.invalidateQueries({ queryKey: chatbotTemplatesQueryKey(variables.chatbotId) })
      }
    },
  })

  const duplicate = useMutation({
    mutationFn: ({ templateId, newName }: { templateId: string; newName?: string }) =>
      duplicateTemplate(templateId, newName),
    onSuccess: async (result) => {
      if (chatbotId) {
        await qc.invalidateQueries({ queryKey: chatbotTemplatesQueryKey(chatbotId) })
      }
    },
  })

  const clone = useMutation({
    mutationFn: ({ templateId, targetChatbotId }: { templateId: string; targetChatbotId: string }) =>
      cloneTemplateToAnotherChatbot(templateId, targetChatbotId),
    onSuccess: async (_, variables) => {
      if (variables.targetChatbotId) {
        await qc.invalidateQueries({ queryKey: chatbotTemplatesQueryKey(variables.targetChatbotId) })
      }
    },
  })

  const viewTemplateById = useCallback(
    async (templateId: string) => {
      return view.mutateAsync(templateId)
    },
    [view],
  )

  const downloadTemplateById = useCallback(
    async (templateId: string, format?: 'json' | 'txt') => {
      return download.mutateAsync({ templateId, format })
    },
    [download],
  )

  const exportTemplatesByIds = useCallback(
    async (templateIds: string[]) => {
      return exportMutation.mutateAsync(templateIds)
    },
    [exportMutation],
  )

  const importTemplatesForChatbot = useCallback(
    async (
      targetChatbotId: string,
      templates: Array<{
        key: string
        name: string
        description?: string
        kind: TemplateKind
        content: TemplateContent
      }>,
      overwrite = false,
    ) => {
      return importMutation.mutateAsync({
        chatbotId: targetChatbotId,
        templates,
        overwrite,
      })
    },
    [importMutation],
  )

  const duplicateTemplateById = useCallback(
    async (templateId: string, newName?: string) => {
      return duplicate.mutateAsync({ templateId, newName })
    },
    [duplicate],
  )

  const cloneTemplateById = useCallback(
    async (templateId: string, targetChatbotId: string) => {
      return clone.mutateAsync({ templateId, targetChatbotId })
    },
    [clone],
  )

  return {
    view: viewTemplateById,
    download: downloadTemplateById,
    export: exportTemplatesByIds,
    import: importTemplatesForChatbot,
    duplicate: duplicateTemplateById,
    clone: cloneTemplateById,
    isLoading:
      view.isPending ||
      download.isPending ||
      exportMutation.isPending ||
      importMutation.isPending ||
      duplicate.isPending ||
      clone.isPending,
    error:
      view.error || download.error || exportMutation.error || importMutation.error || duplicate.error || clone.error,
  }
}

export function useBulkTemplateActions() {
  const qc = useQueryClient()

  const bulkExport = useMutation({
    mutationFn: exportTemplates,
  })

  const bulkDelete = useMutation({
    mutationFn: async (templateIds: string[]) => {
      const promises = templateIds.map((id) =>
        fetch(`/api/template/delete?id=${id}`, {
          method: 'DELETE',
          credentials: 'include',
        }),
      )
      await Promise.all(promises)
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['chatbot-templates'] })
    },
  })

  const selectTemplates = useCallback((templates: ChatbotTemplate[], filter?: (t: ChatbotTemplate) => boolean) => {
    return filter ? templates.filter(filter) : templates
  }, [])

  return {
    bulkExport: bulkExport.mutateAsync,
    bulkDelete: bulkDelete.mutateAsync,
    selectTemplates,
    isLoading: bulkExport.isPending || bulkDelete.isPending,
    error: bulkExport.error || bulkDelete.error,
  }
}
