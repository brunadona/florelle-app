# Pitfalls Research

**Domain:** Supabase Auth + Postgres RLS multi-tenancy retrofit onto an existing single-tenant client-side app (localStorage → Postgres migration)
**Researched:** 2026-08-09
**Confidence:** MEDIUM (cross-checked against Supabase official docs + multiple independent incident write-ups/community reports; no project-specific prior art to verify against)

## Critical Pitfalls

### Pitfall 1: RLS never enabled, or enabled inconsistently across tables

**What goes wrong:**
A new table is created (`clients`, `kanban_cards`, `financeiro`, `inventario`, `lembretes`, `contratos`, ...) and RLS is left disabled — the Postgres default. Every row becomes readable/writable by anyone hitting the Supabase auto-generated REST API (PostgREST), regardless of `client_id`. This is the single most common real-world Supabase breach pattern: attackers scan for `.supabase.co` hosts and hit `/rest/v1/<table>?select=*` directly. Because this project has ~6 tenant-owned data domains being migrated one at a time, the specific risk is **partial coverage**: RLS gets enabled on `kanban_cards` in migration step 1 but the team forgets it on `financeiro` when that table is created in migration step 2 — inconsistent protection across tables that all *look* equally "done" from the UI.

**Why it happens:**
- The Supabase SQL Editor bypasses RLS, so a developer can query/insert freely there and everything looks correct — there's no error to signal the table is exposed.
- The Supabase Dashboard shows a warning badge for tables without RLS, but this is easy to miss when tables are created via SQL migration files rather than the dashboard UI.
- Enabling RLS with zero policies makes a table return empty results (fails safe) — but if a permissive default policy exists or is added carelessly "to make it work," it fails open instead.

**How to avoid:**
- Add `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;` and `ALTER TABLE <table> FORCE ROW LEVEL SECURITY;` in the *same migration file* that creates the table — never as a separate follow-up step.
- Maintain a single checklist/script that runs `SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false;` and treat any non-empty result as a release blocker before each incremental migration step (Kanban → financeiro → inventário → contratos).
- Never test correctness from the SQL Editor or with the service role — always test from a real client session (see Pitfall 6).

**Warning signs:**
- Any table added mid-migration without a corresponding RLS-enable line in the same PR/migration.
- Data visible in a fresh `supabase-js` query using the anon key with no explicit session (should return nothing/error if RLS is correctly deny-by-default).

**Phase to address:**
Schema + RLS setup phase (every table creation step), re-verified at each incremental data-migration step (Kanban → financeiro → inventário → contratos → config), not just once at the start.

---

### Pitfall 2: RLS enabled but policy logic is wrong — leaks across tenants without any error

**What goes wrong:**
RLS is on, policies exist, everything "works" in manual testing — but the policy is subtly wrong and one company's data becomes visible to another. Concretely, for this project's `client_id`-column model, the most likely failure modes are: (a) a policy written against `auth.uid()` directly (`auth.uid() = owner_id`) when the actual authorization boundary is `client_id`, so once a second user is added to a client (or a bug in the JWT claim mapping happens) the check silently passes for the wrong user; (b) a `USING` clause present for `SELECT` but no matching `WITH CHECK` clause for `INSERT`/`UPDATE`, which lets an authenticated user insert or update rows tagged with *someone else's* `client_id` even though they can't read them back; (c) `auth.uid() IS NULL` edge case — an unauthenticated or token-refresh-race request where `auth.uid()` returns null, and a policy like `client_id = (select client_id from users where id = auth.uid())` silently evaluates to no match on some paths and matches unexpectedly on others depending on operator semantics.

**Why it happens:**
RLS bugs never throw an error — the query simply returns wrong data (too much, or a cross-tenant row) or too little (silently empty). This makes it the most under-tested class of bug in Supabase apps: it doesn't break the UI in an obviously visible way if the two test tenants happen to test with non-overlapping data, so "it works" in manual QA even when the isolation guarantee is broken.

**How to avoid:**
- Every table gets four explicit policies (or one `FOR ALL` policy with both `USING` and `WITH CHECK`), never rely on `USING` alone for write operations.
- Resolve `client_id` for the current user through a single `SECURITY DEFINER` helper function (e.g. `get_my_client_id()`) referenced in every policy, rather than repeating the `auth.uid()` → `client_id` lookup inline in each policy — this also sidesteps the RLS-recursion trap (Pitfall 5) and gives one place to fix if the lookup logic changes (e.g. when/if multi-user-per-client is decided).
- Add explicit `AND client_id IS NOT NULL` / `auth.uid() IS NOT NULL` guards rather than relying on implicit null comparison semantics.
- Always specify `TO authenticated` on policies (never leave the role implicit) so anonymous/public requests are never even evaluated against the policy.

**Warning signs:**
- Any policy written as `auth.uid() = <column>` in a schema where the real boundary is `client_id`, not a 1:1 user:row relationship.
- Any table with a `USING` clause but no `WITH CHECK` (visible by inspecting `pg_policies`).
- Manual QA only ever testing with one populated account and one empty account — an empty second account can't reveal a leak, only a two-populated-accounts test can (see Pitfall 6).

**Phase to address:**
Schema + RLS setup phase (policy authoring), with a dedicated verification step before migration of each feature domain begins.

---

### Pitfall 3: service_role key exposure — especially dangerous in this project's no-build static-HTML architecture

**What goes wrong:**
The `service_role` key bypasses RLS entirely — full read/write on every table, every tenant, no exceptions. In a normal bundled app this key is easy to keep server-side only via env vars. This project is a **single-file `index.html` with no build step, deployed directly to GitHub Pages** (a public static host). There is no server runtime on the client side to hide secrets in — anything placed in `index.html` is public. The realistic failure mode here is a developer (or an AI assistant) copy-pasting the `service_role` key into `index.html` "to make it write" during debugging (because RLS is blocking a write and the service key "just works"), then forgetting to remove it before commit/push.

**Why it happens:**
When an RLS policy blocks an insert unexpectedly, the fastest way to "unblock" locally is to swap the anon key for the service key — it always works because it ignores RLS. This is a natural, high-frequency temptation specifically during the incremental migration phase when policies are still being debugged per feature.

**How to avoid:**
- The `service_role` key must never appear in `index.html`, in any file committed to the repo, or in any browser-executed code. The only legitimate place for it in this architecture is inside the **Cloudflare Worker** (server-side), for the specific backend operations that genuinely need to bypass RLS (e.g. the contract-signing webhook, Kommo sync, WhatsApp/Claude analysis) — and even there, the Worker code must manually filter by `client_id` itself since RLS won't do it for a service-role connection.
- Add a pre-commit/pre-push grep check for the service key pattern (Supabase service keys are JWTs with `"role":"service_role"` in the payload) before every push to `index.html`.
- If a write is blocked by RLS during development, treat that as a signal to fix the policy — never as a signal to switch keys.

**Warning signs:**
- Any commit diff touching `index.html` that introduces a new Supabase key literal.
- A "quick fix" that swaps `SUPABASE_ANON_KEY` for a different key constant to unblock a failing insert during testing.

**Phase to address:**
Auth/schema setup phase (establish the rule up front) — actively re-checked at every commit during the migration phase, since that's when the temptation to bypass RLS "just to get it working" is highest.

---

### Pitfall 4: Client-side filtering mistaken for isolation (porting the old localStorage mental model)

**What goes wrong:**
The existing Florelle app is 100% client-side: all "isolation" today is just "there's only one company's data in localStorage, full stop." When porting logic to Supabase, it's very easy to unconsciously carry over that mental model: write JS that does `SELECT * FROM kanban_cards WHERE client_id = currentClientId` and consider that "isolated," without RLS ever verifying the claim server-side. If RLS is missing or misconfigured, this JS-side filter is cosmetic — anyone with the (public, expected-to-be-public) anon key can call the REST API directly and omit the filter, or pass a different `client_id`, and get every tenant's data. This is the exact vulnerability class described in the "misconfigured Supabase" mass-exposure incidents referenced below — the app looked fine because the legitimate UI always filtered client-side, while the API underneath was wide open.

**Why it happens:**
Filtering in application code "looks correct" in every manual test through the UI, because the UI always sends the filter. The gap only shows up when someone (an attacker, or a proper test) bypasses the UI and queries the API directly.

**How to avoid:**
- Treat `WHERE client_id = X` in application JS as a *performance/UX convenience*, never as the security boundary. The security boundary is exclusively the RLS policy.
- The first end-to-end multi-tenant test (Pitfall 6) must query the Supabase REST API directly (or via `supabase-js` with a real session) and must not rely on the app's own JS filters at all.

**Warning signs:**
- Code review turning up any place where "isolation" is justified by pointing at a `.eq('client_id', ...)` call in JS rather than at the RLS policy on the table.

**Phase to address:**
Schema + RLS setup phase (mindset/architecture decision), verified explicitly in the multi-tenant testing phase.

---

### Pitfall 5: RLS policy infinite recursion when resolving `client_id` from the authenticated user

**What goes wrong:**
Because isolation here is by `client_id`, not directly by `auth.uid()`, every policy needs to resolve "which client does this user belong to" — typically via a lookup against a `users`/`clients` (or junction) table. If that lookup is written as a plain subquery inside the policy (`client_id = (SELECT client_id FROM user_clients WHERE user_id = auth.uid())`) and the lookup table *itself* has RLS enabled, Postgres can end up evaluating the lookup table's own RLS policy as part of resolving the outer policy — which, depending on how it's written, either recurses infinitely (Postgres errors out) or evaluates in a way that's hard to reason about.

**Why it happens:**
It's the natural way to write the query, and it works fine until the lookup table also gets RLS enabled (which it should, since it also contains tenant-scoped data) — at which point the two policies can reference each other.

**How to avoid:**
- Resolve `client_id` via a `SECURITY DEFINER` SQL function (e.g. `get_my_client_id()` returning `uuid`) that queries the lookup table with elevated privilege, bypassing that table's own RLS for the sole purpose of this lookup. Reference the function, not the raw subquery, in every policy.
- Mark the function `STABLE` (not `VOLATILE`) so Postgres can cache/optimize its evaluation per statement.
- Wrap `auth.uid()` calls as `(select auth.uid())` inside policies — this is also the officially documented performance pattern (see Pitfall 8), and reduces the chance of the planner re-evaluating the subquery per row.

**Warning signs:**
- Any RLS policy with a raw `SELECT ... FROM <other RLS-protected table> WHERE ...` inline in its `USING`/`WITH CHECK` clause.
- Postgres error `"infinite recursion detected in policy for relation ..."` during testing — treat this as expected-to-happen-eventually and design around it up front rather than firefighting later.

**Phase to address:**
Schema + RLS setup phase — decide the `client_id`-resolution pattern once, before writing per-table policies, especially given the multi-user-per-client decision is still open (PROJECT.md Key Decisions) and will make this lookup indirection necessary regardless.

---

### Pitfall 6: The "first multi-tenant test" tests the UI, not the database boundary — false confidence

**What goes wrong:**
A common way teams "verify" isolation is: create two test accounts, log in as each in the browser, confirm each sees only their own data in the UI, and call it done. This does **not** prove isolation — it only proves the JS filter works (Pitfall 4). It also commonly uses one populated account and one empty account, which cannot detect a leak at all: an empty account showing an empty screen looks identical whether RLS is correctly blocking cross-tenant rows or is simply broken and returning nothing for unrelated reasons (e.g. a bad `client_id` join).

**Why it happens:**
Testing through the UI is the natural first instinct and does catch obvious breakage; it just doesn't test the actual authorization boundary, and a false negative (thinks it's safe, isn't) is worse than a false positive here.

**How to avoid:**
- Both test accounts must have populated, known data (e.g. Account A has a card titled `"AAA-only-card"`, Account B has `"BBB-only-card"`) before the test is meaningful.
- The test must assert three things, not one: (1) querying as A returns exactly A's rows, no more, no less; (2) querying as B returns exactly B's rows; (3) querying as A for B's specific known row ID returns zero rows (not just "not in the list" — an actual direct-ID fetch attempt), and vice versa. Only condition 3 actually proves a cross-tenant read is blocked.
- Run the test via `supabase-js` with real auth sessions (or direct REST calls with each user's access token) — not via the SQL Editor and not via service role, both of which bypass RLS and would give a false pass.
- Automate this as a repeatable script/CI check, not a one-time manual click-through — RLS regressions are silent (no error, just wrong data), so a check that only ran once during initial setup gives no protection against a later migration step or policy edit quietly reintroducing a leak.

**Warning signs:**
- A "proof of isolation" that consists of screenshots of two logged-in browser sessions.
- A test plan with only one account populated with data.
- No automated regression test for RLS — it was "verified" once by hand and never re-run.

**Phase to address:**
Dedicated multi-tenant verification phase, explicitly separate from and after the auth/RLS implementation phase — this should be the phase's own success-metric gate (PROJECT.md already names "isolamento de dados comprovado entre 2+ contas de teste" as the success metric; this pitfall is about making sure that proof is real).

---

### Pitfall 7: Incremental migration causes split-brain between the old Cloudflare Worker sync and new Supabase writes for Bruna's live data

**What goes wrong:**
Florelle (Bruna) is simultaneously the production user who cannot experience downtime *and* the first tenant of the new schema. The existing app syncs across her devices via the Cloudflare Worker `/data` endpoint (Cloudflare KV). The migration plan moves one feature domain at a time (Kanban → financeiro → inventário → contratos). During the window where, say, Kanban has been cut over to Supabase but financeiro hasn't, there is a real risk of **split-brain**: if any code path (old sync logic, a stale open browser tab, a cached service worker) still writes Kanban data to the old Worker/KV path after cutover, that write is silently lost (nothing reads from KV anymore) or, worse, a stale device pulls old KV data back down and overwrites newer Supabase-sourced state in localStorage cache.

**Why it happens:**
The app is a PWA with a service worker and offline-first caching — exactly the kind of architecture where "which write happened last, and where" is easy to lose track of, especially with multiple devices (Bruna's phone + desktop) that may not refresh their cached app version at the same time.

**How to avoid:**
- Cut over one full feature domain at a time, and once cut over, make the old Worker/KV path for that domain **read-only or fully retired** (not just "unused by new code") so a stale client can't silently write to a dead-end.
- Bump the service worker cache version at each cutover (the project already does this per commit history — keep doing it deliberately at each migration step, not just for UI fixes).
- Before migrating each feature domain, export/back up Bruna's current localStorage/KV data for that domain so there's a recovery point if the migration script has a bug.
- Test the cutover with Bruna's *real* data copied into a staging/test Supabase project first, not with synthetic data only — her real data is the actual risk surface (edge cases in existing records, unexpected nulls, etc.).

**Warning signs:**
- Any code path that can still write to the old Worker `/data` endpoint for a feature domain after that domain has been declared "migrated."
- No documented rollback/recovery point before a migration step runs against Bruna's live data.

**Phase to address:**
Incremental migration phase — one gate per feature domain (Kanban, financeiro, inventário, contratos): confirm the old write path is retired and a backup exists before starting the next domain.

---

### Pitfall 8: RLS policy performance trap — unwrapped `auth.uid()` and missing index on `client_id`

**What goes wrong:**
This is a "not yet, but will bite" pitfall for a growing SaaS: writing policies as `client_id = get_my_client_id()` without wrapping the function call, and without an index on `client_id`, causes Postgres to re-evaluate the lookup per row and do a sequential scan per query. At Florelle's current single-tenant scale this is invisible; the moment there are several paying tenants each with meaningful data volume (contratos, financeiro history), query latency degrades sharply and non-obviously, since the symptom is "the app got slow" with no error to point at RLS specifically.

**Why it happens:**
The naive, most-readable way to write a policy is also the slowest one, and nothing in normal development flags the performance cost since Postgres query plans aren't visible in day-to-day Supabase usage.

**How to avoid:**
- Wrap volatile/auth calls as `(select auth.uid())` and use a `STABLE` `SECURITY DEFINER` function for the `client_id` lookup (ties directly into the Pitfall 5 fix) — Postgres can then cache the result once per statement instead of per row.
- Add a btree index on `client_id` on every tenant-scoped table as part of the same migration that adds the column — not as a later optimization pass.
- Avoid joins inside policy definitions where possible (e.g. avoid a policy that joins from the target table to another table row-by-row); prefer resolving the allowed `client_id` once via the helper function and comparing against a scalar.

**Warning signs:**
- `EXPLAIN ANALYZE` on a tenant-scoped query showing a sequential scan on a table expected to be indexed on `client_id`.
- Query latency that grows with total data across *all* tenants rather than staying flat relative to one tenant's own data volume.

**Phase to address:**
Schema + RLS setup phase (index + function pattern established before real load exists) — low cost to fix now, expensive to retrofit once several tenants have real data volume.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Writing RLS policies as raw `auth.uid() = ...` inline instead of via a `SECURITY DEFINER` helper function | Faster to write for the first table | Recursion risk (Pitfall 5), performance risk (Pitfall 8), and painful to refactor once 6+ tables each embed the same inline logic | Never — the helper function costs almost nothing to set up first and every table needs the same lookup |
| Using the service_role key temporarily in `index.html` to "get past" an RLS block while debugging | Unblocks a write instantly | Real risk of the key being committed/pushed to a public GitHub Pages repo (Pitfall 3) | Never in this architecture — there is no non-public place in a static-HTML app to "temporarily" put a secret |
| Testing RLS only through the SQL Editor / manual UI click-through | Fast, no test infra needed | False confidence — doesn't test the actual authorization boundary (Pitfall 6) | Only as a first smoke test during development, never as the final verification |
| Skipping the localStorage backup/export step before migrating a feature domain for Bruna | Saves a small amount of setup time per migration step | No recovery point if the migration script has a bug against real production data | Never for Bruna's live data — acceptable only against synthetic/staging data |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|-------------------|
| Supabase JS client in a no-build static HTML app | Embedding the wrong key (service_role instead of anon) directly in `index.html`, or embedding any key that looks like a "fix" for an RLS error | Only ever embed the anon/publishable key client-side; verify by decoding the JWT payload and confirming `"role":"anon"` before every commit touching the key |
| Cloudflare Worker ↔ Supabase (for contract signing, Kommo sync, WhatsApp/Claude analysis) | Assuming the Worker "inherits" RLS protection because it calls the same Supabase project | The Worker, if it uses the service_role key (which it likely needs to, to act across tenants for webhooks), must manually filter/validate `client_id` in its own code — RLS provides zero protection for service-role connections |
| Supabase Auth session persistence in a PWA with a Service Worker | Service worker caching a stale auth state or an old bundle that doesn't refresh tokens correctly, causing silent auth failures that look like data-loss bugs | Bump SW cache version at every auth-related change (project already does this pattern); explicitly test session refresh across a SW update |
| GitHub Pages (static, public) as the deploy target | Treating `index.html` like a private server file where secrets are "probably fine" during active development | Assume everything in the repo is public from the first commit — there is no draft/private state for a public GitHub Pages repo |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Unindexed `client_id` column | Slow queries, high DB CPU, symptom appears as generic "app is slow" | Add btree index on `client_id` on every tenant table at creation time | As soon as 2-3 tenants have realistic data volume (dozens-hundreds of rows per table) |
| Unwrapped `auth.uid()` / non-`STABLE` lookup function in policies | Query latency scales with total rows scanned, not rows returned | Wrap as `(select auth.uid())`, mark lookup function `STABLE`, use `SECURITY DEFINER` | Same threshold — a handful of real tenants, not thousands |
| Joins embedded directly inside RLS policy `USING`/`WITH CHECK` clauses | Query plans that look fine in isolation get much worse combined with policy evaluation | Resolve tenant identity once via a scalar-returning function; avoid joins inside policy bodies | Noticeable once tables have real row counts (hundreds+) rather than a handful of demo rows |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| service_role key in any client-executed code (browser JS, `index.html`) | Full cross-tenant data read/write/delete by anyone who inspects the page source of a public GitHub Pages site | Service key lives only inside the Cloudflare Worker's server-side environment; never in the repo's client-facing files |
| RLS policies relying on `user_metadata` for authorization decisions (if any role/admin distinction gets added later) | `user_metadata` is user-editable via the client SDK — a user could grant themselves elevated access | Use `app_metadata` (only settable server-side) for any authorization-relevant claim, never `user_metadata` |
| Views/RPC functions that join tenant tables without re-applying RLS-equivalent filtering | A view or `SECURITY DEFINER` function can silently bypass the RLS that protects its underlying tables, becoming an unintentional backdoor | On Postgres 15+, create views with `security_invoker = true`; for any `SECURITY DEFINER` function beyond the tenant-lookup helper, manually filter by the resolved `client_id` inside the function body |
| No automated re-test of isolation after each incremental migration step | A policy edit or new table added mid-migration silently reintroduces a leak with no error signal | Re-run the two-account isolation test (Pitfall 6) after every migration step, not just once at project start |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Forcing Bruna to re-authenticate immediately after the auth cutover | Feels like a regression from "always logged in" PWA behavior she's used to | Ensure persistent session (refresh token) works correctly before cutover, and pre-seed her session so the transition is invisible |
| Silent data-loss during migration (no error, just missing kanban cards after cutover) | Erodes trust immediately — she's the one real production user and the whole point is zero perceived downtime | Every migration step should have a visible-if-something-fails signal (even just a console warning surfaced in a debug panel) rather than failing silently |
| "Esqueci minha senha" flow untested until a real user needs it | First real use of a broken password-reset flow locks a paying client out with no recourse | Test the full password-reset email round trip with a real inbox before considering auth "done," not just that the API call succeeds |

## "Looks Done But Isn't" Checklist

- [ ] **RLS enabled:** Often assumed because *some* tables have it — verify with `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public'` covering every table, including ones added late in the migration.
- [ ] **Policies cover all operations:** Often only `SELECT` is tested — verify `INSERT`/`UPDATE`/`DELETE` policies exist and have matching `WITH CHECK` clauses via `SELECT * FROM pg_policies`.
- [ ] **Isolation "proof":** Often just two logged-in browser tabs with screenshots — verify with a real two-populated-account, direct-ID-fetch test (Pitfall 6), ideally scripted/repeatable.
- [ ] **Key hygiene:** Often assumed correct because "it's just the key from the dashboard" — verify by decoding the JWT in `index.html` and confirming it is the anon key, not service_role, every time the key literal changes.
- [ ] **Migration completeness for a feature domain:** Often marked "done" once the new UI works — verify the *old* Worker/KV write path for that domain is actually retired/read-only, not just unused by the new code.
- [ ] **Password reset flow:** Often assumed to work because Supabase "handles it" — verify an actual end-to-end email round trip, since email deliverability/template config is a common silent failure point.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|------------------|
| RLS missing/misconfigured discovered after some real tenant data exists | MEDIUM | Immediately enable/fix RLS (deny-by-default is safe to apply live), audit Supabase logs / PostgREST access logs for any anomalous cross-`client_id` reads during the exposure window, notify affected tenant(s) per whatever disclosure norm applies |
| service_role key committed to the public repo | HIGH | Rotate the key immediately in the Supabase dashboard (old key becomes invalid), purge it from git history (it remains in history even after a follow-up commit removes it from the file), audit for any unexpected writes/deletes made using the leaked key during the exposure window |
| Split-brain data loss during Bruna's incremental migration (old Worker write clobbers new Supabase state or vice versa) | MEDIUM-HIGH | Restore from the pre-migration-step localStorage/KV backup (Pitfall 7's prevention step is what makes this recoverable at all — without it, recovery cost is HIGH/possibly unrecoverable) |
| RLS recursion error blocks the app in production | LOW | Refactor the offending policy to use the `SECURITY DEFINER` helper function pattern; this is a targeted, well-understood fix once diagnosed |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| RLS disabled / partial coverage (P1) | Schema + RLS setup, re-checked at each incremental migration step | `SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity=false` returns empty before each cutover |
| Misconfigured policy logic / missing WITH CHECK (P2) | Schema + RLS setup | Two-populated-account isolation test (P6) passes for every CRUD operation, not just SELECT |
| service_role key exposure (P3) | Schema + RLS setup (rule established), enforced continuously during migration | JWT-payload check on any key literal touching `index.html` before every push |
| Client-side filtering mistaken for isolation (P4) | Schema + RLS setup (architecture decision) | Multi-tenant test bypasses app JS entirely and hits the API/SDK directly |
| RLS recursion on client_id lookup (P5) | Schema + RLS setup, before writing per-table policies | Attempt a full CRUD cycle as a test user immediately after adding the second RLS-protected lookup table |
| Weak "first multi-tenant test" (P6) | Dedicated multi-tenant verification phase | Automated script asserting the three-condition test (own rows only, other's rows only, direct cross-ID fetch denied) is runnable repeatedly, ideally re-run after each migration step |
| Split-brain during Bruna's live migration (P7) | Incremental migration phase, per feature domain | Old Worker/KV write path confirmed retired + backup snapshot exists before starting the next feature domain |
| RLS performance trap (P8) | Schema + RLS setup (index + function pattern from day one) | `EXPLAIN ANALYZE` on a tenant-scoped query shows index usage, not sequential scan, even at current low data volume |

## Sources

- [Supabase Docs — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — official, HIGH confidence (vendor documentation, fetched directly)
- [Hacking Thousands of Misconfigured Supabase Instances at Scale — deepstrike.io](https://deepstrike.io/blog/hacking-thousands-of-misconfigured-supabase-instances-at-scale) — independent security research write-up, MEDIUM confidence
- [How misconfigured Supabase APIs exposed sensitive data across thousands of organizations — Medium/Ctrl cipher](https://medium.com/@ctrl_cipher/how-misconfigured-supabase-apis-exposed-sensitive-data-across-thousands-of-organizations-162e24363c22) — MEDIUM confidence, corroborates the deepstrike findings
- [Supabase RLS: Common Misconfigurations & Risks — securifyai.co](https://securifyai.co/blog/supabase-row-level-security-rls-common-misconfigurations-and-security-risks/) — MEDIUM confidence
- [Supabase Docs — Troubleshooting: why is my service role key client getting RLS errors or not returning data](https://supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z) — official, HIGH confidence
- [Supabase Docs — Securing your data](https://supabase.com/docs/guides/database/secure-data) — official, HIGH confidence
- [Testing Row-Level Security (RLS) Policies in PostgreSQL with pgTAP: A Supabase Example — Blair Jordan / Medium](https://blair-devmode.medium.com/testing-row-level-security-rls-policies-in-postgresql-with-pgtap-a-supabase-example-b435c1852602) — MEDIUM confidence, practical pgTAP pattern for two-tenant isolation tests
- [Row Level Security for Tenants in Postgres — Crunchy Data Blog](https://www.crunchydata.com/blog/row-level-security-for-tenants-in-postgres) — established Postgres vendor engineering blog, MEDIUM-HIGH confidence
- [Supabase RLS SECURITY DEFINER: Preventing Infinite Recursion in Admin Policies — dev.to](https://dev.to/kanta13jp1/supabase-rls-security-definer-preventing-infinite-recursion-in-admin-policies-4go2) — MEDIUM confidence
- [RLS policy causes infinite recursion — Supabase GitHub Discussion #47525](https://github.com/orgs/supabase/discussions/47525) — community/vendor discussion forum, MEDIUM confidence
- [Infinite recursion when using users table to specify users role for RLS — Supabase GitHub Discussion #1138](https://github.com/supabase/supabase/discussions/1138) — community/vendor discussion forum, MEDIUM confidence
- [Row-Level Security in Supabase: Multi-Tenant SaaS from Day One — dev.to](https://dev.to/issuecapture/row-level-security-in-supabase-multi-tenant-saas-from-day-one-4lon) — MEDIUM confidence
- General dual-write / zero-downtime migration pattern literature (Mercari Engineering, Google Cloud Community) reviewed for the incremental-migration section — MEDIUM confidence, generic (non-Supabase-specific) but directly applicable to the localStorage→Postgres cutover risk

---
*Pitfalls research for: Supabase-based multi-tenant SaaS auth + data isolation retrofit onto Florelle*
*Researched: 2026-08-09*
