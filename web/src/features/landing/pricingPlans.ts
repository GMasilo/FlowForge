export type PricingPlanId = 'starter' | 'pro' | 'business' | 'enterprise'

export type PricingPlan = {
  id: PricingPlanId
  name: string
  tagline: string
  priceLabel: string
  priceHint: string
  ctaLabel: string
  ctaTo: string
  highlighted?: boolean
  features: string[]
}

export type PricingCompareRow = {
  feature: string
  starter: string | boolean
  pro: string | boolean
  business: string | boolean
  enterprise: string | boolean
}

/** Public pricing copy mapped to real FlowForge capabilities (designer, quotas, staging, agents, SSO, compliance, API). */
export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Launch a first chatbot and learn the designer.',
    priceLabel: 'Free',
    priceHint: 'For evaluation and small pilots',
    ctaLabel: 'Sign in',
    ctaTo: '/login',
    features: [
      'Visual flow designer & templates',
      'Public chat + embed',
      '1 organisation workspace',
      'Up to 2 published chatbots',
      'Basic HTTP & email connections',
      '1,000 conversations / month',
      '500 emails / month',
      '5,000 HTTP calls / month',
      'Owner + editor seats (up to 3)',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Ship production bots with staging and richer integrations.',
    priceLabel: '$79',
    priceHint: 'per organisation / month',
    ctaLabel: 'Start with Pro',
    ctaTo: '/login',
    highlighted: true,
    features: [
      'Everything in Starter',
      'Staging publish & test links',
      'Collaborative editing & comments',
      'Payments, database & shop checkout',
      'Entities, documents & receipts',
      'Inbox handoff to teammates',
      'Marketplace install',
      '10,000 conversations / month',
      '5,000 emails / month',
      '50,000 HTTP calls / month',
      'Up to 10 seats (editors & viewers)',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    tagline: 'Operate live support, automation, and compliance at scale.',
    priceLabel: '$249',
    priceHint: 'per organisation / month',
    ctaLabel: 'Choose Business',
    ctaTo: '/login',
    features: [
      'Everything in Pro',
      'Agent role, Inbox & Agent console',
      'Queues, presence & live handoff',
      'Analytics, experiments & alerts',
      'Webhooks & usage dashboards',
      'Audit log',
      'Compliance: retention & visitor export/delete',
      'Platform API tokens',
      'Integrations catalog (Slack, Teams, Drive…)',
      '50,000 conversations / month',
      '25,000 emails / month',
      '250,000 HTTP calls / month',
      'Up to 40 seats (incl. agents)',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Identity, governance, and custom capacity for large orgs.',
    priceLabel: 'Custom',
    priceHint: 'Annual contract · volume pricing',
    ctaLabel: 'Talk to us',
    ctaTo: '/help',
    features: [
      'Everything in Business',
      'SSO (OIDC / SAML) & enforce SSO',
      'SCIM provisioning',
      'Legal hold & custom retention',
      'Custom quotas & HTTP allowlists',
      'Higher API rate limits',
      'Private marketplace / pack review',
      'Dedicated onboarding support',
      'Security review assistance',
      'Negotiated conversation & channel volume',
    ],
  },
]

export const PRICING_COMPARE: PricingCompareRow[] = [
  { feature: 'Visual designer & templates', starter: true, pro: true, business: true, enterprise: true },
  { feature: 'Public chat & embed', starter: true, pro: true, business: true, enterprise: true },
  { feature: 'Published chatbots', starter: '2', pro: 'Unlimited*', business: 'Unlimited*', enterprise: 'Unlimited*' },
  { feature: 'Staging & test links', starter: false, pro: true, business: true, enterprise: true },
  { feature: 'Collaborative editing', starter: false, pro: true, business: true, enterprise: true },
  { feature: 'Shop, payments & documents', starter: false, pro: true, business: true, enterprise: true },
  { feature: 'Agent console & queues', starter: false, pro: false, business: true, enterprise: true },
  { feature: 'Analytics & experiments', starter: 'Basic', pro: 'Standard', business: 'Full', enterprise: 'Full' },
  { feature: 'Webhooks & Platform API', starter: false, pro: false, business: true, enterprise: true },
  { feature: 'Compliance toolkit', starter: false, pro: false, business: true, enterprise: true },
  { feature: 'SSO + SCIM', starter: false, pro: false, business: false, enterprise: true },
  { feature: 'Conversations / month', starter: '1k', pro: '10k', business: '50k', enterprise: 'Custom' },
  { feature: 'Seats', starter: '3', pro: '10', business: '40', enterprise: 'Custom' },
]

export const PRICING_FAQS = [
  {
    q: 'What counts as a conversation?',
    a: 'A conversation is a visitor or staging-test session started against a published chatbot. Organisation usage is tracked under Admin → Usage and can raise alerts as you approach monthly limits.',
  },
  {
    q: 'Can I try industry demos before buying?',
    a: 'Yes. Open Use cases for live industry assistants, or import sample packs from Platform settings. Demos use the same designer, entities, shop, and document features as production bots.',
  },
  {
    q: 'How do seats and roles work?',
    a: 'Owners and admins manage the organisation. Editors design flows; viewers inspect; agents handle live Inbox / Agent console handoffs. Business and Enterprise include agent seats; Starter and Pro focus on builder seats.',
  },
  {
    q: 'Is billing automated today?',
    a: 'Organisation plans are enforced in-product: feature flags, chatbot/seat caps, and monthly conversation/email/HTTP quotas. Platform superusers assign Starter, Pro, Business, or Enterprise under Admin → Usage. Self-serve checkout is not required to activate a plan.',
  },
] as const
