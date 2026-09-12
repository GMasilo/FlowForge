-- Add Adobe Sign–style agreement downloadable template kind.
alter type public.template_kind add value if not exists 'agreement';
