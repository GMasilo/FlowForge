-- QR code template: generate a scannable QR from a payload for chat embeds.
alter type public.template_kind add value if not exists 'qr';
