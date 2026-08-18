# FlowForge

Multi-instance chatbot builder with role-based access, a hybrid linear/canvas flow designer, typed variables, and reusable HTTP/email connections.

## Stack

- React + Vite + TypeScript + Tailwind
- Supabase (Auth, Postgres, RLS)

## Setup

1. Install deps:

```bash
cd web
npm install
```

2. Copy env and fill keys (already present for the linked project):

```bash
cp .env.example .env
```

3. Apply migrations from repo root:

```bash
npx supabase db push
```

4. Run the app:

```bash
cd web
npm run dev
```

### Invite signup (no Supabase confirmation email)

Organisation invites rely on immediate sign-in after account creation. In the hosted project, turn **Confirm email** off:

[Authentication → Providers → Email](https://supabase.com/dashboard/project/rongygfkvezsgerljqno/auth/providers)

Uncheck **Confirm email** and save. Local `supabase/config.toml` already has `enable_confirmations = false`.
## PHP connection API

Deploy [`web/api`](web/api) to `https://gkjtt.co.za/flowforge/api/`.

See [`web/api/README.md`](web/api/README.md) for JWT setup, endpoints, and security notes.

## Frontend deploy (Apache)

Build output goes to `web/dist/` with `base: /flowforge/`. Upload the contents of `dist/` to the server’s `/flowforge/` directory.

`public/.htaccess` is copied into `dist/` and rewrites SPA paths (e.g. `/flowforge/signup`) to `index.html`. Without it, deep links return 404.
