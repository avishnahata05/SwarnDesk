# HiraNXT — Jewellery ERP

India's smartest Jewellery ERP SaaS built for Indian jewellers — manages inventory, billing/POS, karigars, repairs, purchases, customers, and GST compliance.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/hiranxt run dev` — run the frontend (port 21261)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (port 8080, path prefix `/api`)
- Frontend: React + Vite (port 21261, path prefix `/`)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Router: wouter v3 (Link renders `<a>` — never wrap children in `<a>`)
- Charts: Recharts
- UI: shadcn/ui components

## Where things live

- `lib/db/src/schema/` — DB schema files (rates, inventory, customers, sales, karigars, repairs, purchases)
- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth for API)
- `lib/api-client-react/src/generated/api.ts` — generated React Query hooks
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/hiranxt/src/pages/` — Frontend pages (landing + app/*)
- `artifacts/hiranxt/src/components/AppLayout.tsx` — sidebar + topbar shell
- `artifacts/hiranxt/src/index.css` — CSS theme (#1a1a2e bg, #f4c542 gold)

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → React Query hooks; never write fetch calls manually
- Wouter v3 routing: `<Link href="...">` renders as `<a>`; never nest `<a>` inside `<Link>`
- All monetary values stored as `numeric` strings in DB, parsed to float in API mappers
- Sales line items saved to `saleLineItemsTable` with key `items` (not `lineItems`) in POST body
- Global reverse proxy routes `/api` → port 8080, `/` → port 21261

## Product modules

- **Landing page** — marketing page with pricing, testimonials, live gold rate ticker
- **Dashboard** — summary cards (sales, profit, inventory value, customers, stock, repairs), 30-day chart, category pie, low stock alerts, recent sales, AI chat widget
- **Inventory** — category summary cards, searchable/filterable table with low stock badges
- **Billing & POS** — one-screen POS with item search, cart, GST auto-calc, exchange gold, customer lookup
- **Customers** — CRM table with upcoming occasions banner, loyalty points, total purchases, WhatsApp links
- **Karigars** — artisan cards with gold/silver balance tracking, issue metal & return metal dialogs
- **Repairs** — Kanban board (Received → In Progress → Ready → Delivered) with status progression
- **Purchases** — metal receipt table (gold/silver from suppliers)
- **Reports** — daily sales chart with profit overlay, revenue by category, inventory valuation
- **Settings** — business profile (name, GSTIN, address, GST rate), metal rates update

## User preferences

- Color theme: `#1a1a2e` dark background, `#f4c542` gold accent
- Language toggle (English / Hindi) in topbar
- Indian number formatting throughout (₹ symbol, `en-IN` locale)
- WhatsApp integration links on customers and karigar cards

## Gotchas

- Always rebuild API server after route changes: restart the `artifacts/api-server: API Server` workflow
- Sales POST body must use `items` array key (not `lineItems`) for line items to be saved
- `pnpm --filter @workspace/db run push` must be run after any schema changes before the API will work
- Do NOT run `pnpm dev` at workspace root; use workflow restarts instead
- Purchases table has no `paymentStatus` column (only suppliers + weight/rate/total fields)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
