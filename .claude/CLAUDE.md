<!-- GSD:project-start source:PROJECT.md -->

## Project

**Florelle SaaS — Fase 1: Auth + Isolamento de Dados**

Florelle é um app de gestão de pedidos para negócios de buquês eternizados (preservação de flores em sílica, quadros/cúpulas) — hoje um PWA single-file 100% client-side (vanilla JS + localStorage + Google Drive/Calendar da conta pessoal da Bruna). Esta fase transforma a base de dados de single-tenant (uma empresa, um dono) para multi-tenant: N empresas, cada uma logada com sua própria conta, dados completamente isolados uns dos outros, mantendo a Bruna (Florelle) funcionando 100% durante e depois da migração.

**Core Value:** Cada empresa cliente faz login e só enxerga os próprios dados — isolamento real e comprovado (não apenas por convenção de UI), sem quebrar a operação da Florelle durante a transição.

### Constraints

- **Tech stack**: Supabase (Postgres + Auth + RLS) obrigatório — não usar Firebase, não propor alternativa
- **Auth**: Email + senha via Supabase Auth apenas — sem OAuth social nesta fase
- **Isolamento**: Por `client_id` + RLS no Postgres — não isolamento por schema separado por empresa
- **Continuidade**: A conta da Bruna (Florelle) precisa continuar funcionando 100% durante e depois da migração — sem downtime perceptível pra ela
- **Segurança/contas**: Claude não deve criar contas em serviços de pagamento nem inserir credenciais — avisar a Bruna quando precisar de conta/API key criada manualmente
- **Escopo de fase**: Só Fase 1 (auth + isolamento) — não adiantar Fase 2 (OAuth por cliente) nem Fase 4 (Stripe)

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- HTML5 - Markup (single-file application)
- CSS3 - Styling (custom design system with CSS variables)
- JavaScript (ES2020+) - Application logic and interactivity
- JSON - Configuration and data interchange
- Markdown - Documentation

## Runtime

- Browser: Modern browsers with ES2020 support, Service Workers, Web APIs
- Server-side: Cloudflare Workers (ES Module runtime)
- Build target: None (no build step; direct deployment)
- None - Dependencies loaded via CDN (see Key Dependencies below)
- Lockfile: Not applicable (CDN-based)

## Frameworks

- None - Vanilla JavaScript (no framework like React, Vue, Angular)
- Browser APIs: Fetch API, Service Workers, localStorage, Web Workers
- Included test files: `florelle_test.js`, `stress-test.js` (not integrated in build)
- No build tool (webpack, vite, esbuild, etc.)
- Direct asset serving via GitHub Pages

## Key Dependencies

- html2canvas 1.4.1 - Screenshots/PNG generation (CDN: cdnjs.cloudflare.com)
- jspdf 2.5.1 - PDF document generation (CDN: cdnjs.cloudflare.com)
- jszip 3.10.1 - ZIP archive creation (CDN: cdnjs.cloudflare.com)
- Google Fonts CDN - Cormorant Garamond, DM Sans, EB Garamond

## Configuration

- No `.env` files
- Configuration via hardcoded constants in `index.html`:
- Server-side secrets (Cloudflare Worker):
- No build configuration files
- Direct HTML/JS/CSS deployment to GitHub Pages

## Platform Requirements

- Text editor (VS Code recommended)
- Git for version control
- Cloudflare account (for Worker deployment)
- Google OAuth credentials (for Drive/Calendar/Tasks APIs)
- Deployment: GitHub Pages (`https://brunadona.github.io/florelle-app/`)
- Cloudflare Worker edge compute (`florelle.brunadonaa.workers.dev`)
- HTTPS required for Service Workers and OAuth

## Application Architecture

- `index.html` - Single-page application (PWA)
- `sw.js` - Service Worker (cache management, offline support)
- `worker.js` - Cloudflare Worker (backend API, integrations)
- Client-side: localStorage (persistent data cache)
- Server-side: Cloudflare KV (synced data, shared across devices)
- Browser memory: Application state in global variables
- Service Worker with cache-busting (cache: no-store policy)
- Lazy-loading of fonts via preconnect
- Minified inline CSS and JavaScript
- CDN-hosted external libraries (html2canvas, jspdf, jszip)

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- Single HTML file: `index.html` (main app, 6200+ lines)
- Worker file: `worker.js` (Cloudflare Worker, camelCase)
- Test scripts: `*_test.js` and `stress-test.js` (console-based tests)
- Service worker: `sw.js` (service worker logic)
- **Public functions:** camelCase (e.g., `openNew()`, `buildCard()`, `renderAll()`)
- **Private functions:** Leading underscore + camelCase (e.g., `_showUndoToast()`, `_calcMargem()`, `_buildProdFilter()`)
- **Utility shorthand:** Single/double letters for common operations:
- **Module-level state:** `let` with descriptive camelCase names:
- **Constants:** UPPERCASE_SNAKE_CASE for true constants, camelCase for object maps:
- **Temporary/timer variables:** Prefixed with `_`:
- Bride record: `{id, crd, upd, nome, etapa, dataCasamento, produto, ...}` (spread across form fields)
- Reminder: `{id, text, data, auto, done}`
- Payment/Installment: `{valor, data, pago}`

## Code Style

- No external formatter configured
- Mixed spacing: some dense ternary chains, some spread across lines
- CSS: Inlined in `<style>` tag with custom properties (CSS variables)
- JavaScript: No semicolons consistently used in some places
- No ESLint or linting tool detected
- Manual code review via stress tests and browser console tests
- CSS variables for theming:
- Class naming:

## Import Organization

- None used; all relative or absolute paths via APIs

## Error Handling

- **Try-catch with user feedback:**
- **Async operations:**
- **API error status codes:**
- **Storage quota errors:**
- **Abort/cancelled operations:**

## Logging

- `console.log()` for info
- `console.error()` for error tracking
- `console.warn()` for warnings
- `console.warn('Falha ao salvar:',e)` for caught errors that don't halt execution
- Test logging: `console.log('%c...',colorStyle)` with colored output
- `alert()` for critical errors requiring user acknowledgment
- `_showToast(message)` or `_showCalToast(message, type)` for non-blocking notifications
- Toast types: 'ok', 'err', 'loading'

## Comments

- Before major function blocks (marked with `/* ── SECTION ── */` ASCII delimiters)
- Complex date calculations
- API authentication flows
- XSS prevention explanations
- Browser compatibility notes (e.g., Firefox mobile canvas workarounds)
- **Used:** Minimal, primarily for test scripts and standalone utilities
- **Pattern:** Only at top of files explaining purpose:
- **Not used:** Per-function JSDoc in main app code

## Function Design

- Small, focused functions (50-150 lines typical)
- Utility functions stay under 10 lines when possible
- Modal handlers may reach 200+ lines (complex form logic)
- Functions take 0-2 parameters typically
- Bride object passed as `b` for consistency
- Form values accessed via globals (`editId`, `mRem`, `mAnexos`) rather than parameters
- Void for render/UI functions (side effects on DOM)
- Boolean for validation checks
- Object/Array for data transformations
- Promise for async operations
- Null for "not found" results

## Module Design

- **Main HTML:** All functions globally available (IIFE scope not used)
- **Worker:** ES Module exports (`export default { async fetch(...) }`)
- **Test scripts:** IIFE wrapping for isolation
- None used; single-file architecture
- Bride array: `DATA` (loaded from localStorage)
- Edit context: `editId`, `mRem`, `mAnexos`
- Sync state: `_syncSt`, `_syncFileId`
- Modal state: visible via class `.hidden` on modal elements
- Google Drive token: `_gToken` (fetched on demand)
- Calendar ID: `_florCalId` (cached in localStorage)

## Date Handling Conventions

## Security Patterns

- Always use `esc()` before inserting user input into innerHTML:
- Test data includes XSS attempts: `'Ana & Maria <Júnior>'`
- Worker adds CORS headers for GitHub Pages origin
- API calls to Google include Authorization header
- PIN input: minimum 4 characters enforced before storage
- Date inputs: HTML5 date type for browser validation
- Numbers: Currency formatted as strings with comma decimal (Brazilian format)

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| **UI/DOM** | Render kanban board, forms, modals, reports | `index.html` (lines 1-734) |
| **State Management** | Maintain DATA array, global state (editId, filters, etc) | `index.html` (lines 1510-1524) |
| **Business Logic** | Order management, filtering, sorting, validation | `index.html` (lines 1598-5100) |
| **Local Storage** | Load/save to localStorage, migrate from old format | `index.html` (lines 1527-1574) |
| **Cloud Sync** | Google Drive sync, Cloudflare Worker sync | `index.html` (lines 5112-5300) |
| **Integrations** | Google Calendar, Drive, Kommo, WhatsApp, signing | `index.html` (lines 2081-4900) |
| **Service Worker** | Cache busting on app updates | `sw.js` (17 lines) |
| **Backend API** | Contract signing, analysis, Kommo webhook | `worker.js` (200+ lines) |
| **Manifest** | PWA metadata and icons | `manifest.json` |

## Pattern Overview

- **Monolithic:** All code in single HTML file (6228 lines)
- **Reactive:** `renderAll()` rebuilds DOM whenever state changes
- **Event-Driven:** Click handlers trigger state updates → re-render
- **Offline-First:** Data synced to localStorage immediately, cloud sync async
- **Multi-Backend:** Supports both Google Drive and Cloudflare Worker for data persistence

## Layers

- Purpose: Render UI and handle user interactions
- Location: `index.html` (lines 17-730, 1485-3250)
- Contains: HTML structure, CSS styles, DOM manipulation functions
- Depends on: State management, business logic
- Used by: Users interact directly via browser
- Purpose: Order management, filtering, validation, calculations
- Location: `index.html` (lines 1598-4900)
- Contains: Functions like `buildCol()`, `buildCard()`, `saveModal()`, `openModal()`, filtering logic
- Depends on: Storage layer for reading/writing data
- Used by: Event handlers, render functions
- Purpose: Persist data locally and sync to cloud
- Location: `index.html` (lines 1527-1574 for localStorage, 5112-5300 for cloud)
- Contains: `load()`, `save()`, `_cloudPush()`, `_cloudPull()`, `_loadFromDrive()`, `_saveToDrive()`
- Depends on: Browser localStorage API, Google Drive API, Cloudflare Worker API
- Used by: Business logic (via `save()` calls), initialization (via `load()`)
- Purpose: Connect with external services (Google, Kommo, Claude, Stripe, etc)
- Location: `index.html` (various sections: Google OAuth ~5000+, Kommo ~4325+, Calendar ~3500+)
- Contains: API wrappers, OAuth flows, webhook handlers
- Depends on: Storage layer for data context
- Used by: Business logic (when user triggers integrations)
- Purpose: Serverless API endpoints for contract signing, analysis, CRM sync
- Location: `worker.js` (200+ lines)
- Contains: Cloudflare Worker routes for `/sign`, `/contract`, `/pending-confirm`, `/analyze-wa`, `/kommo`
- Depends on: Cloudflare KV store, Claude API, Kommo API
- Used by: Frontend via fetch calls to `https://florelle.brunadonaa.workers.dev/...`

## Data Flow

### Primary Request Path (User Creates/Edits Order)

### Kanban Board Rendering

### Contract Generation & Signing

### Cloud Sync (Google Drive)

### Kommo CRM Sync

### WhatsApp Analysis via Claude

- Global `DATA` array: array of bride/order objects
- Global state variables: `editId`, `mRem`, `mAnexos`, `dragId`, `srch`, `prodFiltro`, `mesFiltro`, etc
- No centralized state manager; functions read/write globals directly
- Mutations committed via `save()` which persists and triggers re-render

## Key Abstractions

- Purpose: Represents single bride's order through workflow
- Examples: `DATA[0]` after load
- Pattern: Flat object with fields like `id`, `nome`, `telefone`, `dataCasamento`, `produto`, `etapa`, `formaPagamento`, `pagamentos[]`, etc
- Lifetime: Created at "lead" stage, moves through 10 workflow columns, ends at "entregue" or "cancelado"
- Purpose: Workflow step in kanban board
- Examples: `COLS[0]` = {id:'lead', label:'Lead', color:'#C9A87C'}
- Pattern: Read-only config object defining stage properties
- Used by: Kanban rendering, card filtering, dropdown selects
- Purpose: Time-based notifications and follow-ups
- Examples: "Follow up on silica" (auto-generated), "Call bride" (manual)
- Pattern: Nested array in bride object: `bride.lembretes[]` with `{id, text, data (date), auto, done}`
- Purpose: Track partial/full payments for order
- Pattern: Nested array `bride.pagamentos[]` with `{data (date), valor (amount), pago (boolean), ref}`
- Purpose: Control what cards visible on kanban
- Globals: `prodFiltro`, `mesFiltro`, `srch`, `_pagAtrFiltro`
- Applied in: `buildCol()` when iterating `DATA`

## Entry Points

- Location: `index.html` hosted on GitHub Pages at `brunadona.github.io/florelle-app/`
- Triggers: User visits URL
- Responsibilities: Load manifest, register service worker, initialize app, load data, render board
- Line 6200+ (end of file, executed on page load)
- Calls `syncInit()` to check Google auth
- Calls `load()` to read localStorage
- Calls `_cloudInit()` to sync with backend if online
- Calls `renderAll()` to display board
- Triggered by Google Sign-In button click
- Callback fires `_gClient.callback()` in `syncLogin()` flow
- Stores access token in `_gToken` variable
- Line 6200+ (end of file)
- Registers `sw.js` for cache busting on app updates
- Entry: POST/GET to `https://florelle.brunadonaa.workers.dev/...`
- Routes: `/data`, `/sign`, `/contract`, `/analyze-wa`, `/kommo`, `/pending-confirm`
- No authorization (relies on CORS to HTTPS origin only)

## Architectural Constraints

- **Single-Threaded:** All execution in browser's JavaScript event loop; no workers except service worker
- **Global State:** `DATA` array and 20+ global variables (no module scope isolation)
- **Synchronous Storage:** localStorage writes are blocking; can throw QuotaExceededError
- **No Build Step:** Single HTML file deployed directly; no bundling, transpiling, or tree-shaking
- **Monolithic:** 6228-line single file makes refactoring risky (high blast radius)
- **CORS-Only Auth:** No backend session/JWT; Google OAuth token stored in browser global `_gToken`
- **Cloudflare Worker as Backend:** No traditional server; serverless API requires internet connectivity for some features
- **Offline Limitations:** Kommo sync, WhatsApp analysis, contract signing require internet; local data works offline

## Anti-Patterns

### Massive Single File

- Difficult to navigate and understand (where's the function I need?)
- Changes in one area risk breaking others (high coupling)
- Testing individual features requires running entire app
- Refactoring is high-risk (dependencies unclear)
- Code reuse between projects impossible

### Global Mutable State

- Hard to reason about state changes (mutation happens anywhere)
- Difficult to debug (which function changed this?)
- Impossible to maintain multiple concurrent operations
- Testing requires resetting globals between tests

### String-Based Rendering

- Wasteful re-renders (every card re-created even if unchanged)
- Drag-and-drop state lost after render (need to re-attach handlers)
- Animation/transition CSS doesn't apply (DOM torn down)
- Performance degrades with large datasets

### No Type Checking

- Easy to misspell field names (`b.nome` vs `b.name`) — silent bugs
- IDE can't autocomplete or warn about missing fields
- Onboarding new contributors requires reading entire file
- Refactoring risky (can't search "usages" reliably)

### Monolithic Cloud Sync

- Bidirectional sync not implemented (can't merge Drive + local cleanly)
- If Worker goes down, no fallback (loses signature of offline changes)
- No retry logic (failed sync is silent)
- User unaware if their edit didn't persist

## Error Handling

- Most async operations wrapped in try-catch; error shown as toast or alert
- Sync operations (like `load()`) catch silently, fall back to empty state
- Network errors assumed to be temporary (no retry logic except Kommo polling)
- Example: `_analyzeAndFill()` catches errors silently, leaves fields unchanged if Claude fails

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
