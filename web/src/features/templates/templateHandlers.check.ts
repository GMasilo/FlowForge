import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  viewTemplate,
  downloadTemplate,
  importTemplates,
} from './templateApi'
import {
  getTemplatePreview,
  getTemplateSize,
  formatTemplateSize,
  validateTemplateKey,
  validateTemplateName,
  searchTemplates,
  sortTemplates,
  groupTemplatesByKind,
  getTemplateStats,
  findTemplateByKey,
  getTemplateDependencies,
  hasCircularDependency,
  readTemplateFromFile,
} from './templateHelpers'
import type { ChatbotTemplate } from '@/shared/types/database'

global.fetch = vi.fn()

const mockTemplate: ChatbotTemplate = {
  id: 'template-123',
  chatbot_id: 'chatbot-456',
  key: 'welcome_email',
  name: 'Welcome Email',
  description: 'Email sent to new users',
  kind: 'email',
  content: {
    subject: 'Welcome!',
    html: '<p>Welcome to our service</p>',
    inputs: [],
  },
  deleted_at: null,
  created_by: 'user-789',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z',
}

const mockTemplates: ChatbotTemplate[] = [
  mockTemplate,
  {
    ...mockTemplate,
    id: 'template-124',
    key: 'faq_hours',
    name: 'Hours FAQ',
    kind: 'faq',
    content: {
      intro: 'Common questions',
      items: [{ question: 'What are your hours?', answer: '9-5 daily' }],
      inputs: [],
    },
  },
  {
    ...mockTemplate,
    id: 'template-125',
    key: 'cart_main',
    name: 'Main Cart',
    kind: 'cart',
    content: {
      currency: 'USD',
      storeName: 'My Store',
      intro: 'Browse our products',
      checkoutLabel: 'Checkout',
      cartHint: 'Cart hint',
      categories: [{ id: 'cat_1', name: 'Category 1' }],
      products: [],
      fees: [],
    },
  },
]

describe('Template API Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('viewTemplate', () => {
    it('should fetch template data', async () => {
      const mockResponse = {
        template: mockTemplate,
        chatbot_id: 'chatbot-456',
        instance_id: 'instance-789',
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const result = await viewTemplate('template-123')

      expect(result.template.id).toBe('template-123')
      expect(result.chatbot_id).toBe('chatbot-456')
    })

    it('should throw error on failed request', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Template not found' }),
      } as Response)

      await expect(viewTemplate('invalid-id')).rejects.toThrow('Template not found')
    })
  })

  describe('downloadTemplate', () => {
    it('should trigger download', async () => {
      const createElementSpy = vi.spyOn(document, 'createElement')
      const appendChildSpy = vi.spyOn(document.body, 'appendChild')
      const removeChildSpy = vi.spyOn(document.body, 'removeChild')

      await downloadTemplate('template-123', 'json')

      expect(createElementSpy).toHaveBeenCalledWith('a')
      expect(appendChildSpy).toHaveBeenCalled()
      expect(removeChildSpy).toHaveBeenCalled()
    })
  })

  describe('importTemplates', () => {
    it('should import templates successfully', async () => {
      const mockImportResult = {
        imported: [{ id: 'new-id', key: 'new_template', action: 'created' as const }],
        skipped: [],
        errors: [],
        total: 1,
        success_count: 1,
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockImportResult,
      } as Response)

      const result = await importTemplates(
        'chatbot-456',
        [
          {
            key: 'new_template',
            name: 'New Template',
            kind: 'message',
            content: { text: 'Hello', inputs: [] },
          },
        ],
        false,
      )

      expect(result.success_count).toBe(1)
      expect(result.imported[0].action).toBe('created')
    })
  })
})

describe('Template Helper Functions', () => {
  describe('getTemplatePreview', () => {
    it('should return preview text', () => {
      const preview = getTemplatePreview(mockTemplate, 50)
      expect(preview).toContain('Welcome')
      expect(preview.length).toBeLessThanOrEqual(50)
    })
  })

  describe('getTemplateSize', () => {
    it('should return content size in bytes', () => {
      const size = getTemplateSize(mockTemplate)
      expect(size).toBeGreaterThan(0)
    })
  })

  describe('formatTemplateSize', () => {
    it('should format bytes correctly', () => {
      expect(formatTemplateSize(500)).toBe('500 B')
      expect(formatTemplateSize(1500)).toBe('1.5 KB')
      expect(formatTemplateSize(1500000)).toBe('1.4 MB')
    })
  })

  describe('validateTemplateKey', () => {
    it('should validate correct keys', () => {
      expect(validateTemplateKey('valid_key').valid).toBe(true)
      expect(validateTemplateKey('ValidKey123').valid).toBe(true)
    })

    it('should reject invalid keys', () => {
      expect(validateTemplateKey('').valid).toBe(false)
      expect(validateTemplateKey('123invalid').valid).toBe(false)
      expect(validateTemplateKey('invalid-key').valid).toBe(false)
      expect(validateTemplateKey('a'.repeat(50)).valid).toBe(false)
    })
  })

  describe('validateTemplateName', () => {
    it('should validate correct names', () => {
      expect(validateTemplateName('Valid Name').valid).toBe(true)
    })

    it('should reject invalid names', () => {
      expect(validateTemplateName('').valid).toBe(false)
      expect(validateTemplateName('A').valid).toBe(false)
      expect(validateTemplateName('a'.repeat(101)).valid).toBe(false)
    })
  })

  describe('searchTemplates', () => {
    it('should search by query', () => {
      const results = searchTemplates(mockTemplates, 'email')
      expect(results.length).toBe(1)
      expect(results[0].key).toBe('welcome_email')
    })

    it('should filter by kind', () => {
      const results = searchTemplates(mockTemplates, '', 'faq')
      expect(results.length).toBe(1)
      expect(results[0].kind).toBe('faq')
    })

    it('should combine query and kind filter', () => {
      const results = searchTemplates(mockTemplates, 'hours', 'faq')
      expect(results.length).toBe(1)
    })
  })

  describe('sortTemplates', () => {
    it('should sort by name ascending', () => {
      const sorted = sortTemplates(mockTemplates, 'name', 'asc')
      expect(sorted[0].name).toBe('Hours FAQ')
    })

    it('should sort by name descending', () => {
      const sorted = sortTemplates(mockTemplates, 'name', 'desc')
      expect(sorted[0].name).toBe('Welcome Email')
    })

    it('should sort by kind', () => {
      const sorted = sortTemplates(mockTemplates, 'kind', 'asc')
      expect(sorted[0].kind).toBe('cart')
    })
  })

  describe('groupTemplatesByKind', () => {
    it('should group templates by kind', () => {
      const grouped = groupTemplatesByKind(mockTemplates)
      expect(grouped.email).toHaveLength(1)
      expect(grouped.faq).toHaveLength(1)
      expect(grouped.cart).toHaveLength(1)
    })
  })

  describe('getTemplateStats', () => {
    it('should return template statistics', () => {
      const stats = getTemplateStats(mockTemplates)
      expect(stats.total).toBe(3)
      expect(stats.byKind).toHaveLength(3)
      expect(stats.totalSize).toBeGreaterThan(0)
      expect(stats.averageSize).toBeGreaterThan(0)
    })
  })

  describe('findTemplateByKey', () => {
    it('should find template by key', () => {
      const found = findTemplateByKey(mockTemplates, 'welcome_email')
      expect(found?.id).toBe('template-123')
    })

    it('should return undefined for non-existent key', () => {
      const found = findTemplateByKey(mockTemplates, 'non_existent')
      expect(found).toBeUndefined()
    })
  })

  describe('getTemplateDependencies', () => {
    it('should extract template dependencies', () => {
      const templateWithDeps: ChatbotTemplate = {
        ...mockTemplate,
        kind: 'message',
        content: {
          text: 'See {{templates.hours_main.text}} or {{templates.contact_info.text}}',
          inputs: [],
        },
      }

      const deps = getTemplateDependencies(templateWithDeps)
      expect(deps).toContain('hours_main')
      expect(deps).toContain('contact_info')
    })

    it('should return empty array for no dependencies', () => {
      const deps = getTemplateDependencies(mockTemplate)
      expect(deps).toEqual([])
    })
  })

  describe('hasCircularDependency', () => {
    it('should detect circular dependencies', () => {
      const template1: ChatbotTemplate = {
        ...mockTemplate,
        kind: 'message',
        key: 'template_a',
        content: { text: '{{templates.template_b.text}}', inputs: [] },
      }

      const template2: ChatbotTemplate = {
        ...mockTemplate,
        kind: 'message',
        id: 'template-2',
        key: 'template_b',
        content: { text: '{{templates.template_a.text}}', inputs: [] },
      }

      const circular = hasCircularDependency(template1, [template1, template2])
      expect(circular).toBe(true)
    })

    it('should return false for no circular dependencies', () => {
      const circular = hasCircularDependency(mockTemplate, mockTemplates)
      expect(circular).toBe(false)
    })
  })

  describe('readTemplateFromFile', () => {
    it('should read single template from file', async () => {
      const fileContent = JSON.stringify({
        key: 'test_template',
        name: 'Test Template',
        kind: 'message',
        content: { text: 'Test', inputs: [] },
      })

      const file = new File([fileContent], 'template.json', { type: 'application/json' })

      const result = await readTemplateFromFile(file)
      expect(result.templates).toHaveLength(1)
      expect(result.templates[0].key).toBe('test_template')
    })

    it('should read multiple templates from file', async () => {
      const fileContent = JSON.stringify({
        version: '1.0',
        templates: [
          {
            key: 'template1',
            name: 'Template 1',
            kind: 'message',
            content: { text: 'Test 1', inputs: [] },
          },
          {
            key: 'template2',
            name: 'Template 2',
            kind: 'message',
            content: { text: 'Test 2', inputs: [] },
          },
        ],
      })

      const file = new File([fileContent], 'templates.json', { type: 'application/json' })

      const result = await readTemplateFromFile(file)
      expect(result.templates).toHaveLength(2)
      expect(result.version).toBe('1.0')
    })

    it('should reject invalid file format', async () => {
      const fileContent = JSON.stringify({ invalid: 'format' })
      const file = new File([fileContent], 'invalid.json', { type: 'application/json' })

      await expect(readTemplateFromFile(file)).rejects.toThrow('Invalid template file format')
    })
  })
})
