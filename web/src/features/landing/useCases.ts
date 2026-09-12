export type UseCaseIndustryId =
  | 'health'
  | 'education'
  | 'mining'
  | 'banking'
  | 'retail'
  | 'government'
  | 'crm'

export type UseCaseIndustry = {
  id: UseCaseIndustryId
  title: string
  brand: string
  summary: string
  scenario: string
  highlights: string[]
  suggestedSlug: string
  sampleFile: string
}

export const USE_CASES: UseCaseIndustry[] = [
  {
    id: 'health',
    title: 'Patient intake & care journey',
    brand: 'CareFlow Clinic',
    summary:
      'Book visits, check symptoms, shop the pharmacy, request records, and leave feedback — with confirmations, receipts, and a downloadable pack.',
    scenario:
      'A patient books a GP slot, shops wellness products, or releases records after a quick verification.',
    highlights: ['Rich identity', 'Appointments', 'Triage paths', 'Pharmacy checkout', 'PDF pack & email'],
    suggestedSlug: 'usecase-health',
    sampleFile: 'flowforge-usecase-health.json',
  },
  {
    id: 'education',
    title: 'Student application journey',
    brand: 'Summit University',
    summary:
      'Apply online, browse programmes, book open days, estimate fees, and check application status.',
    scenario:
      'An applicant browses programmes, estimates net fees with a bursary, or checks status with a verification code.',
    highlights: ['Applications', 'Programme browse', 'Fee estimates', 'Open days', 'Status checks'],
    suggestedSlug: 'usecase-education',
    sampleFile: 'flowforge-usecase-education.json',
  },
  {
    id: 'mining',
    title: 'Site induction & safety report',
    brand: 'OreGuard Mining',
    summary:
      'Book induction, escalate hazards, order PPE, gate visitors, and reach HSE — site services in one chat.',
    scenario:
      'A contractor picks a site, books induction with a signature, or orders PPE with checkout.',
    highlights: ['Induction', 'Hazard reports', 'PPE shop', 'Visitor access', 'HSE contact'],
    suggestedSlug: 'usecase-mining',
    sampleFile: 'flowforge-usecase-mining.json',
  },
  {
    id: 'banking',
    title: 'Everyday banking assistant',
    brand: 'LedgerBank',
    summary:
      'Open an account, check a demo balance, get a loan quote, browse cards, or reach fraud support.',
    scenario:
      'A client checks a demo balance after verification, or applies for a loan and receives a quote.',
    highlights: ['Account opening', 'Balances', 'Loan quotes', 'Card shop', 'Support'],
    suggestedSlug: 'usecase-banking',
    sampleFile: 'flowforge-usecase-banking.json',
  },
  {
    id: 'retail',
    title: 'Personal shopper & orders',
    brand: 'Northline Market',
    summary:
      'Shop the edit, track orders (try NL-45821), book a stylist, start returns, and leave feedback.',
    scenario:
      'A shopper tracks NL-45821, or checks out the Northline edit with payment in the demo.',
    highlights: ['Shop & pay', 'Order tracking', 'Stylist booking', 'Returns', 'Feedback'],
    suggestedSlug: 'usecase-retail',
    sampleFile: 'flowforge-usecase-retail.json',
  },
  {
    id: 'government',
    title: 'Citizen service request',
    brand: 'CivicAssist',
    summary:
      'Lodge requests, check cases (try CA-2026-1188), book counters, pay permit fees, and rate services.',
    scenario:
      'A citizen lodges a pothole request or checks case CA-2026-1188 for status.',
    highlights: ['Service requests', 'Case status', 'Permit fees', 'Counter booking', 'Ratings'],
    suggestedSlug: 'usecase-government',
    sampleFile: 'flowforge-usecase-government.json',
  },
  {
    id: 'crm',
    title: 'Sales & customer success CRM',
    brand: 'PulseCRM',
    summary:
      'Look up accounts, capture and score leads, log tickets, check deals (try DEAL-2026-0042), book meetings, and buy CRM add-ons.',
    scenario:
      'A rep looks up rep@pulsecrm.example, captures a hot lead, or tracks DEAL-2026-0042 through the pipeline.',
    highlights: ['Account lookup', 'Lead capture', 'Support tickets', 'Deal tracking', 'Meetings & add-ons'],
    suggestedSlug: 'usecase-crm',
    sampleFile: 'flowforge-usecase-crm.json',
  },
]
