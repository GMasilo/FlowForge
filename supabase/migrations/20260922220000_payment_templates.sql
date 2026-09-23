-- Payment templates contain connection references and checkout settings, never credentials.
alter type public.template_kind add value if not exists 'payment';
