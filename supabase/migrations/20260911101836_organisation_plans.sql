-- Organisation subscription plans aligned to public Pricing page.
-- Existing orgs keep Business capacity; new orgs start on Starter.

do $$ begin
  create type public.organisation_plan as enum ('starter', 'pro', 'business', 'enterprise');
exception when duplicate_object then null;
end $$;

alter table public.instances
  add column if not exists plan public.organisation_plan not null default 'starter',
  add column if not exists quota_max_chatbots integer not null default 2,
  add column if not exists quota_max_seats integer not null default 3;

comment on column public.instances.plan is
  'Commercial plan: starter | pro | business | enterprise. Drives features and quotas.';
comment on column public.instances.quota_max_chatbots is
  'Max live (non-deleted) chatbots; -1 = unlimited.';
comment on column public.instances.quota_max_seats is
  'Max members + pending invites; -1 = unlimited.';
