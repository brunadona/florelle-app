# External Integrations

**Analysis Date:** 2026-08-09

## APIs & External Services

**Google Cloud:**
- Google Drive API (v3) - File upload, folder management, document storage
  - SDK/Client: Native Fetch API (no SDK)
  - Auth: OAuth 2.0 token via Google Sign-In
  - Client ID: `GD_CLIENT_ID` (hardcoded in `index.html:5007`)
  - Key files: `index.html` (lines 2428, 2991, 3015, 3266)

- Google Calendar API (v3) - Event scheduling, calendar sync
  - SDK/Client: Native Fetch API
  - Auth: OAuth 2.0 token from Google Sign-In
  - Key files: `index.html` (lines 3495-3536)

- Google Tasks API - Task management integration
  - SDK/Client: Native Fetch API
  - Auth: OAuth 2.0 token from Google Sign-In
  - Key files: `index.html` (lines 3542+)

- Google Sign-In SDK - Authentication entry point
  - SDK: `accounts.google.com/gsi/client` (async defer)
  - Initialization: `google.accounts.oauth2.initTokenClient()` at line 5017 in `index.html`

**Anthropic (Claude AI):**
- Claude API - WhatsApp message and contract analysis
  - Model: claude-haiku-4-5-20251001
  - Endpoint: `https://api.anthropic.com/v1/messages`
  - Auth: Bearer token via `ANTHROPIC_KEY` environment variable in Cloudflare Worker
  - Capabilities: Multimodal (text + images), extracts bride data from WhatsApp chats
  - Key files: `worker.js` (lines 127-192)

**Kommo CRM:**
- Kommo API (v4) - Lead and contact management (Russian CRM similar to amoCRM)
  - Endpoints:
    - GET `https://{subdomain}.kommo.com/api/v4/leads` - List leads with contacts
    - GET `https://{subdomain}.kommo.com/api/v4/contacts` - Batch contact lookup
    - GET `https://{subdomain}.kommo.com/api/v4/leads/{id}/notes` - Lead notes
    - GET `https://{subdomain}.kommo.com/api/v4/chats/{id}/messages` - Chat messages
  - Auth: Bearer token (provided by user in app)
  - Max results: 250 leads per request, 50 contacts per batch
  - Key files: `worker.js` (lines 194-272)

- Kommo Webhooks - Receive WhatsApp messages and lead updates
  - Endpoint: `POST /kommo-webhook` (in Cloudflare Worker)
  - Formats supported: Notes, chat messages, events, batch messages
  - Storage: Messages stored in Cloudflare KV with 90-day TTL
  - Key files: `worker.js` (lines 274-316)

## Data Storage

**Databases:**
- Cloudflare KV - Primary persistent store
  - Connection: Native to Cloudflare Worker environment (`env.SIGN_KV`)
  - Namespace: `FLORELLE_SIGN` (configured in Cloudflare Dashboard)
  - Use cases:
    - Contract signing tokens (60-day TTL)
    - Signed contract HTML (2-year TTL)
    - Pending confirmations (30-day TTL)
    - WhatsApp chat messages (90-day TTL)
    - App data sync across devices (no TTL)

**File Storage:**
- Google Drive - Primary file storage for contracts, photos, exports
  - Folders: Organized by bride ID under root folder
  - File types: PDFs, images, JSON exports
  - Sync mechanism: Manual user upload via Drive picker

- Local filesystem (Client-side):
  - localStorage - Persists app data and settings
  - Service Worker cache - Not used for application data (cache: no-store)

**Caching:**
- None configured - Service Worker uses no-store policy
- Cloudflare edge caching at Worker level (automatic)

## Authentication & Identity

**Auth Provider:**
- Google OAuth 2.0 (Google Sign-In)
  - Implementation: Google Accounts OAuth 2.0 Token Client
  - Scopes: Drive (upload), Calendar (create events), Tasks (create tasks)
  - Token flow: User initiates sign-in → Google popup → token returned to app
  - Client ID: Hardcoded in `index.html` (line 5007)
  - Key files: `index.html` (lines 5007-5080)

**Kommo CRM Auth:**
- User-provided Bearer token (OAuth 2.0 bearer token from Kommo account)
- Tokens stored in app memory during session (not persisted to disk)
- Validation: API calls fail if token invalid

## Monitoring & Observability

**Error Tracking:**
- None detected - Errors handled locally with try/catch blocks

**Logs:**
- Browser console only (no centralized logging)
- Service Worker logs (internal browser tools)
- Cloudflare Worker logs (accessible via Cloudflare Dashboard)

## CI/CD & Deployment

**Hosting:**
- GitHub Pages (`https://brunadona.github.io/florelle-app/`)
- Automatic deployment on git push (GitHub Pages publishes from repository)

**Cloudflare Workers:**
- Deployed via Cloudflare Dashboard
- Endpoint: `https://florelle.brunadonaa.workers.dev`
- Manual deployment (not automated)

**CI Pipeline:**
- None detected - Direct push to GitHub Pages

## Environment Configuration

**Required env vars (Cloudflare Worker only):**
- `ANTHROPIC_KEY` - Anthropic API key for Claude integration

**Secrets location:**
- Cloudflare Worker Settings → Environment Variables (`ANTHROPIC_KEY`)
- Google OAuth credentials - Hardcoded in `index.html` (not a secret; public credentials)
- User-provided Kommo tokens - Entered via UI, stored in app memory only

## Webhooks & Callbacks

**Incoming:**
- Kommo Webhook: `POST https://florelle.brunadonaa.workers.dev/kommo-webhook`
  - Receives: Lead updates, notes, WhatsApp messages
  - Processing: Extracts text and stores in Cloudflare KV

**Outgoing:**
- Google Drive API - File uploads from app
- Google Calendar API - Event creation from app
- Anthropic API - Claude request for message analysis
- Kommo API - Data fetches from app

## API Endpoints (Cloudflare Worker)

**Application Data Sync:**
- `GET /data` - Fetch synced app data
- `POST /data` - Save app data (syncs across devices)

**Contract Signing:**
- `POST /sign` - Generate token for signing link (returns 8-char token)
- `GET /sign/:token` - Retrieve contract data by token
- `POST /contract/:brideId` - Save signed contract HTML
- `GET /contract/:brideId` - Retrieve signed contract

**Pending Confirmations:**
- `POST /pending-confirm` - Store confirmation pending
- `GET /pending-confirms` - Retrieve and clear pending confirmations

**Kommo Integration:**
- `POST /kommo` - Fetch leads + contacts from Kommo CRM (with optional notes)
- `POST /kommo-notes` - Fetch notes for specific lead
- `POST /kommo-webhook` - Receive webhook from Kommo (WhatsApp messages)

**AI Analysis:**
- `POST /analyze-wa` - Analyze WhatsApp conversation with Claude
  - Input: Text chat or images (base64)
  - Output: Extracted bride data (name, phone, date, product, etc.)

---

*Integration audit: 2026-08-09*
