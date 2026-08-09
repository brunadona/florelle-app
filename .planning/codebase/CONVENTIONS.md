# Coding Conventions

**Analysis Date:** 2026-08-09

## Naming Patterns

**Files:**
- Single HTML file: `index.html` (main app, 6200+ lines)
- Worker file: `worker.js` (Cloudflare Worker, camelCase)
- Test scripts: `*_test.js` and `stress-test.js` (console-based tests)
- Service worker: `sw.js` (service worker logic)

**Functions:**
- **Public functions:** camelCase (e.g., `openNew()`, `buildCard()`, `renderAll()`)
- **Private functions:** Leading underscore + camelCase (e.g., `_showUndoToast()`, `_calcMargem()`, `_buildProdFilter()`)
- **Utility shorthand:** Single/double letters for common operations:
  - `g(id)` - `document.getElementById()`
  - `gv(id)` - get element value
  - `sv2(id, v)` - set element value
  - `radVal(name)` - get checked radio button value
  - `setRad(name, val)` - set radio button by value
  - `icn()` - generate SVG icon HTML
  - `esc()` - HTML escape (XSS prevention)
  - `fmt()` - format date (ISO to DD/MM/YYYY)

**Variables:**
- **Module-level state:** `let` with descriptive camelCase names:
  - `editId` - currently editing bride ID
  - `dragId` - drag-and-drop source ID
  - `srch` - search query string
  - `prodFiltro` - product filter value
  - `mesFiltro` - wedding month filter (YYYY-MM)
  - `mRem` - modal reminders array
  - `mAnexos` - modal attachments array
  - `_syncSt` - sync status ('idle'|'syncing'|'ok'|'error'|'offline')

- **Constants:** UPPERCASE_SNAKE_CASE for true constants, camelCase for object maps:
  - `const COLS=[...]` - column/stage names
  - `const PLABEL={...}` - product labels map
  - `const PAGLABEL={...}` - payment type labels
  - `const EMBLABEL={...}` - packaging status labels
  - `const WPP_STAGE_LBL={...}` - WhatsApp stage labels

- **Temporary/timer variables:** Prefixed with `_`:
  - `_srchTimer` - search debounce timer
  - `_invSrchTimer` - inventory search timer
  - `_undoTimer` - undo toast timeout
  - `_syncTimer` - sync interval timer

**Types/Objects:**
- Bride record: `{id, crd, upd, nome, etapa, dataCasamento, produto, ...}` (spread across form fields)
- Reminder: `{id, text, data, auto, done}`
- Payment/Installment: `{valor, data, pago}`

## Code Style

**Formatting:**
- No external formatter configured
- Mixed spacing: some dense ternary chains, some spread across lines
- CSS: Inlined in `<style>` tag with custom properties (CSS variables)
- JavaScript: No semicolons consistently used in some places

**Linting:**
- No ESLint or linting tool detected
- Manual code review via stress tests and browser console tests

**CSS Architecture:**
- CSS variables for theming:
  - `--cbg` (canvas background)
  - `--ccol` (card color)
  - `--ccard` (card background)
  - `--sl`, `--sm`, `--sd`, `--smd`, `--sdp` (sage color palette)
  - `--tp`, `--tpd` (tan palette)
  - `--tx`, `--txm`, `--txl` (text shades)
  - `--wh` (white)
  - `--bd`, `--bdl` (border)
  - `--sh0` through `--sh3` (shadow levels)

- Class naming:
  - `[prefix]-[component]` (e.g., `.kcol`, `.bcard`, `.kch`)
  - Utility-like: `.hidden`, `.muted`, `.dov` (drag-over), `.act` (active)
  - State modifiers: `.drag`, `.overdue`, `.silica-late`, `.al` (alert)

## Import Organization

**Order (where used):**
1. Module imports at top (Google Calendar, Drive APIs)
2. Constants and static data
3. State variables
4. Utility functions
5. Render functions
6. Event handlers
7. Modal/UI logic

**Path Aliases:**
- None used; all relative or absolute paths via APIs

## Error Handling

**Patterns:**
- **Try-catch with user feedback:**
  ```javascript
  try {
    await _ensureToken();
  } catch (e) {
    _showCalToast('Conecte ao Google Drive primeiro', 'err');
    return;
  }
  ```

- **Async operations:**
  ```javascript
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error('Erro ao salvar: ' + r.status);
    const d = await r.json();
  } catch (e) {
    console.error(e);
    _showToast('error message');
  }
  ```

- **API error status codes:**
  - 401 → Session expired, reconnect required
  - 404 → Resource not found
  - 400 → Invalid input
  - 500+ → Server error

- **Storage quota errors:**
  ```javascript
  catch (e) {
    if (e.name === 'QuotaExceededError') {
      alert('Armazenamento local cheio. Remova alguns anexos para continuar salvando.');
    }
  }
  ```

- **Abort/cancelled operations:**
  ```javascript
  catch (e) {
    if (e.name === 'AbortError') return; // User cancelled, silent fail
  }
  ```

## Logging

**Framework:** Browser `console` only (no logger library)

**Patterns:**
- `console.log()` for info
- `console.error()` for error tracking
- `console.warn()` for warnings
- `console.warn('Falha ao salvar:',e)` for caught errors that don't halt execution
- Test logging: `console.log('%c...',colorStyle)` with colored output

**User-facing messages:**
- `alert()` for critical errors requiring user acknowledgment
- `_showToast(message)` or `_showCalToast(message, type)` for non-blocking notifications
- Toast types: 'ok', 'err', 'loading'

## Comments

**When to Comment:**
- Before major function blocks (marked with `/* ── SECTION ── */` ASCII delimiters)
- Complex date calculations
- API authentication flows
- XSS prevention explanations
- Browser compatibility notes (e.g., Firefox mobile canvas workarounds)

**JSDoc/TSDoc:**
- **Used:** Minimal, primarily for test scripts and standalone utilities
- **Pattern:** Only at top of files explaining purpose:
  ```javascript
  /**
   * Florelle — Script de Teste Automático
   * Cole no console do Chrome com florelle.html aberto.
   * Roda ~120 assertions cobrindo todos os cenários.
   */
  ```

- **Not used:** Per-function JSDoc in main app code

## Function Design

**Size:**
- Small, focused functions (50-150 lines typical)
- Utility functions stay under 10 lines when possible
- Modal handlers may reach 200+ lines (complex form logic)

**Parameters:**
- Functions take 0-2 parameters typically
- Bride object passed as `b` for consistency
- Form values accessed via globals (`editId`, `mRem`, `mAnexos`) rather than parameters

**Return Values:**
- Void for render/UI functions (side effects on DOM)
- Boolean for validation checks
- Object/Array for data transformations
- Promise for async operations
- Null for "not found" results

**Form handling pattern:**
```javascript
function fillForm(b) {
  sv2('m-nome', b.nome || '');
  sv2('m-cas', b.dataCasamento || '');
  // ... set all form fields
  renderRL(); // Render dependent components
}
```

**Render pattern:**
```javascript
function buildCard(b, acc) {
  let html = '<div class="bcard">';
  // ... build card HTML with data
  return html; // Caller appends to DOM
}
```

## Module Design

**Exports:**
- **Main HTML:** All functions globally available (IIFE scope not used)
- **Worker:** ES Module exports (`export default { async fetch(...) }`)
- **Test scripts:** IIFE wrapping for isolation

**Barrel Files:**
- None used; single-file architecture

**Global State:**
- Bride array: `DATA` (loaded from localStorage)
- Edit context: `editId`, `mRem`, `mAnexos`
- Sync state: `_syncSt`, `_syncFileId`
- Modal state: visible via class `.hidden` on modal elements

**Lazy-loaded state:**
- Google Drive token: `_gToken` (fetched on demand)
- Calendar ID: `_florCalId` (cached in localStorage)

## Date Handling Conventions

**ISO format stored:** `YYYY-MM-DD` (always, in localStorage)
**Display format:** `DD/MM/YYYY` (user-facing via `fmt()`)
**Calculations:** Use `addDays()`, `daysTo()` utility functions
**Today's date:** Call `today()` instead of creating new Date

```javascript
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
```

## Security Patterns

**XSS Prevention:**
- Always use `esc()` before inserting user input into innerHTML:
  ```javascript
  html += '<div class="cname">' + esc(b.nome) + '</div>';
  ```

- Test data includes XSS attempts: `'Ana & Maria <Júnior>'`

**CORS Handling:**
- Worker adds CORS headers for GitHub Pages origin
- API calls to Google include Authorization header

**Form Validation:**
- PIN input: minimum 4 characters enforced before storage
- Date inputs: HTML5 date type for browser validation
- Numbers: Currency formatted as strings with comma decimal (Brazilian format)

---

*Convention analysis: 2026-08-09*
