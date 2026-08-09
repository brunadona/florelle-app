# Testing Patterns

**Analysis Date:** 2026-08-09

## Test Framework

**Runner:**
- Browser console (no external test runner)
- Chrome Developer Tools Console
- Tests access live app context via global functions and `DATA` array

**Assertion Library:**
- Custom helper functions in each test file
- No external library used

**Run Commands:**
```bash
# Test 1: Comprehensive unit + integration test
# Open index.html, then paste florelle_test.js into Chrome console

# Test 2: Stress test with performance metrics
# Open index.html, then paste stress-test.js into Chrome console

# Test 3: Seed test data
# Open index.html, then paste seed.js into Chrome console
```

## Test File Organization

**Location:**
- `florelle_test.js` - Comprehensive test suite (~500 lines, 120+ assertions)
- `stress-test.js` - Performance & load testing (~300 lines)
- `seed.js` - Data fixture generator (~190 lines)

**Naming:**
- `*_test.js` for unit/integration tests
- `stress-test.js` for performance tests
- `seed.js` for test data fixtures (not a test itself)

**Structure:**
```
(async function TEST_NAME() {
  'use strict';
  
  // Setup: helpers, backup
  const backup = JSON.parse(JSON.stringify(DATA));
  
  // Test blocks with console.groupCollapsed()
  log('\n[1] Feature Name');
  check('assertion name', condition, optionalDetail);
  
  // Teardown: restore backup
})();
```

## Test Structure

**Suite Organization:**
```javascript
/**
 * Florelle — Teste Automático Completo
 * Cole no console do Chrome com florelle.html aberto.
 * Roda ~120 assertions cobrindo todos os cenários.
 */
(async function FLORELLE_TEST() {
  'use strict';

  /* ── helpers ── */
  const ok = (n) => { console.log('  ✅', n); _p++; };
  const fail = (n, d = '') => { console.error('  ❌', n, d); _f++; };
  const check = (name, cond, detail = '') => cond ? ok(name) : fail(name, detail);

  /* ── acessa contexto da app ── */
  if (typeof DATA === 'undefined' || typeof save === 'undefined') {
    console.error('❌ ABORTADO: Abra florelle.html primeiro');
    return;
  }

  /* backup do estado original */
  const BACKUP = JSON.stringify(DATA);

  log('════════════════════════════════════');
  log('  FLORELLE — TESTE AUTOMÁTICO');
  log('════════════════════════════════════');

  /* ── BLOCO 1: Teste X ── */
  log('\n[1] Funções utilitárias');
  check('uid() gera string única', uid() !== uid());
  check('today() formato ISO', /^\d{4}-\d{2}-\d{2}$/.test(today()));
  
  // Restore
  DATA = JSON.parse(BACKUP);
})();
```

**Patterns:**
- **Setup:** Backup `DATA` array before mutations
- **Isolation:** Each test block operates on copy, not original
- **Teardown:** Restore from backup (implicit via re-initialization)
- **Async support:** Function marked `async`, uses `await` for operations
- **Assertion style:** `check(name, condition, detail)` format

## Test Structure Details

**Helper Functions:**
```javascript
const log = (m, ...a) => console.log('%c' + m, 'color:#5C7050;font-weight:600', ...a);
const ok = (n) => { console.log('  ✅', n); _p++; };
const fail = (n, d = '') => { console.error('  ❌', n, d); _f++; };
const warn = (n, d = '') => { console.warn('  ⚠️', n, d); _w++; };

function check(name, cond, detail = '') {
  cond ? ok(name) : fail(name, detail);
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}
```

**Counter tracking:**
```javascript
let _p = 0; // passed
let _f = 0; // failed
let _w = 0; // warnings

// At end:
console.log(`✅ ${_p} | ❌ ${_f} | ⚠️ ${_w}`);
```

**Grouped assertions:**
```javascript
console.groupCollapsed('1. Gerar 50 noivas');
// ... 20+ assertions
console.groupEnd();
```

## Mocking

**Framework:** None used; tests use actual app functions

**Patterns:**
- **Direct manipulation:** `DATA.push()` to add test records
- **Direct function calls:** Call app functions with test data
- **State capture:** Save/restore via `JSON.stringify()`
- **No API mocking:** Google Drive/Calendar calls wrapped in try-catch, failures expected

**What to Mock (not done in this codebase):**
- External APIs (Google Drive, Google Calendar) - instead, test error handling

**What NOT to Mock (as practiced):**
- localStorage (use actual localStorage)
- Date functions (use `today()`, `addDays()`)
- Render functions (verify DOM changes via selectors)
- Utility functions (test directly)

## Fixtures and Factories

**Test Data:**
```javascript
const testCards = [
  { nome: 'Ana Lima', etapa: 'lead', dataCasamento: '2026-08-15', ... },
  { nome: 'Beto Silva', etapa: 'retomar', dataCasamento: '2026-09-20', ... },
  // ... 20 test cards
];

testCards.forEach(tc => {
  DATA.push({
    id: uid(),
    crd: Date.now(),
    lembretes: [],
    upd: Date.now(),
    ...tc
  });
});
```

**Factory functions (in seed.js):**
```javascript
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function silRems(dataSilica) {
  if (!dataSilica) return [];
  return [
    { id: uid(), text: 'Retirada da sílica', data: addD(dataSilica, 30), auto: true, done: false },
    { id: uid(), text: 'Início da montagem', data: addD(dataSilica, 45), auto: true, done: false },
  ];
}
```

**Location:**
- Test fixtures inline in test scripts (`florelle_test.js`)
- Seeded data in `seed.js` (9 sample brides with realistic data)
- Stress test data generated in loops within `stress-test.js`

## Coverage

**Requirements:** None enforced

**Manual coverage tracking:**
Test suite documents each feature tested:
- [1] Utility functions (uid, today, fmt, addDays, daysTo, esc)
- [2] Google Calendar URL generation
- [3] buildCalEvents (7+ scenarios)
- [4] Data create/read/update/delete
- [5] Persistence (load/save)
- [6] Column movement (all 10 stages)
- [7] Field editing
- [8] Reminders
- [9] Card deletion
- [10] Storage quota handling
- [11] Drag-and-drop
- [12] Search functionality
- [13] Inventory management
- [14] Drive sync
- [15] Contract signing
- [16] Calendar events
- [17] Performance benchmarks
- [18] XSS prevention

**Coverage verification:**
```javascript
if (_f > 0) console.warn(`⚠️  ${_f} tests failed`);
if (_p < 100) console.warn(`⚠️  Only ${_p} assertions passed, expect 120+`);
```

## Test Types

**Unit Tests:**
- Scope: Individual utility functions
- Approach: Call function, verify return value
- Examples: `uid()`, `fmt()`, `addDays()`, `daysTo()`

**Integration Tests:**
- Scope: Function interactions, data flow
- Approach: Mutate DATA, call functions, verify state changes
- Examples: Creating bride record, moving card between stages, editing fields

**E2E Tests:**
- Scope: Full user workflows
- Approach: Simulate user actions (open modal, fill form, save)
- Framework: Not used; manual browser testing recommended

## Common Patterns

**Async Testing:**
```javascript
async function FLORELLE_TEST() {
  'use strict';
  
  // Sequential async operations
  await delay(100);
  const resp = await fetch(url);
  const json = await resp.json();
  
  check('api response valid', json.ok === true);
}
```

**Error Testing:**
```javascript
// Test invalid input
check('fmt("") retorna vazio', fmt('') === '');
check('daysTo(null) retorna null', daysTo(null) === null);
check('addDays("",5) retorna vazio', addDays('', 5) === '');

// Test XSS prevention
check('load() preserva nome com &<>', DATA[19].nome === 'Ana & Maria <Júnior>');
check('esc() escapa &', esc('a&b') === 'a&amp;b');
check('esc() escapa <', esc('<script>') === '&lt;script&gt;');
```

**State persistence:**
```javascript
// Modify state
DATA[idx] = { ...DATA[idx], nome: 'Novo Nome' };
save();

// Clear and reload
DATA.length = 0;
load();

// Verify
check('edição persiste após save/load', DATA[idx].nome === 'Novo Nome');
```

**Performance timing:**
```javascript
function timed(label, fn) {
  const s = performance.now();
  fn();
  const ms = (performance.now() - s).toFixed(1);
  console.log(`  ⏱  ${label}: ${ms}ms`);
}

timed('renderAll() com 50 noivas', () => renderAll());
timed('buildCard() × 100', () => {
  for (let i = 0; i < 100; i++) {
    buildCard(DATA[i % DATA.length], '');
  }
});
```

**Batch assertions:**
```javascript
const colCounts = {};
DATA.forEach(c => {
  colCounts[c.etapa] = (colCounts[c.etapa] || 0) + 1;
});

['lead', 'retomar', 'contratoEnviado', 'contratoAssinado', 'reserva', 
 'secagem', 'montagem', 'embalado', 'entregue', 'cancelado'].forEach(col => {
  check(`Coluna "${col}" tem cards`, colCounts[col] > 0, 'count: ' + (colCounts[col] || 0));
});
```

## Large Dataset Testing

**Stress test approach:**
```javascript
// Generate 50 test brides
for (let i = 0; i < 50; i++) {
  const etapa = ETAPAS[i % ETAPAS.length];
  const rec = {
    id: uid(),
    nome: NOMES[i],
    etapa,
    dataCasamento: rndDate('2025-06-01', '2027-06-01'),
    produto: rnd(PRODUTOS),
    // ... other fields
  };
  DATA.push(rec);
}

timed('renderAll() com 50 noivas', () => renderAll());
assert('50 noivas em DATA', DATA.length === 50, `got ${DATA.length}`);
```

**Performance baselines:**
- `renderAll()` with 50 cards: < 100ms
- `buildCard()` × 100: < 50ms
- `save()` with 50 cards: < 50ms
- `load()` with 50 cards: < 100ms

## Testing XSS & Security

**Approach:**
- Test card includes name with special chars: `'Ana & Maria <Júnior>'`
- Verify escaping via `load()` and `esc()` functions
- Verify no injection in form fields or displayed text

**Test cases:**
```javascript
check('load() preserva nome com &<>', DATA[19].nome === 'Ana & Maria <Júnior>');
check('load() preserva anotações especiais', DATA[19].anotacoes === 'Teste XSS & segurança <ok>');
check('esc() escapa &', esc('a&b') === 'a&amp;b');
check('esc() escapa <', esc('<script>') === '&lt;script&gt;');
```

## Debugging in Tests

**Console inspection:**
```javascript
// Log intermediate state
console.log('Bride record:', DATA[0]);
console.table(DATA.map(b => ({ Nome: b.nome, Etapa: b.etapa })));

// Check localStorage
console.log('localStorage size:', localStorage.getItem('florelle_v3')?.length);

// Inspect DOM after render
console.log('Cards in DOM:', document.querySelectorAll('.bcard').length);
```

**Abort on error:**
```javascript
if (typeof DATA === 'undefined' || typeof save === 'undefined') {
  console.error('❌ ABORTADO: Abra florelle.html no Chrome antes de colar este script.');
  return; // Exit early, don't run tests
}
```

**Restore to clean state:**
```javascript
// Always backup first
const BACKUP = JSON.stringify(DATA);
const BACKUP_LS = localStorage.getItem('florelle_v3');

// ... run tests ...

// Manual restore if needed
DATA = JSON.parse(BACKUP);
localStorage.setItem('florelle_v3', BACKUP_LS);
```

## Test Execution Flow

1. Open `index.html` in Chrome
2. Open DevTools (F12) → Console tab
3. Copy entire test script (e.g., `florelle_test.js`)
4. Paste into console
5. Press Enter
6. Watch colored output (✅ green pass, ❌ red fail, ⚠️  yellow warn)
7. Summary appears at end: `✅ 120 | ❌ 0 | ⚠️  0`

**Expected output:**
```
════════════════════════════════════
  FLORELLE — TESTE AUTOMÁTICO COMPLETO
════════════════════════════════════

[1] Funções utilitárias
  ✅ uid() gera string única
  ✅ uid() formato ok
  ✅ today() formato ISO
  ...
  
[2] Google Calendar — geração de URLs
  ...

✅ 120 | ❌ 0 | ⚠️  0
Testes completos — tudo OK! 🎉
```

---

*Testing analysis: 2026-08-09*
