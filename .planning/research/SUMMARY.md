# Project Research Summary

**Project:** Florelle SaaS — Fase 1: Auth + Isolamento de Dados (Supabase multi-tenant layer)
**Domain:** B2B vertical SaaS retrofit — multi-tenant auth + Postgres RLS onto an existing single-file, no-build-step client-side PWA
**Researched:** 2026-08-09
**Confidence:** MEDIUM

## Executive Summary

Florelle is being turned from a single-tenant, client-side-only PWA (vanilla JS + localStorage + Cloudflare Worker/KV) into a multi-tenant SaaS, with Florelle herself becoming tenant #1. Experts building this kind of "add auth + real isolation to an existing live single-file app" retrofit converge on one architecture: Supabase Auth + Postgres with Row Level Security (RLS) as the sole security boundary, consumed directly from the browser via the `supabase-js` UMD CDN build (no bundler, matching the existing `html2canvas`/`jspdf`/`jszip` pattern), with a `clients` + `user_clients` join table modeling tenants rather than conflating `auth.uid()` with `client_id`. The Cloudflare Worker is not replaced — it keeps owning contract signing, Kommo sync, and Claude/WhatsApp analysis; only its `/data` KV endpoint (today's cross-device sync mechanism) becomes obsolete once Postgres+RLS takes over that role.

The recommended approach is aggressively incremental and risk-ordered: build schema + RLS with zero app-wiring risk first, seed Florelle as tenant #1, add auth behind a safe fallback, introduce a Data Access Layer (repo) seam as a pure refactor with no behavior change, then cut over one feature domain at a time (Kanban → Financeiro → Inventário → Contratos) — each domain a fully tested, independently revertible unit, with localStorage demoted to an offline cache rather than deleted. This directly serves the non-negotiable constraint that Bruna's live business operation cannot experience downtime or data loss during the migration.

The dominant risk is not stack choice or feature scope — it's RLS correctness, which fails silently (wrong or missing data, no error) rather than loudly. The single most important process discipline this phase must adopt is: RLS enabled in the same migration as table creation, every write policy paired with both `USING` and `WITH CHECK`, tenant resolution routed through one `SECURITY DEFINER` helper function (avoiding both infinite recursion and per-row performance costs), and a real two-populated-account, direct-ID-fetch isolation test re-run after every schema change — not a one-time manual UI click-through, which cannot detect a leak at all. Secondary but concrete risks: `service_role` key exposure (this is a public static-HTML repo with literally no private place to hide a secret client-side) and split-brain between the old Worker/KV sync path and new Supabase writes during the incremental cutover window.

## Key Findings

### Recommended Stack

The stack is minimal by design and fits the existing no-build-step philosophy exactly: `@supabase/supabase-js` v2 loaded via the UMD `<script src>` CDN tag (never the jsDelivr `+esm` dynamic-ESM build, which is documented to break in-browser), Supabase-hosted Postgres with RLS as the multi-tenant isolation mechanism, and Supabase Auth (GoTrue) for email+password only (matching PROJECT.md's explicit no-social-login constraint this phase). No additional npm packages, no `@supabase/ssr` or auth-helpers (those target server-rendered frameworks this project doesn't have). New-format `sb_publishable_...` keys should be used from day one since this is a freshly provisioned project.

**Core technologies:**
- `@supabase/supabase-js` (v2, CDN UMD) — auth client + Postgres data client — official SDK, browser-ready, zero build step, consistent with existing CDN dependency pattern
- Supabase Postgres + RLS — multi-tenant data isolation enforced server-side inside the database — holds even if client JS has bugs, unlike the app's current "isolation by convention" (there's only one tenant in localStorage today)
- Supabase Auth (GoTrue) — email+password signup/login/session, issues the JWT that RLS reads via `auth.uid()` — integrated system, not two things to wire together

### Expected Features

Table stakes here are scoped to a solo/small-business tenant logging in from her phone — not an enterprise IT-buyer checklist (SSO/SCIM/RBAC are explicitly out of scope and would be premature complexity for this user base).

**Must have (table stakes):**
- Email+password signup, login, logout
- Email verification (requires custom SMTP — Supabase's default provider throttles ~2 emails/hour and will break under any real testing)
- Password reset ("forgot password") flow, tested end-to-end with a real inbox
- Persistent, offline-tolerant session (PWA reopened many times a day from a home-screen icon — must not force-logout on failed token refresh while offline)
- `client_id` + RLS isolation on every data table, proven with 2+ real test accounts
- Minimal read-only admin tenant list (Bruna-only visibility, just enough to confirm signups worked)
- Florelle's real production data migrated as tenant #1, verified with zero loss, incrementally per feature domain

**Should have (differentiators specific to this migration):**
- Incremental per-feature migration with the old localStorage/KV path kept alive as fallback until each slice is verified
- One-off scripted data adoption for Bruna's existing data (not a general-purpose import wizard)
- "Which tenant am I" UI indicator (cheap, low priority — P2)

**Defer (v2+):**
- Social login, MFA/2FA, SSO/SCIM/RBAC, multi-user-per-tenant invite flows, full admin panel (CRUD/impersonation/analytics), big-bang cutover — all explicitly out of scope per PROJECT.md and/or premature for current tenant count

### Architecture Approach

Supabase replaces Cloudflare KV as the system of record for tenant data but coexists with the Worker, which keeps its narrow, unchanged responsibilities (contract signing, Kommo, WhatsApp/Claude analysis). The key structural addition is a Data Access Layer — small per-domain repo functions (`ordersRepo`, `paymentsRepo`, `inventoryRepo`, `contractsRepo`) inserted as their own `<script>` block inside `index.html` — that gives every call site one seam to swap from localStorage to Supabase per domain, instead of scattering `supabase.from()` calls across a 6000-line file. This repo-layer refactor is explicitly sequenced as step 1 (pure refactor, zero Supabase dependency, fully testable against the current app) before any live-data cutover begins.

**Major components:**
1. Data Access Layer (repo functions) — isolates all Supabase/localStorage calls behind small per-domain functions; the single highest-leverage structural change enabling safe incremental migration
2. Supabase Auth + Postgres/RLS — issues JWTs and enforces `client_id` isolation server-side via `clients` + `user_clients` join table and a `SECURITY DEFINER` helper function, not raw `auth.uid()` comparisons
3. Cloudflare Worker (unchanged scope) — retains contract signing, Kommo sync, Claude/WhatsApp analysis; only the `/data` KV endpoint is retired once all 4 domains are cut over
4. localStorage — demoted from source-of-truth to offline cache/mirror per migrated domain, kept as a rollback safety net during the transition

### Critical Pitfalls

1. **RLS never enabled, or enabled inconsistently across tables** — enable RLS in the *same* migration file that creates each table; run `SELECT tablename FROM pg_tables WHERE rowsecurity=false` as a release-blocking check before every incremental cutover.
2. **RLS policy logic wrong (missing `WITH CHECK`, `auth.uid()` used where `client_id` is the real boundary)** — every write policy needs both `USING` and `WITH CHECK`; resolve `client_id` through one shared `SECURITY DEFINER` helper function referenced everywhere, never inline per-table.
3. **service_role key exposure** — this is a public static-HTML repo with no private runtime; the service key must never appear in `index.html` or any committed file — only inside the Cloudflare Worker's server environment.
4. **Client-side filtering mistaken for real isolation** — `.eq('client_id', ...)` in JS is UX convenience only; the security boundary is exclusively the RLS policy, and the first real isolation test must bypass the app's UI/JS filters entirely.
5. **Weak "first multi-tenant test" gives false confidence** — two logged-in browser tabs with screenshots proves nothing; the real test needs two *populated* accounts and an explicit direct-ID cross-tenant fetch attempt that must return zero rows, automated and re-run after every migration step.
6. **Split-brain during incremental migration** — once a feature domain is cut over, the old Worker/KV write path for that domain must become read-only/retired, not just "unused," with a pre-migration backup/export of Bruna's real data as a recovery point.

## Implications for Roadmap

Based on combined research, the build order should front-load all zero-risk work (schema, seed data, auth scaffold, repo-layer refactor) before touching any live data, then migrate one feature domain at a time.

### Phase 1: Schema, RLS, and Tenant Model (zero app-wiring risk)
**Rationale:** Can be built and reviewed with zero risk to the live app since nothing points at it yet; establishes the correctness floor (RLS) before any client code depends on it — the highest-value place to get things right, since RLS bugs are silent.
**Delivers:** Supabase project provisioned; `clients` + `user_clients` join tables; one table per domain (`orders`, `payments`, `inventory`, `contracts`) each with `client_id` column, RLS enabled + indexed, `USING`/`WITH CHECK` policies via a `SECURITY DEFINER` helper function from day one.
**Addresses:** `client_id` + RLS isolation (FEATURES.md table stakes); the "1 user = 1 client vs N users" open decision resolved via the join-table pattern.
**Avoids:** Pitfalls 1, 2, 5, 8 (RLS disabled/partial coverage, missing WITH CHECK, recursion, unindexed/unwrapped performance trap) — all cheapest to prevent before any real data or app code exists.

### Phase 2: Auth Scaffold + Repo-Layer Refactor (non-breaking, parallel-safe)
**Rationale:** Both are pure-addition/pure-refactor work that can be built and tested in isolation without touching the live single-tenant flow; the repo-layer seam is the prerequisite for every subsequent domain migration.
**Delivers:** Login/signup/logout/password-reset UI wired to Supabase Auth (behind a fallback so existing flow keeps working); Data Access Layer repo functions (`ordersRepo`, `paymentsRepo`, `inventoryRepo`, `contractsRepo`) that initially just wrap existing localStorage logic with no behavior change.
**Uses:** `@supabase/supabase-js` v2 (CDN UMD), Supabase Auth (GoTrue), custom SMTP (required before enabling email verification).
**Implements:** Data Access Layer component; Auth-Gated Boot Sequence (session restore before `load()`).

### Phase 3: Multi-Tenant Isolation Verification (dedicated gate, not a checkbox)
**Rationale:** PITFALLS.md flags this as the single most commonly faked verification step — must be its own explicit phase/gate, not folded silently into "auth is done."
**Delivers:** Automated, repeatable two-populated-account isolation test (own rows only, other's rows only, direct cross-ID fetch denied) run via real sessions/API calls, bypassing app JS filters entirely.
**Addresses:** PROJECT.md's stated success metric — "isolamento de dados comprovado entre 2+ contas de teste."
**Avoids:** Pitfall 6 (false-confidence UI-only testing) and Pitfall 4 (client-side filtering mistaken for isolation).

### Phase 4: Incremental Domain Migration — Kanban first
**Rationale:** Highest-value, most-used domain, explicitly named first in PROJECT.md's own plan; establishes the cutover pattern to repeat for the remaining 3 domains.
**Delivers:** `ordersRepo` internals swapped to Supabase; localStorage kept as offline mirror; two-tenant isolation smoke test re-run; Bruna's real Kanban data migrated and verified with zero loss; old Worker `/data` write path for this domain retired.
**Addresses:** Incremental migration differentiator from FEATURES.md; "never break Bruna" constraint.
**Avoids:** Pitfall 7 (split-brain) via backup-before-migrate + hard retirement of the old write path per domain, not a soft "just unused" state.

### Phase 5: Migrate Financeiro, Inventário, Contratos (same pattern, sequential)
**Rationale:** Repeats the proven Phase 4 pattern per domain, in the order PROJECT.md specifies; Contratos last because it's entangled with the Worker's `/sign` flow and needs the most care (recommend leaving signed-contract blob storage in KV, only moving metadata/status to Postgres).
**Delivers:** All 4 domains fully cut over, each independently tested and shipped; `/data` KV endpoint and dead localStorage-as-source-of-truth code retired only after all 4 are confirmed stable in production.
**Addresses:** Full completion of the multi-tenant retrofit.
**Avoids:** Big-bang cutover anti-pattern (ARCHITECTURE.md Anti-Pattern 1) and Worker-as-second-source-of-truth anti-pattern (Anti-Pattern 3).

### Phase Ordering Rationale

- Schema/RLS is sequenced first because it carries zero risk to the live app (nothing depends on it yet) and because RLS mistakes are the highest-severity, hardest-to-detect risk in this whole project — cheapest to get right before any data or dependent code exists.
- Auth and the repo-layer refactor are grouped together because both are additive/non-breaking and both are hard prerequisites for any domain migration to even begin, but neither requires the other to be done first — they can proceed in parallel.
- The isolation-verification phase is deliberately pulled out as its own gate (not bundled into "RLS setup is done") because PITFALLS.md's research specifically flags this as the step teams most often fake with a shallow UI-only test.
- Domain migrations are sequenced Kanban → Financeiro → Inventário → Contratos per PROJECT.md's own explicit order, each one an independent revertible unit — this avoids the big-bang cutover anti-pattern and lets each domain's split-brain risk window be as short as possible.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Schema + RLS):** RLS policy authoring, `SECURITY DEFINER` helper function pattern, and JWT custom-claim optimization have well-documented official patterns but no project-specific prior art — verify exact syntax against live Supabase docs before writing policies (STACK.md and ARCHITECTURE.md both flag MEDIUM confidence, no direct docs-MCP fetch was available this session).
- **Phase 4/5 (Domain migrations, especially Contratos):** the Contratos domain's entanglement with the existing `/sign` Worker flow and KV-stored signed-contract HTML needs a scoped decision (keep blob in KV vs. move to Postgres storage) that wasn't fully resolved by research — flagged as needing a deliberate call at planning time.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Auth scaffold + repo-layer refactor):** Supabase Auth signup/login/logout/reset flows are extremely well-documented, standard patterns; the repo-layer refactor is a plain JS engineering pattern, not novel.
- **Phase 3 (Isolation verification):** the two-account/direct-ID-fetch test pattern is clearly specified in PITFALLS.md with concrete steps.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Core recommendations (CDN UMD supabase-js, RLS, GoTrue) cross-checked across multiple independent WebSearch results converging on the same official docs URLs, but no direct Context7/docs-MCP fetch was available this session — recommend a verification pass on `supabase.com/docs/reference/javascript/installing` and `.../guides/auth/sessions` before coding |
| Features | MEDIUM | Supabase Auth mechanics are well-documented (HIGH); the "what's table-stakes for a tiny vertical B2B SaaS" judgment is synthesis grounded directly in PROJECT.md's explicit constraints (higher confidence) rather than in generic B2B SaaS checklists (which were explicitly rejected as wrong-sized) |
| Architecture | HIGH/MEDIUM split | RLS/auth architecture patterns are well-documented and verified against current official docs (HIGH); the specific integration with Florelle's existing `worker.js` and single-file structure is reasoned inference from the existing codebase docs, not a found public case study (MEDIUM) |
| Pitfalls | MEDIUM | Cross-checked against Supabase official docs plus multiple independent incident write-ups and community reports (misconfigured-Supabase mass-exposure research is well corroborated); no project-specific prior art exists to verify against, since this exact retrofit scenario is unique to Florelle |

**Overall confidence:** MEDIUM

### Gaps to Address

- No Context7/docs-MCP access was available in this research session — all findings are WebSearch digests. Recommend a lightweight direct-docs verification pass (installing/sessions/RLS-performance pages) before implementation begins, per STACK.md's own caveat.
- The "1 user = 1 client, or can a client have multiple users" decision is flagged as still open in PROJECT.md. Research recommends resolving this via the `clients` + `user_clients` join-table pattern from day one regardless of the answer (cheap now, expensive to retrofit later) — but the actual policy answer should be confirmed with Bruna before Phase 1 RLS policies are finalized.
- Contratos' entanglement with the existing `/sign` Worker flow and KV-stored signed HTML needs an explicit scoping decision at planning time (see Research Flags above) — research recommends leaving the blob in KV and only moving metadata to Postgres, but this should be validated against the actual signing flow code before committing.
- Custom SMTP provider selection/setup was identified as a hard prerequisite for enabling email verification but wasn't itself researched (which provider, cost, setup steps) — needs a small follow-up before Phase 2.

## Sources

### Primary (HIGH confidence)
- https://supabase.com/features/row-level-security — official Supabase docs on RLS
- https://github.com/supabase/supabase/issues/136 — maintainer-confirmed browser-without-build-process usage
- https://www.jsdelivr.com/package/npm/@supabase/supabase-js — official CDN package listing
- https://supabase.com/docs/guides/database/postgres/row-level-security — official RLS guide
- https://supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z — official troubleshooting doc
- https://supabase.com/docs/guides/database/secure-data — official securing-data guide
- C:/florelle/.planning/codebase/ARCHITECTURE.md, .planning/codebase/INTEGRATIONS.md, .planning/PROJECT.md — primary source, current codebase and constraints

### Secondary (MEDIUM confidence)
- https://supabase.com/docs/reference/javascript/installing — CDN/UMD install pattern (WebSearch digest, cross-referenced)
- https://github.com/orgs/supabase/discussions/41118 — jsDelivr `+esm` in-browser breakage
- https://supabase.com/docs/guides/auth/sessions — session/refresh-token model
- https://github.com/orgs/supabase/discussions/36434 and 36906 — offline/PWA session-restore gap
- https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv — RLS performance patterns
- https://github.com/orgs/community/discussions/149922 and dev.to/kanta13jp1 — RLS policy/recursion patterns
- https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys — new key format
- https://deepstrike.io/blog/hacking-thousands-of-misconfigured-supabase-instances-at-scale — real-world misconfiguration incident research
- https://medium.com/@ctrl_cipher/ — corroborating misconfiguration research
- https://makerkit.dev/blog/tutorials/supabase-rls-best-practices — production RLS patterns tutorial
- https://blair-devmode.medium.com/testing-row-level-security-rls-policies — pgTAP two-tenant isolation testing pattern
- https://www.crunchydata.com/blog/row-level-security-for-tenants-in-postgres — Postgres vendor engineering blog on tenant RLS

### Tertiary (LOW confidence, needs validation)
- Various dev.to / GitHub Discussion threads on RLS recursion and B2B SaaS auth checklists (Auth0, Descope blogs) — used for context/framing, not load-bearing technical claims

---
*Research completed: 2026-08-09*
*Ready for roadmap: yes*
