import { FilePlus2, Users, Package, ListChecks, Vote, ShoppingBag, UserPlus, CalendarClock, LifeBuoy, MessageSquare, CircleHelp, MapPin, Wrench, CalendarDays, Ticket, ClipboardList, type LucideIcon } from 'lucide-react'

const icons: Record<string, LucideIcon> = {
  blank: FilePlus2, users: Users, products: Package, polls: ListChecks, poll_responses: Vote,
  orders: ShoppingBag, leads: UserPlus, appointments: CalendarClock, support_tickets: LifeBuoy,
  feedback: MessageSquare, faq: CircleHelp, locations: MapPin, services: Wrench,
  events: CalendarDays, registrations: Ticket, tasks: ClipboardList,
}

export function EntityTemplateIcon({ templateKey }: { templateKey: string }) {
  const Icon = icons[templateKey] ?? FilePlus2
  return <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-[var(--color-accent)]" />
}
