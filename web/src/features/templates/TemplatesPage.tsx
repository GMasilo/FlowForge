import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowUpDown,
  Award,
  Bell,
  CalendarCheck,
  ListOrdered,
  Share2,
  CalendarPlus,
  Check,
  CheckSquare,
  Clock3,
  Copy,
  DollarSign,
  Download,
  FileDown,
  FilePenLine,
  KeyRound,
  LayoutList,
  Mail,
  MapPin,
  Map as MapIcon,
  Megaphone,
  MessageCircle,
  MessageSquare,
  QrCode,
  Receipt,
  Scale,
  Search,
  ShieldCheck,
  ShoppingCart,
  CircleHelp,
  Smartphone,
  Ticket,
  Trash2,
  Upload,
  Users,
  Webhook,
  ClipboardList,
} from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { ChatbotSubNav } from '@/features/chatbots/ChatbotSubNav'
import { useChatbotMedia } from '@/features/designer/MediaLibraryPanel'
import { mediaKeyFromFilename } from '@/features/designer/model/chatbotMedia'
import { absoluteInstanceFileUrl } from '@/shared/lib/flowforgeApi'
import { supabase } from '@/shared/lib/supabase'
import { canEdit, type ChatbotTemplate } from '@/shared/types/database'
import { useTemplateActions } from '@/features/templates/useTemplateActions'
import {
  sortTemplates,
  readTemplateFromFile,
} from '@/features/templates/templateHelpers'
import {
  chatbotTemplatesQueryKey,
  createChatbotTemplate,
  deleteChatbotTemplate,
  fetchChatbotTemplates,
  updateChatbotTemplate,
} from '@/features/templates/templateApi'
import { TemplateContentEditor } from '@/features/templates/TemplateContentEditor'
import { TemplatePreview } from '@/features/templates/TemplatePreview'
import {
  emptyTemplateContent,
  insertSnippet,
  inputSuggestionsFromTemplate,
  isTemplateKind,
  keyFromTemplateName,
  parseTemplateContent,
  starterTemplateContent,
  templateInputsOf,
  allTemplateKindTags,
  TEMPLATE_KIND_CATEGORIES,
  TEMPLATE_KIND_CATEGORY_META,
  TEMPLATE_KIND_META,
  TEMPLATE_KINDS,
  type TemplateContent,
  type TemplateKind,
  type TemplateKindCategory,
} from '@/features/templates/templateModel'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { FieldError } from '@/shared/ui/field-error'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'
import {
  PaginationBar,
  SearchField,
  clampPage,
  matchesQuery,
  pageCountFor,
  slicePage,
} from '@/shared/ui/list-controls'
import { cn } from '@/shared/lib/utils'

const KIND_ICONS: Record<TemplateKind, typeof Mail> = {
  email: Mail,
  faq: CircleHelp,
  cart: ShoppingCart,
  menu: LayoutList,
  message: MessageSquare,
  hours: Clock3,
  legal: Scale,
  receipt: Receipt,
  document: FileDown,
  agreement: FilePenLine,
  sso: KeyRound,
  appointment: CalendarCheck,
  location: MapPin,
  map: MapIcon,
  qr: QrCode,
  whatsapp: MessageCircle,
  calendar: CalendarPlus,
  social_share: Share2,
  waitlist: ListOrdered,
  team: Users,
  pricing: DollarSign,
  survey: ClipboardList,
  announcement: Megaphone,
  sms: Smartphone,
  push: Bell,
  ticket: Ticket,
  certificate: Award,
  checklist: CheckSquare,
  consent: ShieldCheck,
  webhook: Webhook,
}
