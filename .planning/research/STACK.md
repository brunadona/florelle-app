# Technology Stack

**Project:** Florelle SaaS — Fase 1: Auth + Isolamento de Dados (Supabase multi-tenant layer)
**Researched:** 2026-08-09
**Confidence:** MEDIUM (web-sourced, cross-checked against multiple independent results pointing at the same official Supabase docs pages; no direct docs-MCP access available in this session)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@supabase/supabase-js` | `^2.112.x` (v2, load unpinned major `@2` via CDN so patches land automatically) | Auth client + Postgres data client (PostgREST) from the browser | Official JS SDK; ships a browser-ready UMD bundle so it drops into a no-build, CDN-only app exactly like `html2canvas`/`jspdf`/`jszip` already do in this codebase. No npm/bundler step required. |
| Supabase Postgres + Row Level Security | Managed (project-level, no version to pin) | Multi-tenant data isolation at the database layer, enforced server-side | RLS policies run inside Postgres itself — isolation holds even if client JS has a bug, unlike isolating "by convention" in `localStorage`/app code. This is the whole point of moving off pure client-side storage. |
| Supabase Auth (GoTrue) | Managed, accessed via supabase-js `auth.*` | Email + password signup/login, session issuance, refresh tokens, password reset | Matches the PROJECT.md constraint exactly (email+password only, no social login yet) and issues the JWT that RLS policies read via `auth.uid()` — auth and authorization are one integrated system, not two to wire together. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None beyond `@supabase/supabase-js` | — | — | Do not add `@supabase/ssr`, `@supabase/auth-helpers-*`, or any Next.js-oriented Supabase package — those are for server-rendered frameworks and assume cookies/middleware that don't exist in this static-file PWA. The base `supabase-js` client (browser localStorage session storage) is the correct and only package needed here. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Supabase Dashboard SQL Editor | Write/run RLS policies and migrations | No local Supabase CLI/Docker setup is required for this phase — the project has no build step anywhere else, so doing schema work directly in the hosted SQL editor (and pasting the SQL into a versioned `.sql` file in the repo for history) keeps the same "no local toolchain" philosophy. Adopt the Supabase CLI later only if migrations become frequent enough to need diffing. |
| Browser DevTools → Application → Local Storage | Inspect/debug the `sb-<project-ref>-auth-token` session entry | Useful for diagnosing the offline/PWA session-restore issue described below. |

## Installation

```html
<!-- In index.html, alongside the existing CDN <script> tags for html2canvas/jspdf/jszip -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
  const supabase = window.supabase.createClient(
    'https://<project-ref>.supabase.co',
    '<publishable-key>' // sb_publishable_..., NOT the secret key — see "publishable vs secret keys" below
  );
</script>
```

No `npm install` — this stays 100% consistent with the existing no-build-step CDN pattern already used for `html2canvas`, `jspdf`, and `jszip`.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| CDN `<script src="…/@supabase/supabase-js@2">` (UMD global) | jsDelivr `+esm` dynamic-ESM build (`import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'`) | Never, for this project. It is documented to throw `Cannot read properties of null (reading 'AuthClient')` in the browser because internal submodules export `default null` and only expose named exports — a real, reported breakage, not a hypothetical. Use the plain UMD `<script src>` tag instead; it's also what the official docs lead with for non-bundler usage. |
| `client_id` column + RLS (row-level, single shared schema) | Separate Postgres schema per tenant | Already ruled out in PROJECT.md constraints — noting here only to confirm the research agrees: schema-per-tenant does not scale operationally for "N small clients" and complicates the incremental-migration plan (Kanban → financeiro → inventário → contratos) since every schema-touching change would need to run N times. Row-level RLS is the correct choice for this scale and migration strategy. |
| Junction table (`client_users`) for user↔client mapping | `auth.uid()` treated directly as `client_id` | Only acceptable if it is contractually guaranteed forever that each tenant has exactly one login. See decision section below — this project should not take that risk even though Fase 1 only has one real tenant (Florelle) today, because retrofitting a second user per client later means an RLS/schema migration, not just a UI change. |
| `sb_publishable_...` / `sb_secret_...` new-format API keys | Legacy `anon` / `service_role` JWT keys | Only if the Supabase project predates the new key system and hasn't been migrated. New projects created from ~Nov 2025 onward no longer issue legacy keys at all; legacy keys are being fully retired by end of 2026. Since this is a new project being provisioned now, start directly with the new key format — no migration debt. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| `service_role` / `sb_secret_...` key anywhere in `index.html` or client JS | It bypasses RLS entirely — shipping it to the browser hands out full read/write access to every tenant's data, which is the exact failure mode this phase exists to prevent | `publishable` (formerly `anon`) key only, client-side. Anything that truly needs to bypass RLS (e.g. an admin backfill script) runs from a trusted server context (the existing Cloudflare Worker, or a one-off local script), never from `index.html`. |
| jsDelivr `+esm` (or any dynamic-ESM CDN transform) for supabase-js | Breaks at runtime in-browser (see Alternatives table) | UMD `<script src>` global, as shown in Installation. |
| `@supabase/ssr`, `@supabase/auth-helpers-nextjs`, cookie-based session helpers | Built for server-rendered frameworks with middleware; assumes a Node/Deno/Next server this project doesn't have and won't have in Fase 1 | Base `@supabase/supabase-js` client with default browser `localStorage` session storage. |
| Treating `auth.uid()` as the tenant key directly (no junction table) | Works today (1 tenant, presumably 1 login) but is a structural dead end the moment any client — including Florelle herself — needs a second staff login; changing it later means migrating every RLS policy and every foreign key assumption across all tables | `client_users` junction table from day one (see Decision below) — costs almost nothing extra now, saves a full re-migration later. |
| Relying solely on `supabase.auth.getSession()` at PWA boot to decide "is the user logged in" | Community-reported behavior: `getSession()`/`setSession()` can trigger a network call on init, and if the device is offline at that exact moment it can falsely report no session even though a valid cached session exists in storage — a real risk for a PWA the Bruna expects to open reliably, sometimes with a flaky connection | Read the `sb-<project-ref>-auth-token` entry from `localStorage` directly on boot as a first-paint fallback before/alongside calling `getSession()`, and treat "cached session present but network unreachable" as logged-in-degraded rather than logged-out. Flag this as a pitfall for the phase that implements session bootstrapping. |

## Stack Patterns by Variant

**If a client (tenant) will only ever have exactly one login, forever, by contract:**
- `auth.uid()` could theoretically double as `client_id` directly on a `clients` table (`clients.owner_user_id = auth.uid()`).
- This project should NOT choose this path — see Decision below — but it's the simpler pattern if it were ever appropriate.

**If a client (tenant) may have 2+ staff logins sharing the same data (the realistic case for a bridal/events business with employees):**
- Use a `client_users` junction table (`user_id uuid references auth.users`, `client_id uuid references clients`, `role text`).
- Every RLS policy on every data table does `client_id IN (SELECT client_id FROM client_users WHERE user_id = auth.uid())`, wrapped in a `SECURITY DEFINER` function to avoid RLS-on-RLS recursion (junction table itself needs RLS: "user can see their own membership rows").
- **This is the recommended pattern for Florelle SaaS**, even though today there is exactly one real tenant with (presumably) one login — see rationale below.

**If read/write query volume per tenant gets large enough that the junction-table subquery becomes a measurable cost:**
- Add a custom access-token hook that stamps `client_id` into `auth.jwt()` `app_metadata` at login/refresh, and have RLS policies read `(select auth.jwt() -> 'app_metadata' ->> 'client_id')` instead of subquerying `client_users` per row.
- Defer this — it's a real optimization but adds a moving part (must force session refresh whenever tenant membership changes) that isn't justified at "N small clients" scale. Not needed for Fase 1.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `@supabase/supabase-js@2` (any 2.x) | Supabase-hosted Postgres project, any current version | v2 is the current major; no v3 exists as of this research. Pin to `@2` (not a specific patch) in the CDN URL so the app auto-picks up patch/minor fixes, consistent with how a no-build-step app should consume a CDN dependency — full pinning would require manually bumping the URL on every security fix. |
| `@supabase/supabase-js@2` | New-format API keys (`sb_publishable_...` / `sb_secret_...`) | Confirmed supported; new and legacy key formats work simultaneously during Supabase's migration window, so no version constraint blocks starting with the new key format on a fresh project. |
| RLS policies using `auth.uid()` | Requires requests to carry the user's JWT (i.e. client initialized with the publishable key and a logged-in session) | Requests made with the publishable key but no active session (anonymous) will have `auth.uid()` return `null` — make sure every table's policy explicitly requires `TO authenticated` (not just relying on `client_id` matching null-safely) so anonymous access fails closed, not open. |

## Sources

- https://supabase.com/docs/reference/javascript/installing — CDN/UMD install pattern for supabase-js v2 (MEDIUM confidence — surfaced via WebSearch, not fetched directly; content is consistent with the official install page and cross-referenced by jsDelivr's own package page)
- https://github.com/orgs/supabase/discussions/41118 — documented breakage of jsDelivr `+esm` build in-browser (MEDIUM confidence — GitHub Discussion, cross-checked against the CDN caveat surfaced independently in the installing-docs search)
- https://supabase.com/docs/guides/auth/sessions — session/refresh-token model, `autoRefreshToken`/`persistSession`/`detectSessionInUrl`, PKCE flow recommendation (MEDIUM confidence)
- https://github.com/orgs/supabase/discussions/36434 and https://github.com/orgs/supabase/discussions/36906 — offline/PWA session-restore gap with `getSession()`/`setSession()` triggering network calls (MEDIUM confidence — community discussions, but consistent across two independent threads)
- https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv — wrap `auth.uid()`/`auth.jwt()` in `SELECT` for initPlan caching, index tenant/user id columns (MEDIUM confidence)
- https://github.com/orgs/community/discussions/149922 and https://dev.to/kanta13jp1/supabase-rls-deep-dive-multi-tenant-access-control-11ig — `client_id`/`tenant_id` RLS policy patterns, junction-table pattern with `SECURITY DEFINER` to avoid recursion (MEDIUM confidence)
- https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys — publishable/secret key system replacing legacy anon/service_role JWT keys, timeline (legacy keys retired by end of 2026) (MEDIUM confidence)
- https://www.npmjs.com/package/@supabase/supabase-js — current version confirmed ~2.112.x as of researched date (MEDIUM confidence)

**Note on confidence:** No Context7 or docs-MCP tool was available in this session, so all findings come from `WebSearch` rather than a direct docs fetch. Confidence is upgraded from the tool's default LOW to MEDIUM only where multiple independent search results converged on the same official `supabase.com/docs/...` URL and the same technical claim. Recommend a lightweight verification pass (open the actual `supabase.com/docs/reference/javascript/installing` and `.../guides/auth/sessions` pages) before committing to code, since these are foundational choices for the whole phase.

---
*Stack research for: Supabase Auth + multi-tenant RLS layer on a no-build-step vanilla-JS PWA*
*Researched: 2026-08-09*
