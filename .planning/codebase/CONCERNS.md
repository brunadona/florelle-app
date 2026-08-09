# Codebase Concerns

**Analysis Date:** 2026-08-09

## Tech Debt

**Monolithic Single-File Architecture:**
- Issue: `index.html` contains 6228 lines of HTML, CSS, and JavaScript mixed together
- Files: `C:/florelle/index.html`
- Impact: Difficult to maintain, test, and refactor. Hard to reuse logic across components. No code splitting or modularity. Performance suffers on initial load.
- Fix approach: Break into separate modules (app.js, ui.js, sync.js, etc.). Consider build tooling (webpack/vite) to bundle and minify. Extract CSS into separate file.

**Unhandled JSON Parse Failures:**
- Issue: `JSON.parse()` called without try-catch in critical paths, particularly in storage/sync operations
- Files: `C:/florelle/index.html` lines 1529, 1566, 2621, 3781, 3831; `C:/florelle/worker.js` line 111
- Impact: Corrupt localStorage data crashes parsing and prevents app from loading. Silent failure in sync operations (line 3831) means data loss goes undetected.
- Fix approach: Wrap all `JSON.parse()` calls in try-catch. Return sensible defaults (empty array/object) on parse failure. Log parse errors for debugging.

**Silent Error Handling in Critical Paths:**
- Issue: Empty catch blocks throughout codebase that swallow errors (e.g., sync, Google Drive operations, Kommo webhook)
- Files: `C:/florelle/index.html` lines 5132, 5146, 5288; `C:/florelle/worker.js` lines 267, 314
- Impact: Sync failures go undetected. Users don't know if data saved. No visibility into API failures.
- Fix approach: Log all caught errors. Distinguish between expected/benign errors and real failures. Update UI state (show "sync error" badge) when failures occur.

**localStorage Storage Without Size Management:**
- Issue: No proactive size monitoring. Only reactive quota check in save() with alert
- Files: `C:/florelle/index.html` lines 1571-1572
- Impact: App can hang/crash when storage full. Users get cryptic alert in Portuguese. No graceful degradation. Large annexed images (photos on cards) can quickly exhaust quota.
- Fix approach: Implement size estimation before save. Warn users at 80% quota. Add cleanup UI to remove old attachments. Fall back to cloud-only sync if local storage full.

**Legacy Data Migration Code:**
- Issue: migrateOld() function still transforms fl8 format data. Old format references scattered throughout comments
- Files: `C:/florelle/index.html` lines 1527-1561
- Impact: Code complexity. Unnecessary bundled code from 2-3 versions ago. Can remove if all data has been migrated.
- Fix approach: Check if anyone still uses old format. If all users have upgraded (check git history + deployment date), remove migrateOld() and old format references. Document when migration deadline was.

**Weak Token Generation in Signature Worker:**
- Issue: Token collision avoidance uses only 3 retries, no exponential backoff
- Files: `C:/florelle/worker.js` lines 52-58
- Impact: Small collision window under high load. Signature links could overwrite each other if concurrent requests hit same token twice.
- Fix approach: Use UUID or higher entropy token. Implement exponential backoff (10 retries with 10-100ms delays). Check for existing token before writing.

**No Input Validation:**
- Issue: Very limited validation of user input. Phone numbers, dates, amounts accepted without format checks
- Files: `C:/florelle/index.html` throughout (especially modal form fields)
- Impact: Garbage data in database (invalid phone numbers break WhatsApp integration). Date parsing failures. Amount parsing errors. Search/filter logic fails on malformed data.
- Fix approach: Add validation on form submit. Phone: regex check + trim non-digits. Date: ISO format validation. Amount: numeric check, prevent negative values. Show inline validation errors.

**Hardcoded Configuration:**
- Issue: CORS origin hardcoded to `https://brunadona.github.io`, API endpoints hardcoded in code
- Files: `C:/florelle/worker.js` lines 11-15; `C:/florelle/index.html` line 2539 (_WK endpoint)
- Impact: Cannot easily deploy to different domain. Cannot run multiple instances. Cannot test locally. Endpoint changes require code edits.
- Fix approach: Move to environment variables or config file. Load from window.CONFIG or API response. Support local testing with override flag.

## Known Bugs

**Cloud Sync Race Condition:**
- Symptoms: Data from one device could overwrite another device's recent changes if both sync within narrow window
- Files: `C:/florelle/index.html` lines 5112-5147 (_queueCloudSync, _cloudPush, _cloudPull, _cloudInit)
- Trigger: Edit data on Device A, immediately (within 2-5s) edit on Device B. Both will push DATA array to /data endpoint, and last-write-wins overwrites the other.
- Workaround: Wait for "Sincronizado" status before editing on another device. Manually pull (F5 refresh) before making changes.
- Root cause: No version/timestamp checking. No merge logic. Direct array replacement instead of delta sync.
- Fix: Implement version vectors or last-modified timestamps. On conflict, merge changes rather than replace. Track which fields changed and merge at field level, not document level.

**Service Worker Aggressive Cache Clear:**
- Symptoms: All cached assets deleted on every SW update. Users see broken/old UI briefly during activation
- Files: `C:/florelle/sw.js` lines 3-9
- Trigger: Any SW code change triggers activation. All cache.delete() calls run. Subsequent requests fetch from network while cache empty.
- Workaround: Keep browser tab open during SW updates. Reload after update completes.
- Fix: Use versioned cache names (cache-v1, cache-v2). Only delete old versions. Keep current cache during transition. Implement background sync.

**Kommo Webhook Missing Lead ID:**
- Symptoms: WhatsApp messages received from Kommo webhook don't associate with correct lead sometimes
- Files: `C:/florelle/worker.js` lines 276-316 (kommo-webhook handler)
- Trigger: Webhook message with missing/null entity_id field, or multiple fallback paths pick wrong ID
- Workaround: Messages still save to KV storage under key `chat:{leadId}`, just might be under wrong lead ID
- Root cause: Webhook format varies. Multiple format checks (line 283-306) but some message types don't include lead ID directly
- Fix: Add validation that leadId exists and is numeric before storing. Log skipped messages. Request Kommo to always include lead_id in webhook payload.

**Inventory Deduction Not Triggered on Certain Transitions:**
- Symptoms: Inventory not properly decremented when bride moves to secagem/montagem/embalado from some states
- Files: `C:/florelle/index.html` line 1687 (_deductInvForBride only called on drop event)
- Trigger: Moving bride to secagem/montagem/embalado columns in kanban by drag-drop works, but if editing modal and clicking "Move to X" button, deduction might not happen
- Workaround: Always use drag-drop to move cards, not modal buttons
- Fix: Ensure _deductInvForBride() called on all state transitions, not just drag events. Centralize etapa change logic.

**localStorage Quota Alert Blocks App:**
- Symptoms: User sees "Armazenamento local cheio" alert, clicks OK, app state unclear
- Files: `C:/florelle/index.html` line 1572
- Trigger: localStorage quota exceeded (typically after adding many photo attachments)
- Workaround: Open DevTools, clear some localStorage, reload
- Fix: Implement cleanup UI instead of alert. Show storage usage bar. Offer to delete old attachments or sync to Drive only.

## Security Considerations

**Unauthenticated Data Endpoints:**
- Risk: Anyone with knowledge of worker URL can read/write /data endpoint. No API key required.
- Files: `C:/florelle/worker.js` lines 338-351 (GET/POST /data)
- Current mitigation: CORS limited to https://brunadona.github.io. But CORS can be bypassed server-to-server or if origin spoofing possible.
- Recommendations: 
  - Add API key requirement (header: `Authorization: Bearer {key}`)
  - Implement signature verification using HMAC-SHA256
  - Add rate limiting per IP
  - Log all /data endpoint access to audit trail

**Signature Link Tokens Exposed:**
- Risk: Signature links are short 8-character tokens. Could be guessable or brute-forced.
- Files: `C:/florelle/worker.js` lines 24-31 (genToken), 52-58 (retry logic)
- Current mitigation: TTL of 60 days (5184000 seconds). Tokens stored in Cloudflare KV.
- Recommendations: 
  - Increase token length to 16+ characters (use more entropy)
  - Add rate limiting on /sign/:token endpoint
  - Log failed attempts (404 responses)
  - Consider short 5-minute TTL for fresh links, regenerate on demand

**Claude AI Prompt Injection in Kommo Analysis:**
- Risk: User-controlled WhatsApp text and image captions sent to Claude API. Malicious input could manipulate JSON extraction.
- Files: `C:/florelle/worker.js` lines 127-192 (analyze-wa endpoint)
- Current mitigation: Claude model (Haiku) has safety guardrails. JSON parsing fails safely on invalid output.
- Recommendations: 
  - Validate Claude response is valid JSON before returning
  - Add prompt constraints to force strict output format
  - Sanitize extracted JSON before storing (validate phone/CPF/CEP formats)
  - Don't expose raw Claude errors to client

**Google Drive OAuth Token in localStorage:**
- Risk: Google auth token stored in plain localStorage. If localStorage compromised, Drive files accessible.
- Files: `C:/florelle/index.html` (Google auth handling, token storage not visible but likely in localStorage)
- Current mitigation: Tokens expire after 1 hour. User must refresh.
- Recommendations:
  - Store token in sessionStorage instead (cleared on browser close)
  - Use auth proxy that keeps token server-side
  - Implement PKCE for OAuth flow
  - Add CSP header to prevent XSS token theft

**No HTTPS Enforcement:**
- Risk: App works over HTTP (if accessed via http://localhost or internal network). Credentials/data in transit unencrypted.
- Current mitigation: GitHub Pages forces HTTPS. Cloudflare Worker enforces HTTPS on API calls.
- Recommendations: Add HSTS header (force HTTPS). Reject all HTTP requests in worker. Document HTTPS requirement.

**Console Errors Expose Implementation Details:**
- Risk: Production console.error() calls log technical details (API errors, file names, stack traces)
- Files: `C:/florelle/index.html` lines 2564, 2882, 3610; and others
- Impact: Attackers can see API structure, endpoint names, error handling logic
- Fix: Remove console.* calls from production. Use error reporting service (Sentry) if needed.

## Performance Bottlenecks

**Full PAGE Re-render on Every Save:**
- Problem: save() calls _queueCloudSync() and renderAll() recreates entire DOM. All columns, cards re-render.
- Files: `C:/florelle/index.html` lines 1570-1574, 1598-1614
- Cause: No virtual DOM. No dirty tracking. renderAll() is called for any change.
- Improvement path: Implement minimal re-render (update only changed cards). Use requestAnimationFrame to batch updates. Consider React/Vue for efficient rendering.

**Large JSON Serialization/Deserialization:**
- Problem: Entire DATA array (all brides + all reminders + all attachments) serialized on every save
- Files: `C:/florelle/index.html` lines 1571, 5119, 5130; worker.js line 349
- Cause: No delta sync. No incremental saves. Single large JSON object.
- Improvement path: Implement CRDT (Conflict-free Replicated Data Type) or event sourcing. Only serialize changed fields. Compress before transmission.

**Search Filtering on Every Keystroke:**
- Problem: buildCol() filters entire DATA array for each search character entered
- Files: `C:/florelle/index.html` lines 1655-1658 (full-text search), 1824 (_srchQ debounce only 120ms)
- Cause: No search index. Full table scan on every query.
- Improvement path: Implement client-side search index (lunr.js, fuse.js). Increase debounce to 300ms. Cache filter results.

**Photo Attachment Large Binary Handling:**
- Problem: Base64-encoded images stored in localStorage. No compression. Large attachments slow sync.
- Files: `C:/florelle/index.html` (photo upload and storage)
- Cause: No image compression before storage. Base64 adds 33% overhead vs binary.
- Improvement path: Compress images with canvas/ImageMagick API before saving. Store in IndexedDB instead of localStorage. Implement lazy loading for galleries.

**Google Drive API Multiple Sequential Requests:**
- Problem: buildGDriveFolder() makes multiple sequential API calls (list, create, list again)
- Files: `C:/florelle/index.html` lines 2991-3020+ (Drive folder creation)
- Cause: No batching. Waiting for each response before next request.
- Improvement path: Use Google Drive API batch endpoint. Parallelize non-dependent requests with Promise.all().

## Fragile Areas

**Modal Form State Management:**
- Files: `C:/florelle/index.html` (entire modal editing system, lines 1999-4000+)
- Why fragile: Global variables (editId, mRem, mAnexos) hold modal state. Multiple form sections (details, attachments, reminders) spread across HTML. Unsaved changes lost if user navigates away. No undo/redo.
- Safe modification: Extract modal state into object. Use form.reset() on cancel. Implement auto-save drafts. Test all form permutations (empty fields, large text, max attachments).
- Test coverage: Manual testing only. No automated tests for form validation, save/cancel flows, or edge cases (missing required fields, concurrent edits).

**Inventory Calculation Logic:**
- Files: `C:/florelle/index.html` (INV array management, consumption calculation)
- Why fragile: Complex conditional logic for which etapa consumes which inventory. Formulas for silica consumption (8kg per buquê), espuma preta, musgo. Rounding errors in division. Changes to product weights not easy to update.
- Safe modification: Add unit tests for consumption calculations. Parametrize weight constants. Add validation that consumption <= available stock. Document formula assumptions.
- Test coverage: Stress test script exists (stress-test.js) but doesn't validate inventory accuracy deeply.

**WhatsApp Message Template Rendering:**
- Files: `C:/florelle/index.html` (WPP_STAGE_MSGS object, template functions)
- Why fragile: Message templates use string interpolation. First name extraction assumes space-separated names. Phone format must be exact. Links in messages could break if URL changes.
- Safe modification: Use template library (Handlebars, Nunjucks) instead of string templates. Validate phone format before sending. Test all template scenarios (names with punctuation, special chars, very long names).
- Test coverage: No tests for message generation or phone formatting.

**Google Calendar/Tasks Integration:**
- Files: `C:/florelle/index.html` (calUrl, calIso, Google API fetch calls)
- Why fragile: Hardcoded calendar IDs, timezone assumptions. Date format conversions between YYYY-MM-DD and calendar ISO formats. OAuth token expiration not proactively refreshed.
- Safe modification: Store calendar ID in config, not hardcoded. Implement retry logic for 401 Unauthorized (token expired). Test date edge cases (DST transitions, year boundaries, leap years).
- Test coverage: Some tests in florelle_test.js but limited to URL generation, not actual API calls.

**Data Migration Between Versions:**
- Files: `C:/florelle/index.html` (migrateOld function, version-specific migrations like inv_migv3, inv_migv4)
- Why fragile: Multiple migration paths (fl8→v3, INV_KEY v1→v2→v3→v4→v5). Each migration adds complexity. If user skips versions, migrations may not run. No rollback if migration fails.
- Safe modification: Consolidate migrations into single function with clear dependencies. Add logging to track which migrations ran. Test upgrading from each previous version. Add data validation after migration.
- Test coverage: No automated tests for data migrations.

## Scaling Limits

**Single-Device Sync Limitation:**
- Current capacity: Works well for 1-2 users. Cloud sync (Worker + KV) handles small data volumes.
- Limit: At ~500 brides with full attachment history, localStorage quota exhausted. Sync latency increases. Multiple simultaneous users conflict badly.
- Scaling path: Implement backend database (Supabase, Firebase). Move sync logic server-side. Implement proper multi-user conflict resolution. Add incremental sync (delta, not full array).

**Photo Storage in localStorage:**
- Current capacity: ~5MB localStorage quota. ~10-20 high-res photos before quota exceeded.
- Limit: Each attachment (photo) as Base64 in DATA array. No cleanup. Old photos never removed.
- Scaling path: Move photos to cloud storage (Google Drive, Cloudflare R2). Store only URL in DATA. Implement image cleanup policy (delete after 2 years). Add photo compression on upload.

**Worker KV Data Retention:**
- Current capacity: Cloudflare KV has soft limit of 10MB per namespace. No explicit quota enforced in code.
- Limit: Storing signature links (60-day TTL), contract HTML (2-year TTL), chat messages (90-day TTL), pending confirmations (30-day TTL). Without manual cleanup, KV fills up.
- Scaling path: Implement KV cleanup script (cron job). Monitor usage. Implement hard quotas with error handling. Archive old data to cold storage.

**Concurrent User Limit:**
- Current capacity: Single Cloudflare Worker instance. ~100-1000 concurrent requests/second (depends on Worker CPU time).
- Limit: No connection limiting in code. Kommo sync, Google Drive auth, Claude API calls all happen synchronously. Single long-running operation blocks others.
- Scaling path: Queue long operations (Kommo sync) with job worker. Implement connection pooling. Add rate limiting per user.

## Dependencies at Risk

**Cloudflare Workers Runtime Dependency:**
- Risk: App tightly coupled to Cloudflare Workers for data sync, signatures, and API proxying. If Workers unavailable, sync/signing breaks. No offline fallback.
- Impact: Cloud features blocked when Workers down. Users on offline see stale data. Kommo sync and Google Drive uploads fail.
- Migration plan: Add offline queue for pending operations. Store sync data in IndexedDB as backup. Implement retry logic with exponential backoff. Consider fallback to localStorage-only mode if Workers unavailable.

**Google APIs Deprecation Risk:**
- Risk: Code uses Google Calendar v3, Google Drive v3 APIs. Google occasionally deprecates or changes auth flows.
- Impact: Calendar sync stops working if API deprecated. OAuth flow breaks if auth server changes.
- Plan: Monitor Google deprecation notices. Keep client libraries updated. Use SDK instead of direct fetch calls to API (simpler to update when API changes).

**Kommo API Rate Limiting:**
- Risk: No rate limiting in Kommo sync code. Fetching 250 leads + up to 50 contacts in batch. Could hit Kommo rate limits.
- Impact: Sync fails with 429 errors. Users see "Erro ao sincronizar Kommo".
- Plan: Implement exponential backoff. Cache Kommo data locally. Sync less frequently (every 5min instead of continuous). Add rate limit status to UI.

**jsPDF / html2canvas Library Risk:**
- Risk: Large external libraries (2.5.1 MB jspdf, 1.4 MB html2canvas) loaded from CDN. No fallback if CDN unavailable.
- Impact: Contract PDF generation fails without libraries. Users can't export/sign contracts.
- Plan: Bundle libraries locally instead of CDN. Implement fallback export to HTML. Use smaller PDF library (pdfkit) or server-side rendering.

## Missing Critical Features

**Audit Trail / Activity Log:**
- Problem: No record of who changed what, when. Deletions not logged.
- Blocks: Compliance (if app used for business records). Troubleshooting (can't track when data broke). Accidental deletion recovery.
- Priority: Medium (nice-to-have for small operation, critical for scaling).

**Offline-First Sync:**
- Problem: App requires internet for cloud features. Editing works offline (stored in localStorage), but sync blocked without connection.
- Blocks: Mobile users on weak connections. Airplane mode work.
- Priority: Medium.

**Multi-User Permissions:**
- Problem: Single-user only. No way to share access with assistant/team without sharing browser login.
- Blocks: Scaling the business (hiring help). Collaboration.
- Priority: High (prevents business growth).

**Backup / Export:**
- Problem: Users can export Kommo or Google Drive, but no native full-database backup.
- Blocks: Disaster recovery. Data portability. Compliance (LGPD in Brazil).
- Priority: Medium.

**Automated Alerts:**
- Problem: Overdue payments, late silica processing only shown on kanban cards, no notifications.
- Blocks: Active business management. Preventing late orders.
- Priority: Medium (time-sensitive operations at risk).

## Test Coverage Gaps

**Modal Form Validation:**
- What's not tested: Form field validation (required fields, format checks). Edge cases (very long names, special characters, empty phone numbers). Save/cancel flows. Unsaved changes warning.
- Files: `C:/florelle/index.html` (entire modal system)
- Risk: Silent failures (form submits invalid data). Data loss (cancel doesn't prompt before discarding). Bad user experience.
- Priority: High.

**Sync Conflict Resolution:**
- What's not tested: Two devices editing simultaneously. One device offline then reconnects. Server data older than local data.
- Files: `C:/florelle/index.html` (sync functions), `C:/florelle/worker.js` (/data endpoint)
- Risk: Data loss. Conflicting edits overwrite each other. Users see stale data.
- Priority: High.

**Inventory Calculations:**
- What's not tested: Edge cases (consuming more inventory than available). Rounding errors (consumption of multiple items). Migration between INV versions.
- Files: `C:/florelle/index.html` (INV logic)
- Risk: Negative inventory. Phantom stock. Production delays (running out unexpectedly).
- Priority: High (blocks production).

**Google Integration (Drive, Calendar, OAuth):**
- What's not tested: OAuth token expiration and refresh. Drive quota exceeded. Calendar event conflicts. Permission errors (can't create calendar).
- Files: `C:/florelle/index.html` (Google API calls)
- Risk: Silent failures. Users think data synced but it didn't. Calendar invite never created.
- Priority: High.

**Error Handling Paths:**
- What's not tested: Network failures during upload. Quota exceeded. Invalid data from server. Malformed JSON. Stale version conflicts.
- Files: Throughout codebase
- Risk: Crashes. Data corruption. Users stuck with errors they can't fix.
- Priority: High.

**Kommo Webhook Processing:**
- What's not tested: Various message formats (text, images, links). Missing fields. Concurrent webhooks. Stale data in KV.
- Files: `C:/florelle/worker.js` (kommo-webhook handler)
- Risk: Messages lost or associated with wrong leads. Sync out of date.
- Priority: Medium.

---

*Concerns audit: 2026-08-09*
