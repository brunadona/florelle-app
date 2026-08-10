# Architecture Research

**Domain:** Multi-tenant retrofit of a single-file localStorage/Cloudflare-KV PWA using Supabase (Postgres + Auth + RLS)
**Researched:** 2026-08-09
**Confidence:** HIGH (Supabase RLS/auth patterns are well-documented, verified against current docs and community sources) / MEDIUM (specific integration with Florelle's existing worker.js is inference, not found in a public case study)

## Standard Architecture

### System Overview

Supabase does **not** replace the Cloudflare Worker — it replaces Cloudflare KV as the *system of record for tenant data*, and coexists with the Worker as a thin proxy/integration layer. Google Drive/Calendar stays as-is (out of scope, Fase 2). Kommo and Claude integrations stay in the Worker untouched.

```text
┌─────────────────────────────────────────────────────────────────────┐
│                     index.html (single-file PWA)                     │
│  ┌───────────┐  ┌────────────────┐  ┌─────────────────────────────┐ │
│  │  UI/DOM   │  │ Business Logic │  │   supabase-js client (CDN)   │ │
│  │ (kanban,  │  │ (DATA array,   │  │  createClient(url, anonKey)  │ │
│  │  modals)  │  │  save/load)    │  │  auth.signIn / .from(table)  │ │
│  └─────┬─────┘  └────────┬───────┘  └──────────────┬────────────────┘│
│        │                 │                          │                │
│        │        ┌────────▼─────────┐                │                │
│        │        │ Data Access Layer │◄───────────────┘                │
│        │        │ (new: per-domain  │  reads/writes go straight to   │
│        │        │  repository fns)  │  Postgres via PostgREST, RLS   │
│        │        └────────┬─────────┘  scopes rows to caller's JWT    │
└────────┼─────────────────┼──────────────────────────┼────────────────┘
         │                 │                          │
         ▼                 ▼                          ▼
┌─────────────────┐  ┌───────────────────┐  ┌──────────────────────────┐
│  localStorage    │  │ Cloudflare Worker  │  │   Supabase (hosted)      │
│  (offline cache, │  │ worker.js — UNCHANGED for:                     │
│   per-domain,    │  │  - /sign, /contract (signing flow)              │
│   NOT source of  │  │  - /analyze-wa (Claude)                         │
│   truth anymore  │  │  - /kommo, /kommo-webhook                       │
│   post-migration)│  │  KV usage shrinks to: signing tokens, WA cache, │
│                  │  │  Kommo webhook buffer — NOT app data sync       │
│                  │  │  /data endpoint: deprecated after full cutover  │
└──────────────────┘  └────────┬──────────────────────┘                │
                                │                          ┌────────────▼───────────┐
                                │ service-role calls only   │  Postgres (Supabase)    │
                                │ (server-to-server, e.g.   │  - auth.users (built-in)│
                                │  contract PDF storage,    │  - clients (tenants)     │
                                │  optionally in Fase 2)    │  - user_clients (join)   │
                                └───────────────────────────►  - orders, payments,     │
                                                             │    reminders, inventory, │
                                                             │    contracts (all with   │
                                                             │    client_id + RLS)      │
                                                             └──────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|-------------------------|
| `index.html` (frontend) | UI, business logic, orchestrates reads/writes | Unchanged rendering (`renderAll`), swap `save()`/`load()` internals per domain |
| **New: Data Access Layer** | Isolate Supabase calls behind small per-domain functions (`ordersRepo.list()`, `ordersRepo.save()`) so `saveModal()` etc. don't call `supabase.from()` directly | Plain JS module (inline `<script>` block or separate `.js` file loaded via `<script defer>`) — no framework needed |
| Supabase Auth | Issues JWT with `sub` (user id); session persisted via refresh token in browser storage (handled by supabase-js) | `supabase.auth.signInWithPassword()`, `onAuthStateChange()` |
| Postgres + RLS | Enforces `client_id` isolation at the database layer, independent of frontend trust | `USING (client_id = (SELECT client_id FROM user_clients WHERE user_id = auth.uid()))` |
| PostgREST (via supabase-js) | Auto-generated REST API over tables, called directly from browser with the anon key + user JWT | `supabase.from('orders').select('*')` |
| Cloudflare Worker (`worker.js`) | Everything that is NOT tenant CRUD: contract signing tokens, Claude WhatsApp analysis, Kommo sync/webhook | Unchanged; `/data` endpoint retired once all 4 domains are cut over |
| Cloudflare KV | Shrinks to short-lived, non-tenant-critical state (signing tokens, WA message buffer, pending confirms) | Unchanged usage except app-data sync keys removed |
| localStorage | Becomes an **offline cache/mirror**, not the source of truth, once a domain is migrated | Read-through cache pattern: read Supabase, fall back to localStorage if offline |

## Recommended Project Structure

Florelle's constraint is explicit: no build step, single HTML file deploys directly to GitHub Pages. So "structure" here means **logical organization within `index.html`**, not folders — unless the team decides to split into loaded `<script src>` files (still no bundler required, since the CDN ESM import works standalone).

```
index.html
├── <head>
│   └── <script type="module"> import { createClient } from 'supabase-js CDN ESM' </script>
├── (existing) <style> ... </style>
├── (existing) HTML markup (kanban, modals, forms) — UNCHANGED
├── <script> (existing global state: DATA, editId, etc.) — UNCHANGED
├── <script> — NEW: Supabase bootstrap
│   ├── const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
│   ├── auth: signIn / signUp / signOut / onAuthStateChange / session restore
│   └── currentClientId (resolved once per session from user_clients)
├── <script> — NEW: Data Access Layer (one section per domain)
│   ├── ordersRepo    { list, get, upsert, remove }   ← Kanban/pedidos
│   ├── paymentsRepo  { list, upsert, remove }         ← Financeiro
│   ├── inventoryRepo { list, upsert, remove }         ← Inventário
│   ├── contractsRepo { list, upsert, remove }         ← Contratos
│   └── each repo: try Supabase first; on network failure, read localStorage cache
├── (existing) Business logic (buildCol, buildCard, saveModal, ...) 
│   → calls repo functions instead of localStorage directly, per migrated domain
└── (existing) init sequence at bottom
    → add: await restoreSession() BEFORE load(), gate UI on auth state
```

### Structure Rationale

- **Data Access Layer as its own `<script>` block, inline in the same file:** keeps the "single file, no build step" constraint intact while still giving `saveModal()` and friends one seam to swap per domain, instead of scattering `supabase.from(...)` calls across 6000 lines. This is the single most important structural change — it's what makes "migrate one domain at a time" tractable.
- **Repos, not a generic ORM-like abstraction:** four small, domain-specific functions per feature (kanban/financeiro/inventário/contratos) rather than one generic `dataService`. Matches the incremental migration order Bruna already specified and lets each domain be swapped and tested independently without touching the others.
- **localStorage demoted to cache, not deleted:** removing localStorage entirely on day one is riskier than keeping it as an offline fallback + safety net during the transition. Each repo function's write path can still mirror to localStorage; reads prefer Supabase when online.

## Architectural Patterns

### Pattern 1: `clients` + `user_clients` join table (not `client_id` directly on `auth.users`)

**What:** A `clients` table represents each tenant business (Florelle, and future companies). A `user_clients` join table maps `auth.users.id` → `client_id` (supports future multi-user-per-client without a schema change; PROJECT.md explicitly flags this as an open decision — this pattern resolves it cheaply either way).
**When to use:** Any multi-tenant app where "one user = one tenant" might later become "N users per tenant" (e.g., Bruna adds an assistant login later).
**Trade-offs:** One extra join per RLS check vs. storing `client_id` directly on the user — mitigated by pattern 2 (JWT custom claim) so the join cost is paid once per session, not once per row.

```sql
create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table user_clients (
  user_id uuid references auth.users(id) primary key,
  client_id uuid references clients(id) not null
);
```

### Pattern 2: RLS policy driven by a `SECURITY DEFINER` helper function (not a per-row subquery)

**What:** Instead of writing `client_id = (select client_id from user_clients where user_id = auth.uid())` inline in every policy (recomputed per row, joins on every check), wrap it in a `SECURITY DEFINER` function and/or promote `client_id` into a JWT custom claim so the value is looked up once per request, not once per row.
**When to use:** Any table with RLS enabled that filters on tenant id — i.e., every tenant data table in this project.
**Trade-offs:** JWT custom claims need a Postgres hook to inject them at token-mint time (slightly more setup) but pay off immediately at Florelle's scale already, and matter a lot once N clients each have hundreds of orders.

```sql
create or replace function auth.client_id() returns uuid
language sql stable security definer as $$
  select client_id from public.user_clients where user_id = auth.uid()
$$;

create policy "tenant_isolation_select" on orders
  for select using (client_id = auth.client_id());
create policy "tenant_isolation_write" on orders
  for all using (client_id = auth.client_id())
  with check (client_id = auth.client_id());
```

**Indexing is mandatory:** every table gets `create index on <table>(client_id);` — without it, RLS checks force a sequential scan per query, and this is the single most common Supabase multi-tenant performance complaint in the wild.

### Pattern 3: Direct browser-to-Postgres reads/writes (PostgREST via supabase-js), Worker untouched for everything else

**What:** The frontend calls Supabase directly (`supabase.from('orders').select()`), bypassing the Cloudflare Worker entirely for tenant CRUD. The Worker keeps owning contract signing, Claude analysis, and Kommo sync — none of which need to change, because none of them touch tenant-scoped Postgres rows directly (they return data to the frontend, which then writes it via the repo layer with RLS enforcing tenant scope).
**When to use:** This is the correct boundary for Florelle: Worker = "does something with an external service or needs a secret," Supabase = "reads/writes this tenant's data."
**Trade-offs:** Two backends to reason about (Worker + Supabase) instead of one, but each has a narrow, non-overlapping responsibility, which is *less* coupling than today (Worker currently owns both KV data-sync AND all the external integrations).

```javascript
// repo layer, not scattered through saveModal()
async function saveOrder(order) {
  const { data, error } = await supabase
    .from('orders')
    .upsert({ ...order, client_id: currentClientId })
    .select();
  if (error) { /* fall back to localStorage queue, surface toast */ }
  return data;
}
```

**Where the Worker *does* need to change:** the Kommo sync flow and the WhatsApp-analysis flow both currently return data that the frontend merges into the local `DATA` array and then persists via `save()`. Once `save()` for orders routes through `ordersRepo`, those flows keep working unmodified — they just end up writing to Postgres instead of KV, because they go through the same repo function. No Worker code changes required for Kommo/Claude specifically; only the `/data` GET/POST endpoints become dead code to remove at the end.

## Data Flow

### Request Flow (post-migration, per domain)

```
[User edits order in modal]
    ↓
[saveModal()] → [ordersRepo.upsert(order)] → [supabase.from('orders').upsert()]
    ↓                                              ↓
[optimistic local DATA update + renderAll()]   [PostgREST → Postgres]
    ↓                                              ↓
[localStorage mirror write (offline cache)]    [RLS policy checks client_id = auth.client_id()]
                                                    ↓
                                              [row written, response returned]
                                                    ↓
                                        [on error: toast + retry/queue,
                                         DATA/localStorage stay authoritative until synced]
```

### Auth-Gated Boot Sequence (new)

```
[Page load]
    ↓
[supabase.auth.getSession()] — restore from persisted refresh token (no re-login on reopen)
    ↓
  session? ──no──→ [show login screen] → signInWithPassword() → session
    │yes
    ↓
[resolve currentClientId from user_clients] (cache in memory for session)
    ↓
[load() — per domain: Supabase if migrated, else localStorage as today]
    ↓
[renderAll()]
```

### Key Data Flows

1. **Tenant resolution:** happens once per session (after login/refresh), not per request — `currentClientId` cached in a JS variable, used to stamp `client_id` on every insert (RLS also independently verifies it server-side, so a stale/tampered client value can't leak cross-tenant, it can only fail the write).
2. **Cross-device sync (replaces today's `/data` KV sync):** Postgres *is* the sync mechanism — every device authenticated as the same user reads the same rows via RLS. No custom polling/debounce logic needed once a domain is fully migrated (this retires ~200 lines of `_cloudPush`/`_cloudPull`/debounce code per migrated domain).
3. **Offline-first fallback:** unmigrated domains keep working exactly as today (localStorage + Worker `/data`) throughout the transition — this is what makes "migrate one domain at a time without breaking Bruna" achievable. Migrated domains add a localStorage mirror + "pending sync" indicator for true offline support (Supabase realtime/offline isn't built-in for browser fetch calls the way Drive's "last write wins" was).
4. **Kommo/Claude flows:** unchanged network path (frontend → Worker → external API → frontend); only the final persistence step (`save()` for merged leads) changes what backend it targets, once `orders` domain is migrated.

## Scaling Considerations

Florelle-scale (single tenant today, low tens of tenants expected per PROJECT.md's SaaS ambition) means classic scaling concerns (query load, connection pooling) are not the priority. The priorities are correctness of isolation and migration safety.

| Scale | Architecture Adjustments |
|-------|---------------------------|
| 1 tenant (today, mid-migration) | Dual-path repo functions (Supabase-if-migrated, else localStorage) are enough; no pooling/caching needed |
| 2-50 tenants | Current design (RLS + indexed `client_id`, PostgREST direct) handles this comfortably on Supabase's free/small tiers; watch connection count if many browser tabs stay open (PostgREST uses its own pooler, not a concern at this scale) |
| 50+ tenants / heavier usage | Revisit: JWT custom claims (avoid the `user_clients` join per session), consider Supabase connection pooling (Supavisor, already default), add composite indexes if filtering by `client_id + status` becomes a hot path (kanban board filters by stage) |

### Scaling Priorities

1. **First real risk is not scale, it's a missing/incorrect RLS policy** — a table with RLS enabled but no policy silently returns zero rows (fails safe but breaks the app); a table with RLS *disabled* silently leaks cross-tenant (fails unsafe and is invisible in normal testing). Mitigation: a smoke test that logs in as two different test tenants and asserts each only sees its own rows, run after every domain migration — this should gate the "migration complete" checkpoint for each of the 4 domains, not just a manual eyeball check.
2. **Second risk: `client_id` spoofing from the client.** Because writes originate in the browser, always enforce `client_id` server-side via `with check` on RLS, never trust a `client_id` value sent from the frontend as authoritative — treat it as a UX convenience only.

## Anti-Patterns

### Anti-Pattern 1: Big-bang cutover ("rewrite the storage layer, ship once")

**What people do:** Replace all of `load()`/`save()` at once across all 4 domains (kanban, financeiro, inventário, contratos) in a single change, then test in production.
**Why it's wrong:** PROJECT.md is explicit that Bruna's live operation cannot break; a single-file monolith with 20+ globals means an error in one domain's Supabase wiring can cascade (shared `DATA` array, shared `renderAll()`). One bug = the whole app breaks, not just one feature.
**Do this instead:** Domain-by-domain migration exactly as specified (Kanban → financeiro → inventário → contratos), each domain fully working and tested (including the "two tenants see only their own data" smoke test) before starting the next. Each domain migration is its own deployable, revertible commit.

### Anti-Pattern 2: Trusting RLS alone without also keeping UI-level guards

**What people do:** Assume "RLS is on, so we're secure" and skip any application-level check, then get confused when a misconfigured policy (e.g., missing `WITH CHECK` on an `UPDATE` policy) allows a write nobody intended.
**Why it's wrong:** RLS is the correctness floor, but a missing `WITH CHECK` clause on write policies is a common, easy-to-miss mistake — `USING` alone governs which rows are visible for the operation, not what values can be written into them.
**Do this instead:** Every write policy gets both `USING` and `WITH CHECK` with the same `client_id` predicate; write the two-tenant isolation smoke test once and re-run it after every schema change, not just once at the end.

### Anti-Pattern 3: Letting the Cloudflare Worker become a second, competing source of truth for tenant data

**What people do:** Keep the `/data` KV endpoint "just in case" alongside Supabase, with both getting writes during a long transition period, planning to reconcile "later."
**Why it's wrong:** Two writable stores for the same data with no reconciliation logic is exactly the "monolithic cloud sync, no conflict resolution" anti-pattern already flagged in the existing ARCHITECTURE.md — introducing a second copy of the same problem defeats the purpose of migrating.
**Do this instead:** Per-domain hard cutover: once `orders` is migrated, `save()` for orders stops writing to Worker `/data` entirely for that domain (localStorage stays as a *local* cache/fallback, not a second network sync target). Remove the KV app-data keys for that domain once migration is verified, rather than leaving them to rot.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|----------------------|-------|
| Supabase Auth | `supabase-js` in-browser, session persisted via refresh token (localStorage under the hood, managed by the SDK, not app code) | Handles the "don't ask to log in every time" requirement natively — no custom token logic needed |
| Supabase Postgres (PostgREST) | `supabase-js` `.from(table)` calls directly from the browser using the anon key; RLS is the only real access control | Anon key is safe to expose client-side by design (that's the point of RLS) — do not use the service-role key in the frontend, ever |
| Cloudflare Worker (existing) | Unchanged fetch calls for `/sign`, `/contract`, `/analyze-wa`, `/kommo*` | No code changes needed to these routes for Fase 1; only `/data` becomes obsolete post-migration |
| Cloudflare KV (existing) | Unchanged for signing tokens, WA cache, Kommo webhook buffer | Only the app-data-sync keys under `/data` are retired |
| Google Drive/Calendar/Tasks (existing) | Untouched | Out of scope per PROJECT.md (Fase 2); no interaction with Supabase in this phase |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|----------------|-------|
| UI/business logic ↔ Data Access Layer (repos) | Direct function calls (`ordersRepo.upsert()`) | This is the seam that makes incremental migration possible — introduce it BEFORE touching any domain's storage, even before Supabase project exists, so domain 1's migration is "swap the repo's internals," not "rewrite call sites in saveModal()" |
| Data Access Layer ↔ Supabase | `supabase-js` client, calls PostgREST | One shared `supabase` client instance, initialized once at boot after auth |
| Data Access Layer ↔ localStorage | Direct `localStorage.getItem/setItem`, namespaced per domain | Kept for offline fallback + rollback safety net during transition; can be fully retired per-domain later, not required for Fase 1 |
| Frontend ↔ Cloudflare Worker | `fetch()` calls, unchanged | No auth token currently passed to Worker (CORS-only, per existing ARCHITECTURE.md) — out of scope to harden in this phase unless Worker starts touching tenant data, which it shouldn't need to |
| Worker ↔ Supabase | None required for Fase 1 | If a future need arises (e.g., Worker writing contract PDFs to Postgres storage), use the service-role key server-side only, never client-side — flagged as a Fase 2+ concern, not needed now |

## Suggested Build Order (dependency-driven)

1. **Schema first, no app wiring yet.** Create the Supabase project, `clients`/`user_clients` tables, and one table per domain (`orders`, `payments`/nested JSON, `inventory`, `contracts`) all with `client_id uuid not null references clients(id)`, RLS enabled, indexed, with `USING`/`WITH CHECK` policies from day one (even before any data lives there). This can be built and reviewed with zero risk to the live app since nothing points at it yet.
2. **Seed Florelle as tenant #1.** Insert one row into `clients` for Florelle, one row into `user_clients` mapping Bruna's future auth user to it. Write (and dry-run) the migration script that reads existing localStorage/KV data shapes and inserts them into the new tables — do this against a copy of real data, not live, first.
3. **Auth, gated but non-breaking.** Add Supabase Auth (login screen, session restore) behind a feature flag or a "skip if not configured" guard, so the existing single-tenant flow keeps working untouched until this is proven. Signup/login/forgot-password can be built and tested in isolation before any data domain depends on it.
4. **Introduce the Data Access Layer seam.** Refactor `save()`/`load()` call sites to go through per-domain repo functions that, for now, just wrap the existing localStorage logic (no behavior change yet). This is the highest-leverage low-risk step — it's pure refactor, testable against the current app with no Supabase dependency, and it's the prerequisite for every subsequent step.
5. **Migrate Kanban (orders) first** — highest-value, most-used domain, but also the one PROJECT.md explicitly names first. Swap `ordersRepo` internals to call Supabase, keep localStorage as fallback/mirror, run the two-tenant isolation smoke test, verify Bruna's real data round-trips correctly, ship.
6. **Migrate Financeiro, then Inventário, then Contratos**, same pattern each time: swap one repo's internals, test in isolation, verify against real data, ship independently. Contratos last because it's entangled with the Worker's `/sign` flow (signed contract HTML currently lives in KV) — needs the most care to decide whether signed contract storage also moves to Postgres or stays in KV (recommend: leave signed-contract blob storage in KV/Worker for Fase 1, only move the `contrato` metadata/status fields to Postgres, to minimize blast radius on the signing flow that already works).
7. **Retire `/data` KV endpoint and dead localStorage-as-source-of-truth code** only after all 4 domains are confirmed stable in production with real usage — not as part of any individual domain's migration step.

This order front-loads all the zero-risk work (schema, seed, auth scaffold, repo-layer refactor) before any live-data cutover happens, and makes each of the 4 domain migrations an independent, revertible unit of work — directly matching the "never break Bruna" constraint in PROJECT.md.

## Sources

- [Supabase RLS Best Practices: Production Patterns for Secure Multi-Tenant Apps](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) — MEDIUM confidence (third-party tutorial, cross-checked against Supabase's own RLS docs concepts)
- [Authorization via Row Level Security | Supabase Features](https://supabase.com/features/row-level-security) — HIGH confidence (official Supabase docs)
- [row-level security policies in Supabase for a multitenant application — GitHub community discussion](https://github.com/orgs/community/discussions/149922) — MEDIUM confidence (community discussion, directionally consistent with official docs)
- [Is it possible to use supabase in the browser without a build process? — supabase/supabase#136](https://github.com/supabase/supabase/issues/136) — HIGH confidence (maintainer-confirmed on official repo)
- [@supabase/supabase-js CDN by jsDelivr](https://www.jsdelivr.com/package/npm/@supabase/supabase-js) — HIGH confidence (official package CDN listing)
- Existing project docs: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/INTEGRATIONS.md`, `.planning/PROJECT.md` — HIGH confidence (primary source, current codebase state)

---
*Architecture research for: Supabase multi-tenant auth + RLS integration into Florelle's existing single-file PWA + Cloudflare Worker architecture*
*Researched: 2026-08-09*
