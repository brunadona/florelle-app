# Feature Research

**Domain:** B2B vertical SaaS auth + multi-tenant data isolation (Supabase Auth, email+password only)
**Researched:** 2026-08-09
**Confidence:** MEDIUM (Supabase Auth mechanics well-documented/HIGH; "what's table-stakes for a tiny vertical B2B SaaS" is judgment-based synthesis/MEDIUM; no primary-source verification of Supabase docs was done directly — findings are WebSearch digests, treat specific API behavior as needing a docs double-check before coding)

## Context Note

This is Fase 1 of a 4-phase plan for Florelle: a single-file PWA (vanilla JS + localStorage) run by one person (Bruna), being turned into a multi-tenant SaaS where Florelle becomes tenant #1. There is no sales team, no IT buyer, no enterprise procurement checklist — the "B2B SaaS auth table stakes" that show up in generic search results (SSO, SCIM, audit logs, RBAC) belong to a different market segment (mid-market/enterprise identity vendors selling to companies with an IT department) and are explicitly wrong-sized for this milestone. Table stakes below are scoped to **what a small business owner logging into a paid tool from her phone actually needs**, not what an enterprise buyer's security questionnaire asks for.

## Feature Landscape

### Table Stakes (Users Expect These)

Features a solo/small-business tenant assumes exist. Missing these = the app feels broken or unsafe to trust with business data.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Email+password signup | Baseline entry point; already decided (no social login this phase) | LOW | Supabase `signUp()`; validate email format + password strength client-side, re-validate server-side (Supabase enforces min length server-side by default) |
| Email+password login | Baseline | LOW | `signInWithPassword()`; must surface clear errors ("Invalid login credentials") not raw exceptions |
| Logout | Users expect to be able to leave a shared/borrowed device safely | LOW | `signOut()`; must also clear any client-cached tenant data so a second login on the same device doesn't flash stale data |
| Email verification (confirm email) | Prevents typo'd emails locking someone out of password reset later; standard on every SaaS signup | LOW-MEDIUM | Supabase "Confirm email" toggle; when ON, `signUp()` returns a user but **no session** until the link is clicked — the signup UI must explicitly say "check your email" rather than silently failing to log in. Requires custom SMTP once real usage starts (default provider throttles ~2 emails/hour, will break quickly with even a handful of test signups) |
| Password reset ("forgot password") | Every credentialed app needs a self-service recovery path — support-desk password resets don't scale to a SaaS product | LOW-MEDIUM | `resetPasswordForEmail()` + a dedicated "set new password" page gated behind the `PASSWORD_RECOVERY` auth event; must not reveal whether an email exists (enumeration protection is built into Supabase, don't defeat it with a custom "email not found" error) |
| Persistent session (stay logged in) | This is a PWA opened dozens of times a day from a phone home-screen icon — forcing re-login each open is an instant trust-breaker | LOW | Default Supabase JS client already persists session + refresh token in `localStorage`; the real work is handling the **offline case**: token refresh needs network, so app must not force-logout on a failed refresh while offline — treat it as "stale, will retry," not "unauthenticated" |
| Data isolation that actually holds (RLS) | Table stakes for *any* multi-tenant product — a single visible cross-tenant leak destroys trust permanently, worse than any missing feature | MEDIUM-HIGH | Out of pure "auth UX" scope but is the actual core value per PROJECT.md; every table needs `client_id` + RLS policy, tested with 2+ real accounts before shipping |
| "Which tenant am I" indicator in UI | With multiple companies now sharing the same codebase/login screen, a user needs a visible cue of which business account they're in (was invisible before because there was only one) | LOW | Minimal: show company name somewhere persistent (header/nav). Prevents "wrong tenant" confusion, especially if Bruna herself ends up testing with 2 accounts |
| Loading/error states on auth actions | Bare minimum polish; without this, slow networks make the login button feel broken (users double-click, submit twice) | LOW | Disable submit button + spinner while request in flight; this is standard, not a differentiator |

### Differentiators (Not Required, But Valuable Given This Project's Constraints)

These aren't what a generic SaaS auth checklist would call "differentiators" (that's usually SSO/enterprise polish) — here the differentiators are specific to the **zero-downtime, zero-data-loss migration constraint** that's unusual for a "just add auth" milestone.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Incremental per-feature migration (Kanban → financeiro → inventário → contratos) with old localStorage path kept alive as fallback until each slice is verified | Directly satisfies the constraint "Florelle continues working 100% during and after migration" — this is the actual hard/risky part of this milestone, not the login form | MEDIUM-HIGH | For each slice: write to Supabase, verify read-back matches, only then switch the UI's read path off localStorage. Keep a manual "compare localStorage vs Supabase" debug view during the transition to self-detect drift, then remove it once stable |
| Silent/automatic first-login data adoption for Bruna's account (treat her existing localStorage as the seed data for `client_id` = Florelle, not a manual import flow) | Avoids building a generic "import your data" wizard that will never be reused (there's exactly one real migration: Bruna's own data) — a one-time scripted migration is far cheaper than a UI-driven import flow | LOW-MEDIUM | This should be a one-off script/admin action, not a user-facing feature. Do not build a general-purpose importer for this phase — see anti-features below |
| Minimal internal admin view: list of tenants (companies) that exist, created date, maybe last-login | Gives Bruna (as the only admin) visibility into whether new signups actually worked, without building a real admin product | LOW | PROJECT.md explicitly scopes this down: "só o mínimo funcional... sem polimento." A single unstyled table read via a Supabase query with RLS bypassed by service role (server-side only) is enough — resist the urge to add tenant management actions (suspend, edit, impersonate) this phase |
| Auth state resilient to PWA-installed / home-screen-icon reopen patterns | Bruna and future tenants will mostly open this from a home-screen PWA icon, which behaves differently from a browser tab (can be suspended for days, opened directly to a route, no referrer) | LOW-MEDIUM | Test explicitly: install as PWA, background it for a day, reopen — session should still work or refresh gracefully, not dump the user to a blank/error screen |

### Anti-Features (Commonly Requested, Often Problematic — Explicitly Out of Scope This Phase)

| Feature | Why It Seems Good | Why Problematic Right Now | Alternative |
|---------|--------------------|-----------------------------|-------------|
| Social login (Google/Apple OAuth) | Faster signup, fewer forgotten passwords | Explicitly deferred per PROJECT.md constraints; also collides with the existing Google OAuth (Bruna's *personal* account for Drive/Calendar) which is a separate Fase 2 concern — mixing them now creates confusing auth-provider entanglement | Ship email+password only this phase; revisit per-client Google OAuth in Fase 2 as already planned |
| SSO/SAML, SCIM provisioning, RBAC/permission roles | "Real B2B SaaS" checklists list these as table stakes | Aimed at enterprise buyers with IT departments and many seats per tenant; each tenant here is a solo florist business owner — building this now is pure premature complexity with zero customers asking for it | Defer indefinitely; revisit only if/when a customer with multiple staff logins under one company actually appears |
| Multi-user-per-tenant / invite teammates flow | Seems inevitable for "B2B" | Not decided yet whether one client = one user account (explicitly flagged as an open decision to document in PROJECT.md, not resolved) — building an invite system before that decision is made risks designing the wrong data model twice | Resolve the "can a client have multiple users" schema decision first (affects RLS design); build invites later if needed |
| General-purpose "import your data" wizard/UI | Feels like the natural feature to pair with "migrate localStorage to Supabase" | There is exactly one real migration subject (Bruna/Florelle) in this phase — a user-facing importer is speculative generality for a problem that has one instance | One-off migration script run once against Florelle's real data, verified manually, then deleted/archived |
| Full admin panel (tenant CRUD, impersonation, billing hooks, analytics) | Natural extension once you have a tenant list | Explicitly out of scope per PROJECT.md ("painel de admin completo... sem polimento"); billing itself is Fase 4 | Read-only tenant list, nothing else, this phase |
| Magic-link / passwordless email login | Nice modern UX, avoids password reset flows entirely | Not requested, adds a second auth flow to reason about (magic link + password coexist awkwardly), and PROJECT.md explicitly locks scope to email+password | Skip; password reset flow covers the "forgot credentials" case adequately |
| MFA/2FA | Commonly cited as a security table-stake | No customer requirement yet, adds signup friction for a low-risk-profile early user base (a handful of small businesses, not handling payment data directly this phase since billing is Fase 4) | Revisit alongside Fase 4 billing work when real payment/PII sensitivity increases |
| Redesigning login/signup UI beyond functional minimum | Tempting to "make it nice" while touching auth screens | PROJECT.md explicitly locks UI/UX redesign out of this phase ("a interface não muda visualmente") | Functional, unstyled-or-matching-existing forms only; visual polish is a separate later QA pass |
| Big-bang cutover (migrate all data/tables at once, flip a switch) | Simpler to reason about than incremental migration | Directly violates the "Florelle continues working 100% during and after" constraint — any bug in a big-bang migration takes down the one paying/real user with no fallback | Per-feature incremental migration with legacy path kept live as fallback (see Differentiators) |

## Feature Dependencies

```
Supabase project + `clients` table + `client_id` on all data tables
    └──requires──> RLS policies per table (using client_id / user↔client link)
                       └──requires──> Decision: 1 user = 1 client, or client can have N users
                                          └──blocks──> multi-user invite flow (deferred anyway)

Email+password signup/login
    └──requires──> Supabase project + Auth email provider configured
    └──enables──> Session persistence (session object only exists post-login)
    └──enables──> Password reset flow (needs an existing account to reset)

Email verification (Confirm email ON)
    └──requires──> Custom SMTP configured (default provider's ~2/hr limit breaks real testing fast)
    └──affects──> Signup UX (must handle "no session yet, check your email" state, not just success/fail)

Incremental data migration (localStorage → Supabase, per feature)
    └──requires──> client_id schema + RLS in place (data must land somewhere isolated)
    └──requires──> Auth working (need a client_id to attach migrated rows to)
    └──enables──> Minimal admin tenant list (only meaningful once real tenants + their data exist)

Minimal admin tenant list
    └──requires──> `clients` table populated via signup flow
    └──conflicts with──> Full admin panel (explicitly descoped; don't let this grow)
```

### Dependency Notes

- **Migration requires auth + schema first, not the other way around:** you cannot migrate Florelle's localStorage data into a `client_id`-scoped row until there is a `clients` table and at least one real account (Bruna's) exists to own that `client_id`. Sequence: schema/RLS → auth → migration, not migration → auth.
- **Email verification requires custom SMTP to actually be usable:** shipping "Confirm email: ON" while still on Supabase's default email provider will silently break after a couple of test signups (rate limit), producing confusing "email never arrived" bug reports. This is a hard prerequisite, not a nice-to-have.
- **The "1 user = 1 client" decision gates RLS policy shape:** PROJECT.md flags this as undecided ("vínculo usuário↔cliente, se decidido que um cliente pode ter múltiplos usuários"). Whichever way this resolves determines whether RLS policies check `auth.uid() = clients.owner_id` directly or go through a join table — decide before writing RLS, since retrofitting is expensive once policies and app code assume one shape.
- **Incremental migration enables the admin tenant list, not the reverse:** the tenant list is only useful for verifying real signups/data landed correctly, so it should exist by the time migration testing starts, but has no other purpose this phase — resist scope growth once it exists.

## MVP Definition

### Launch With (v1 — this phase)

- [ ] Email+password signup, login, logout — the baseline entry point
- [ ] Email verification (with custom SMTP configured, not default limited provider)
- [ ] Password reset flow (request + set-new-password page)
- [ ] Persistent session that survives PWA reopen, including graceful offline handling (don't force logout on failed refresh while offline)
- [ ] `clients` table + `client_id` on every data table + RLS enforcing isolation, tested with 2+ real accounts
- [ ] Minimal read-only admin tenant list (company name, created date) — Bruna-only visibility
- [ ] Florelle's real production data migrated into the new schema as tenant #1, verified with zero loss, incrementally per feature area

### Add After Validation (v1.x — later this same milestone, if time allows)

- [ ] "Which tenant am I" UI indicator (company name in header) — cheap, do it, but not launch-blocking for internal testing with just Bruna's account
- [ ] Basic client-side + server-side input validation polish on auth forms (beyond framework defaults)

### Future Consideration (v2+ — later phases per PROJECT.md's own plan)

- [ ] Per-client Google OAuth (Drive/Calendar/Tasks) — Fase 2, already planned, not this phase
- [ ] Billing/Stripe/subscription — Fase 4, already planned
- [ ] Multi-user-per-tenant + invite flow — only if the "1 user = 1 client" decision changes and a real customer needs it
- [ ] Social login — only if user friction data justifies it later
- [ ] Full admin panel (tenant management actions, analytics) — only once there are enough real tenants to need managing

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Signup/login/logout | HIGH | LOW | P1 |
| Email verification + custom SMTP | HIGH | LOW-MEDIUM | P1 |
| Password reset flow | HIGH | LOW-MEDIUM | P1 |
| Persistent + offline-tolerant session | HIGH | LOW-MEDIUM | P1 |
| `client_id` + RLS isolation | HIGH (this IS the milestone's core value) | MEDIUM-HIGH | P1 |
| Incremental data migration, Florelle as tenant #1 | HIGH (blocks everything else being real) | MEDIUM-HIGH | P1 |
| Minimal admin tenant list | MEDIUM | LOW | P1 (cheap, needed to verify signups work) |
| Tenant indicator in UI | LOW-MEDIUM | LOW | P2 |
| Social login, MFA, SSO, multi-user invites, full admin panel | LOW right now (no customer demand) | MEDIUM-HIGH | P3 / explicitly deferred |

**Priority key:**
- P1: Must have for this milestone to be considered done
- P2: Should have if time allows, doesn't block milestone completion
- P3: Explicitly deferred to later phases per PROJECT.md

## Competitor/Reference Pattern Analysis

Rather than direct competitors (this is an internal vertical tool, not a market with visible SaaS competitors researched here), the useful reference points are Supabase's own documented patterns and generic B2B SaaS auth conventions:

| Pattern | Generic B2B SaaS (Auth0/Clerk/WorkOS-style) | This Project's Right-Sized Approach |
|---------|----------------------------------------------|--------------------------------------|
| Identity provider | Dedicated IdP product (Auth0, Clerk, WorkOS) with org/workspace concept, SSO, SCIM built in | Supabase Auth directly (already decided) — no separate IdP; `clients` table plays the "organization" role manually |
| Org/tenant model | Multi-user orgs with roles/invites from day one | Single-owner tenant (1 user = 1 client, pending confirmation) — invites deferred |
| Email delivery | Managed transactional email built into the platform | Supabase default (dev-only, ~2/hr) → must swap to custom SMTP before real signups |
| Data isolation | Often DB-per-tenant or schema-per-tenant at enterprise scale | Row-level (`client_id` + RLS) — matches PROJECT.md's decision, right-sized for a small number of small tenants |

## Sources

- [Password-based Auth | Supabase Docs](https://supabase.com/docs/guides/auth/passwords)
- [Supabase Auth Explained: Setup, Security & Best Practices](https://www.rocket.new/blog/supabase-auth-explained-setup-security-and-best-practices)
- [Auth | Supabase Docs](https://supabase.com/docs/guides/auth)
- [Email Verification in Supabase | Tutorial | RapidDev](https://www.rapidevelopers.com/supabase-tutorial/how-to-implement-email-verification-in-supabase)
- [Supabase Auth: Email Verification, OAuth, JWT, and PKCE | Easton](https://eastondev.com/blog/en/posts/dev/20260408-supabase-auth-guide/)
- [JavaScript: resetPasswordForEmail | Supabase Docs](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail)
- [Password reset flow · supabase · Discussion #30402](https://github.com/orgs/supabase/discussions/30402)
- [User sessions | Supabase Docs](https://supabase.com/docs/guides/auth/sessions)
- [Authentication persistence in Supabase · supabase · Discussion #11100](https://github.com/orgs/supabase/discussions/11100)
- [SaaS Authentication: Key Considerations & Best Practices (Descope)](https://www.descope.com/blog/post/saas-auth)
- [B2B SaaS Identity Challenges: The Foundation (Auth0)](https://auth0.com/blog/b2b-saas-identity-challenges-the-foundations/)
- [Best Authentication Solutions for Multi-Tenant SaaS and B2B Apps (Descope)](https://www.descope.com/blog/post/auth-multi-tenant-b2b-saas)
- [Data isolation in multi-tenant SaaS (Redis)](https://redis.io/blog/data-isolation-multi-tenant-saas/)
- [From Single-Tenancy to Multi-Tenancy: Refactoring a Backend Service for SaaS (Medium)](https://medium.com/@victorigbokwemchillary/from-single-tenancy-to-multi-tenancy-refactoring-a-backend-service-for-saas-5af482ff5b90)
- C:/florelle/.planning/PROJECT.md (project constraints and explicit out-of-scope items — primary source of truth for what's an anti-feature this phase)

**Confidence caveat:** Findings above are WebSearch digests (LOW individual-source confidence per this run's classify-confidence check — no MCP docs/context7 or premium search provider was available in this environment). Supabase-specific API behavior (exact rate limits, exact event names, exact default storage keys) should be spot-checked against live Supabase docs at implementation time rather than taken as final. The B2B/anti-feature scoping judgment is higher confidence because it's grounded directly in PROJECT.md's explicit constraints, not in web search.

---
*Feature research for: B2B SaaS auth + multi-tenant isolation (Florelle Fase 1)*
*Researched: 2026-08-09*
