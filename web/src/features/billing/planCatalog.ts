import type { PricingPlanId } from '@/features/landing/pricingPlans'
import type { InstanceFeatures, InstanceFeatureFlag } from '@/shared/types/database'

export type OrganisationPlanId = PricingPlanId

export type PlanLimits = {
  id: OrganisationPlanId
  label: string
  quotaMaxConversationsMonth: number
  quotaMaxEmailsMonth: number
  quotaMaxHttpCallsMonth: number
  /** -1 = unlimited */
  quotaMaxChatbots: number
  /** -1 = unlimited */
  quotaMaxSeats: number
  features: Required<InstanceFeatures>
}

const ALL_OFF: Required<InstanceFeatures> = {
  staging: false,
  collaborative_editing: false,
  marketplace: false,
  agent_console: false,
  experiments: false,
  analytics_v2: false,
  compliance: false,
  sso: false,
  webhooks: false,
  integrations: false,
  platform_api: false,
  advanced_connections: false,
  alerts: false,
}

/** Must stay in sync with public.organisation_plan_limits SQL. */
export const PLAN_LIMITS: Record<OrganisationPlanId, PlanLimits> = {
  starter: {
    id: 'starter',
    label: 'Starter',
    quotaMaxConversationsMonth: 1000,
    quotaMaxEmailsMonth: 500,
    quotaMaxHttpCallsMonth: 5000,
    quotaMaxChatbots: 2,
    quotaMaxSeats: 3,
    features: { ...ALL_OFF },
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    quotaMaxConversationsMonth: 10_000,
    quotaMaxEmailsMonth: 5_000,
    quotaMaxHttpCallsMonth: 50_000,
    quotaMaxChatbots: -1,
    quotaMaxSeats: 10,
    features: {
      ...ALL_OFF,
      staging: true,
      collaborative_editing: true,
      marketplace: true,
      advanced_connections: true,
    },
  },
  business: {
    id: 'business',
    label: 'Business',
    quotaMaxConversationsMonth: 50_000,
    quotaMaxEmailsMonth: 25_000,
    quotaMaxHttpCallsMonth: 250_000,
    quotaMaxChatbots: -1,
    quotaMaxSeats: 40,
    features: {
      staging: true,
      collaborative_editing: true,
      marketplace: true,
      agent_console: true,
      experiments: true,
      analytics_v2: true,
      compliance: true,
      sso: false,
      webhooks: true,
      integrations: true,
      platform_api: true,
      advanced_connections: true,
      alerts: true,
    },
  },
  enterprise: {
    id: 'enterprise',
    label: 'Enterprise',
    quotaMaxConversationsMonth: 200_000,
    quotaMaxEmailsMonth: 100_000,
    quotaMaxHttpCallsMonth: 1_000_000,
    quotaMaxChatbots: -1,
    quotaMaxSeats: -1,
    features: {
      staging: true,
      collaborative_editing: true,
      marketplace: true,
      agent_console: true,
      experiments: true,
      analytics_v2: true,
      compliance: true,
      sso: true,
      webhooks: true,
      integrations: true,
      platform_api: true,
      advanced_connections: true,
      alerts: true,
    },
  },
}

export const ORGANISATION_PLAN_IDS: OrganisationPlanId[] = ['starter', 'pro', 'business', 'enterprise']

export function parseOrganisationPlan(value: unknown): OrganisationPlanId {
  if (value === 'starter' || value === 'pro' || value === 'business' || value === 'enterprise') return value
  return 'business'
}

export function planLimitsFor(plan: unknown): PlanLimits {
  return PLAN_LIMITS[parseOrganisationPlan(plan)]
}

export function formatQuotaCap(n: number): string {
  if (n < 0) return 'Unlimited'
  return n.toLocaleString()
}

export function planAllowsFeature(plan: unknown, feature: InstanceFeatureFlag | string): boolean {
  const limits = planLimitsFor(plan)
  return (limits.features as Record<string, boolean>)[feature] === true
}

export const PLAN_UPGRADE_HINT: Record<InstanceFeatureFlag, string> = {
  staging: 'Upgrade to Pro to use staging publish and test links.',
  collaborative_editing: 'Upgrade to Pro for collaborative editing and comments.',
  marketplace: 'Upgrade to Pro to install marketplace packs.',
  advanced_connections: 'Upgrade to Pro for payments, database, and shop checkout connections.',
  agent_console: 'Upgrade to Business for Agent console, queues, and agent seats.',
  experiments: 'Upgrade to Business for experiments and advanced analytics.',
  analytics_v2: 'Upgrade to Business for full analytics.',
  compliance: 'Upgrade to Business for retention, legal hold, and visitor export/delete.',
  webhooks: 'Upgrade to Business for organisation webhooks.',
  integrations: 'Upgrade to Business for the integrations catalog.',
  platform_api: 'Upgrade to Business for Platform API tokens.',
  alerts: 'Upgrade to Business for usage and health alerts.',
  sso: 'Upgrade to Enterprise for SSO (OIDC/SAML) and SCIM.',
}
