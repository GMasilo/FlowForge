-- Track whether platform invite email was delivered successfully.

alter table public.instance_invites
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_last_error text;
