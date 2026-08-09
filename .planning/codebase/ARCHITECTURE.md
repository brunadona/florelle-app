<!-- refreshed: 2026-08-09 -->
# Architecture

**Analysis Date:** 2026-08-09

## System Overview

Florelle is a single-file PWA (Progressive Web App) for managing bridal bouquet preservation orders. It operates as a kanban board application with cloud synchronization, contract signing, and multi-service integrations.

```text
┌──────────────────────────────────────────────────────────────────┐
│                        UI Layer (HTML/CSS)                        │
│  Kanban Board | Forms | Modals | Reports | Calendar | Tasks      │
│               (index.html: 6228 lines)                            │
├─────────────────┬──────────────────────┬────────────────────────┤
│   Business      │   Storage & Sync      │   Integration Layer    │
│   Logic         │   Layer               │                        │
│  (JS Functions) │  (localStorage,       │  (Google, Cloudflare,  │
│                 │   Google Drive,       │   Kommo, Claude, etc)  │
│                 │   Cloudflare Worker)  │                        │
└─────────────────┴──────────────────────┴────────────────────────┘
         │                      │                      │
         ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                External Services                                 │
│  - Google Drive (OAuth2, file storage, calendar, tasks)          │
│  - Cloudflare Worker (API endpoints, contract signing)           │
│  - Kommo CRM (lead sync)                                         │
│  - Claude API (WhatsApp analysis, via Worker)                    │
│  - Stripe (payment processing)                                   │
│  - Google Fonts (typography)                                     │
└─────────────────────────────────────────────────────────────────┘
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

**Overall:** Single-Page Application (SPA) with declarative re-rendering

**Key Characteristics:**
- **Monolithic:** All code in single HTML file (6228 lines)
- **Reactive:** `renderAll()` rebuilds DOM whenever state changes
- **Event-Driven:** Click handlers trigger state updates → re-render
- **Offline-First:** Data synced to localStorage immediately, cloud sync async
- **Multi-Backend:** Supports both Google Drive and Cloudflare Worker for data persistence

## Layers

**Presentation Layer:**
- Purpose: Render UI and handle user interactions
- Location: `index.html` (lines 17-730, 1485-3250)
- Contains: HTML structure, CSS styles, DOM manipulation functions
- Depends on: State management, business logic
- Used by: Users interact directly via browser

**Business Logic Layer:**
- Purpose: Order management, filtering, validation, calculations
- Location: `index.html` (lines 1598-4900)
- Contains: Functions like `buildCol()`, `buildCard()`, `saveModal()`, `openModal()`, filtering logic
- Depends on: Storage layer for reading/writing data
- Used by: Event handlers, render functions

**Storage Layer:**
- Purpose: Persist data locally and sync to cloud
- Location: `index.html` (lines 1527-1574 for localStorage, 5112-5300 for cloud)
- Contains: `load()`, `save()`, `_cloudPush()`, `_cloudPull()`, `_loadFromDrive()`, `_saveToDrive()`
- Depends on: Browser localStorage API, Google Drive API, Cloudflare Worker API
- Used by: Business logic (via `save()` calls), initialization (via `load()`)

**Integration Layer:**
- Purpose: Connect with external services (Google, Kommo, Claude, Stripe, etc)
- Location: `index.html` (various sections: Google OAuth ~5000+, Kommo ~4325+, Calendar ~3500+)
- Contains: API wrappers, OAuth flows, webhook handlers
- Depends on: Storage layer for data context
- Used by: Business logic (when user triggers integrations)

**Backend/Worker Layer:**
- Purpose: Serverless API endpoints for contract signing, analysis, CRM sync
- Location: `worker.js` (200+ lines)
- Contains: Cloudflare Worker routes for `/sign`, `/contract`, `/pending-confirm`, `/analyze-wa`, `/kommo`
- Depends on: Cloudflare KV store, Claude API, Kommo API
- Used by: Frontend via fetch calls to `https://florelle.brunadonaa.workers.dev/...`

## Data Flow

### Primary Request Path (User Creates/Edits Order)

1. User opens modal via `openNew()` or `openModal()` (`index.html:1987/1996`)
2. Form fields pre-populated with `fillForm()` if editing (`index.html:2013`)
3. User fills form and clicks "Salvar"
4. `saveModal()` validates and updates `DATA` array (`index.html:2222`)
5. `save()` writes to localStorage and queues cloud sync (`index.html:1570-1574`)
6. `renderAll()` rebuilds UI with new/updated card (`index.html:1598`)
7. Async: `_cloudPush()` syncs to Cloudflare Worker or `_saveToDrive()` syncs to Google Drive

### Kanban Board Rendering

1. `renderAll()` called on state change (`index.html:1598`)
2. Filters applied: product, wedding month, payment status, search (`index.html:1615-1657`)
3. `buildCol()` creates column DOM for each stage (`index.html:1650`)
4. `buildCard()` creates card DOM for each bride/order (`index.html:1715`)
5. Drag-and-drop handlers attach to enable column transitions (`index.html:1674-1707`)
6. DOM replaced in #kb element

### Contract Generation & Signing

1. User clicks "Gerar Contrato" in order modal
2. `_buildContratoHTML()` generates contract HTML from bride data (`index.html:2444`)
3. Contract stored in `DATA[id].contrato` field
4. User clicks "Enviar para Assinatura"
5. `enviarAssinar()` posts contract to Worker `/sign` endpoint, gets token (`index.html:2492`)
6. Sharing link sent via WhatsApp with token
7. Bride clicks link, signs via canvas
8. `_sigConfirm()` posts signed contract to Worker `/contract/:brideId` (`index.html:2755`)
9. App polls for confirmation, updates order status

### Cloud Sync (Google Drive)

1. `syncInit()` checks Google OAuth status, requests token if needed (`index.html:5165`)
2. User clicks sync button → `syncLogin()`
3. `_findSyncFile()` locates or creates `florelle-data.json` in Drive (`index.html:5209`)
4. `_loadFromDrive()` reads cloud data, updates local if cloud is newer (`index.html:5232`)
5. Changes to local data trigger `_queueCloudSync()` → debounced `_saveToDrive()` after 2s (`index.html:5112-5115`)
6. Conflict resolution: "Drive always wins" (cloud overwrites local)

### Kommo CRM Sync

1. User enters Kommo subdomain + API key in Settings
2. User clicks "Sincronizar agora"
3. `syncKommo()` calls Worker with subdomain and token (`index.html:4325`)
4. Worker fetches leads from Kommo API (`worker.js:130+`)
5. Worker analyzes lead notes with Claude API for structured data (`worker.js:135+`)
6. Frontend receives leads, merges into `DATA` array
7. New leads marked as "lead" stage, existing placeholder leads updated
8. Phone number matching prevents duplicates

### WhatsApp Analysis via Claude

1. User uploads WhatsApp image/screenshot or pastes text in modal
2. Image sent to Worker `/analyze-wa` endpoint
3. Worker calls Claude API with prompt to extract bride/order data
4. Claude returns structured JSON (name, phone, wedding date, product, payment, etc)
5. Fields auto-populated in form
6. Reduces data entry burden for manual WhatsApp orders

**State Management:**
- Global `DATA` array: array of bride/order objects
- Global state variables: `editId`, `mRem`, `mAnexos`, `dragId`, `srch`, `prodFiltro`, `mesFiltro`, etc
- No centralized state manager; functions read/write globals directly
- Mutations committed via `save()` which persists and triggers re-render

## Key Abstractions

**Bride/Order Object:**
- Purpose: Represents single bride's order through workflow
- Examples: `DATA[0]` after load
- Pattern: Flat object with fields like `id`, `nome`, `telefone`, `dataCasamento`, `produto`, `etapa`, `formaPagamento`, `pagamentos[]`, etc
- Lifetime: Created at "lead" stage, moves through 10 workflow columns, ends at "entregue" or "cancelado"

**Column (Stage):**
- Purpose: Workflow step in kanban board
- Examples: `COLS[0]` = {id:'lead', label:'Lead', color:'#C9A87C'}
- Pattern: Read-only config object defining stage properties
- Used by: Kanban rendering, card filtering, dropdown selects

**Reminder (Lembretes):**
- Purpose: Time-based notifications and follow-ups
- Examples: "Follow up on silica" (auto-generated), "Call bride" (manual)
- Pattern: Nested array in bride object: `bride.lembretes[]` with `{id, text, data (date), auto, done}`

**Pagamentos (Payments):**
- Purpose: Track partial/full payments for order
- Pattern: Nested array `bride.pagamentos[]` with `{data (date), valor (amount), pago (boolean), ref}`

**Filter State:**
- Purpose: Control what cards visible on kanban
- Globals: `prodFiltro`, `mesFiltro`, `srch`, `_pagAtrFiltro`
- Applied in: `buildCol()` when iterating `DATA`

## Entry Points

**Browser Navigation:**
- Location: `index.html` hosted on GitHub Pages at `brunadona.github.io/florelle-app/`
- Triggers: User visits URL
- Responsibilities: Load manifest, register service worker, initialize app, load data, render board

**Initialization Sequence:**
- Line 6200+ (end of file, executed on page load)
- Calls `syncInit()` to check Google auth
- Calls `load()` to read localStorage
- Calls `_cloudInit()` to sync with backend if online
- Calls `renderAll()` to display board

**Google OAuth Callback:**
- Triggered by Google Sign-In button click
- Callback fires `_gClient.callback()` in `syncLogin()` flow
- Stores access token in `_gToken` variable

**Service Worker Registration:**
- Line 6200+ (end of file)
- Registers `sw.js` for cache busting on app updates

**Cloudflare Worker API:**
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

**What happens:** All code (HTML, CSS, JS) in `index.html` (6228 lines). Functions are scattered without logical grouping. Style definitions are inline in `<style>` tag. No module boundaries.

**Why it's wrong:** 
- Difficult to navigate and understand (where's the function I need?)
- Changes in one area risk breaking others (high coupling)
- Testing individual features requires running entire app
- Refactoring is high-risk (dependencies unclear)
- Code reuse between projects impossible

**Do this instead:** Split into modules (`components.js`, `storage.js`, `integrations.js`, etc) and build with tooling (Vite, Webpack). Use ES modules for clear dependencies. This is the biggest refactoring opportunity for this codebase.

### Global Mutable State

**What happens:** 20+ global variables modified throughout the file (`DATA`, `editId`, `mRem`, `dragId`, `srch`, `prodFiltro`, etc). Functions assume these exist and modify them directly.

**Why it's wrong:**
- Hard to reason about state changes (mutation happens anywhere)
- Difficult to debug (which function changed this?)
- Impossible to maintain multiple concurrent operations
- Testing requires resetting globals between tests

**Do this instead:** Encapsulate state in objects or classes. Use accessor functions. Consider Redux-like pattern for predictable mutations: `action → reducer → new state`.

### String-Based Rendering

**What happens:** DOM rebuilt completely on every state change via `renderAll()` → `buildCol()` → `buildCard()`. Each function generates HTML strings concatenated together. No virtual diff.

**Why it's wrong:**
- Wasteful re-renders (every card re-created even if unchanged)
- Drag-and-drop state lost after render (need to re-attach handlers)
- Animation/transition CSS doesn't apply (DOM torn down)
- Performance degrades with large datasets

**Do this instead:** Use framework (React, Vue, Svelte) that diffs vDOM. Or use targeted DOM updates: `document.querySelector('#card-' + id).textContent = newName`. Libraries like Preact (small) could help.

### No Type Checking

**What happens:** Plain JavaScript with no TypeScript or JSDoc type annotations. Bride objects assumed to have certain fields but not enforced. Function parameters undocumented.

**Why it's wrong:**
- Easy to misspell field names (`b.nome` vs `b.name`) — silent bugs
- IDE can't autocomplete or warn about missing fields
- Onboarding new contributors requires reading entire file
- Refactoring risky (can't search "usages" reliably)

**Do this instead:** Migrate to TypeScript or add JSDoc annotations. Define `interface Bride { id: string; nome: string; ... }` once, enforce everywhere. Type-aware IDE catches bugs immediately.

### Monolithic Cloud Sync

**What happens:** Data synced to multiple backends (Google Drive, Cloudflare Worker) with manual coordination. No conflict resolution strategy except "cloud wins" (can lose local edits). No offline queue (offline changes lost if sync fails).

**Why it's wrong:**
- Bidirectional sync not implemented (can't merge Drive + local cleanly)
- If Worker goes down, no fallback (loses signature of offline changes)
- No retry logic (failed sync is silent)
- User unaware if their edit didn't persist

**Do this instead:** Pick one backend (Google Drive or Worker). Implement CRDTs (Conflict-free Replicated Data Types) for true multi-device sync. Add offline queue with clear "pending" indicator.

## Error Handling

**Strategy:** Try-catch with silent failure (most errors logged to console only)

**Patterns:**
- Most async operations wrapped in try-catch; error shown as toast or alert
- Sync operations (like `load()`) catch silently, fall back to empty state
- Network errors assumed to be temporary (no retry logic except Kommo polling)
- Example: `_analyzeAndFill()` catches errors silently, leaves fields unchanged if Claude fails

**Missing:** No centralized error handler, no error logging to server, no user-facing error state tracking

## Cross-Cutting Concerns

**Logging:** Console.log only (development). No structured logging or remote error tracking. Example: `console.log('[Kommo] leads recebidos:',leads.length)` at line 4353

**Validation:** Ad-hoc in `saveModal()`. Examples: `if(!b.nome)...`, phone format validation (`/\D/g`), date format checks. No reusable validators.

**Authentication:** Google OAuth 2.0 via `_gClient` and Bearer token in Authorization header. Kommo API key stored in localStorage (security risk). No session management.

**Authorization:** None implemented. Assumes single user per browser (localStorage is per-user but not enforced). Sharing data would expose all orders.

**Internationalization:** Portuguese (pt-BR) hardcoded throughout. No i18n framework. Date formats, labels, error messages all in Portuguese.

**Accessibility:** Basic semantic HTML. Some ARIA attributes missing. Color contrast may fail WCAG guidelines. Focus management during modal/dialog not implemented.

---

*Architecture analysis: 2026-08-09*
