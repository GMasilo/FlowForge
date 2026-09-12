-- Entity attribute type for credentials: stored hashed, never shown as plaintext in the Data UI.
alter type public.variable_type add value if not exists 'password';
