# 🥃 The Hudson Distillery — Shop

Order site + staff panel for The Hudson Distillery. Built with Next.js 16, React 19,
TypeScript, Tailwind CSS 4 and shadcn/ui.

- **Storefront** (`/`) — browse the menu, build a cart, place an order, track and
  cancel it with the personal cancellation code issued at checkout.
- **Staff panel** (`/admin`) — role-based login (owner/employee), order
  management, inventory & restocking, stock log, restock payroll summary,
  staff chat, Discord notifications, JSON import/export and daily backups.

## Getting started

```bash
bun install
bun run setup        # create the local SQLite database + seed demo data
bun run dev          # http://localhost:3000
```

Without Supabase credentials the app runs on a **local SQLite database**
(Prisma) seeded by `bun run setup` (or `bun run db:seed` to re-seed) with
demo inventory and accounts:

| Role     | Name     | Password    |
| -------- | -------- | ----------- |
| Owner    | `hudson` | `hudson123` |
| Employee | `maria`  | `staff123`  |

## Environment variables

Copy `.env.example` to `.env.local`:

| Variable               | Required      | Purpose                                                        |
| ---------------------- | ------------- | -------------------------------------------------------------- |
| `SUPABASE_URL`         | production    | Supabase project URL (server-side only)                        |
| `SUPABASE_SECRET_KEY`  | production    | Service-role key (server-side only, never exposed to browsers) |
| `HD_SESSION_SECRET`    | **production**| HMAC key signing the staff session cookie                      |
| `CRON_SECRET`          | for backups   | Bearer token Vercel Cron sends to `/api/cron/backup`           |

**No Supabase?** Leave both `SUPABASE_*` vars empty — the app transparently
falls back to local SQLite via Prisma. Every API route works against either
backend.

## Supabase setup (production)

1. Create the tables with `supabase-setup.sql` (Supabase Dashboard → SQL Editor).
   RLS is enabled with **no public policies** — all access flows through the
   server using the service-role key, which bypasses RLS.
2. Set `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `HD_SESSION_SECRET`, `CRON_SECRET`
   in your hosting provider (Vercel → Settings → Environment Variables).
3. The daily backup cron is preconfigured in `vercel.json` (03:00 UTC) and
   uploads a JSON backup to your Discord webhook.

## Scripts

| Command             | Purpose                          |
| ------------------- | -------------------------------- |
| `bun run dev`       | Dev server on port 3000          |
| `bun run lint`      | ESLint                           |
| `bun run typecheck` | `tsc --noEmit`                   |
| `bun run db:push`   | Sync Prisma schema (local SQLite)|

## Security notes

- Prices are always resolved server-side — client-submitted prices are ignored.
- Public inputs are validated with zod; order creation, tracking and
  cancellation are rate-limited per IP.
- Order tracking requires the order number **and** its cancellation code, so
  order IDs can't be enumerated.
- Staff sessions are HMAC-signed httpOnly cookies (`secure` in production).
- Passwords are stored with scrypt + per-user salt; legacy SHA-256 rows are
  transparently upgraded on next login.
