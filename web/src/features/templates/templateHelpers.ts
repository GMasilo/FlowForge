import type { ChatbotTemplate } from '@/shared/types/database'
import {
  type TemplateKind,
  type TemplateContent,
  parseTemplateContent,
  renderTemplateText,
} from '@/features/templates/templateModel'

export function getTemplatePreview(template: ChatbotTemplate, maxLength = 200): string {
  const content = parseTemplateContent(template.kind as TemplateKind, template.content)
  const text = renderTemplateText(template.kind as TemplateKind, content)
  return text.replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

export function getTemplateSize(template: ChatbotTemplate): number {
  return JSON.stringify(template.content).length
}

export function formatTemplateSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function validateTemplateKey(key: string): { valid: boolean; error?: string } {
  if (!key.trim()) {
    return { valid: false, error: 'Key cannot be empty' }
  }
  
  if (!/^[A-Za-z]/.test(key)) {
    return { valid: false, error: 'Key must start with a letter' }
  }
  
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) {
    return { valid: false, error: 'Key can only contain letters, numbers, and underscores' }
  }
  
  if (key.length > 48) {
    return { valid: false, error: 'Key must be 48 characters or less' }
  }
  
  return { valid: true }
}

export function validateTemplateName(name: string): { valid: boolean; error?: string } {
  if (!name.trim()) {
    return { valid: false, error: 'Name cannot be empty' }
  }
  
  if (name.trim().length < 2) {
    return { valid: false, error: 'Name must be at least 2 characters' }
  }
  
  if (name.length > 100) {
    return { valid: false, error: 'Name must be 100 characters or less' }
  }
  
  return { valid: true }
}

export function searchTemplates(
  templates: ChatbotTemplate[],
  query: string,
  kindFilter?: TemplateKind | 'all',
): ChatbotTemplate[] {
  const q = query.trim().toLowerCase()
  
  return templates.filter((template) => {
    if (kindFilter && kindFilter !== 'all' && template.kind !== kindFilter) {
      return false
    }
    
    if (!q) return true
    
    const searchIn = [
      template.name,
      template.key,
      template.description ?? '',
      getTemplatePreview(template),
    ].join(' ').toLowerCase()
    
    return searchIn.includes(q)
  })
}

export function sortTemplates(
  templates: ChatbotTemplate[],
  sortBy: 'name' | 'key' | 'kind' | 'updated' | 'created',
  order: 'asc' | 'desc' = 'asc',
): ChatbotTemplate[] {
  const sorted = [...templates].sort((a, b) => {
    let comparison = 0
    
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name)
        break
      case 'key':
        comparison = a.key.localeCompare(b.key)
        break
      case 'kind':
        comparison = a.kind.localeCompare(b.kind)
        break
      case 'updated':
        comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
        break
      case 'created':
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        break
    }
    
    return order === 'asc' ? comparison : -comparison
  })
  
  return sorted
}

export function groupTemplatesByKind(templates: ChatbotTemplate[]): Record<string, ChatbotTemplate[]> {
  const grouped: Record<string, ChatbotTemplate[]> = {}
  
  for (const template of templates) {
    if (!grouped[template.kind]) {
      grouped[template.kind] = []
    }
    grouped[template.kind]!.push(template)
  }
  
  return grouped
}

export function getTemplateStats(templates: ChatbotTemplate[]) {
  const byKind = groupTemplatesByKind(templates)
  
  return {
    total: templates.length,
    byKind: Object.entries(byKind).map(([kind, items]) => ({
      kind,
      count: items.length,
    })),
    totalSize: templates.reduce((sum, t) => sum + getTemplateSize(t), 0),
    averageSize: templates.length > 0 
      ? templates.reduce((sum, t) => sum + getTemplateSize(t), 0) / templates.length 
      : 0,
  }
}

export function getRecentlyUpdatedTemplates(
  templates: ChatbotTemplate[],
  limit = 5,
): ChatbotTemplate[] {
  return sortTemplates(templates, 'updated', 'desc').slice(0, limit)
}

export function findTemplateByKey(
  templates: ChatbotTemplate[],
  key: string,
): ChatbotTemplate | undefined {
  return templates.find((t) => t.key === key)
}

export function findTemplatesUsingTemplate(
  templates: ChatbotTemplate[],
  targetKey: string,
): ChatbotTemplate[] {
  const pattern = new RegExp(`\\{\\{templates\\.${targetKey}[.\\}]`, 'g')
  
  return templates.filter((template) => {
    const content = JSON.stringify(template.content)
    return pattern.test(content)
  })
}

export function getTemplateDependencies(template: ChatbotTemplate): string[] {
  const content = JSON.stringify(template.content)
  const matches = content.matchAll(/\{\{templates\.([a-zA-Z_][a-zA-Z0-9_]*)/g)
  const dependencies = new Set<string>()
  
  for (const match of matches) {
    if (match[1]) {
      dependencies.add(match[1])
    }
  }
  
  return Array.from(dependencies)
}

export function hasCircularDependency(
  template: ChatbotTemplate,
  allTemplates: ChatbotTemplate[],
): boolean {
  const visited = new Set<string>()
  
  function checkCircular(currentKey: string): boolean {
    if (visited.has(currentKey)) {
      return true
    }
    
    visited.add(currentKey)
    
    const current = findTemplateByKey(allTemplates, currentKey)
    if (!current) {
      return false
    }
    
    const deps = getTemplateDependencies(current)
    for (const dep of deps) {
      if (checkCircular(dep)) {
        return true
      }
    }
    
    visited.delete(currentKey)
    return false
  }
  
  return checkCircular(template.key)
}

export async function readTemplateFromFile(file: File): Promise<{
  templates: Array<{
    key: string
    name: string
    description?: string
    kind: TemplateKind
    content: TemplateContent
  }>
  version?: string
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const data = JSON.parse(content)
        
        if (Array.isArray(data.templates)) {
          resolve(data)
        } else if (data.key && data.name && data.kind && data.content) {
          resolve({ templates: [data] })
        } else {
          reject(new Error('Invalid template file format'))
        }
      } catch (error) {
        reject(new Error('Failed to parse template file'))
      }
    }
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }
    
    reader.readAsText(file)
  })
}
