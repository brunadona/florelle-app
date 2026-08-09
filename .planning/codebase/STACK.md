# Technology Stack

**Analysis Date:** 2026-08-09

## Languages

**Primary:**
- HTML5 - Markup (single-file application)
- CSS3 - Styling (custom design system with CSS variables)
- JavaScript (ES2020+) - Application logic and interactivity

**Secondary:**
- JSON - Configuration and data interchange
- Markdown - Documentation

## Runtime

**Environment:**
- Browser: Modern browsers with ES2020 support, Service Workers, Web APIs
- Server-side: Cloudflare Workers (ES Module runtime)
- Build target: None (no build step; direct deployment)

**Package Manager:**
- None - Dependencies loaded via CDN (see Key Dependencies below)
- Lockfile: Not applicable (CDN-based)

## Frameworks

**Core:**
- None - Vanilla JavaScript (no framework like React, Vue, Angular)
- Browser APIs: Fetch API, Service Workers, localStorage, Web Workers

**Testing:**
- Included test files: `florelle_test.js`, `stress-test.js` (not integrated in build)

**Build/Dev:**
- No build tool (webpack, vite, esbuild, etc.)
- Direct asset serving via GitHub Pages

## Key Dependencies

**PDF/Export:**
- html2canvas 1.4.1 - Screenshots/PNG generation (CDN: cdnjs.cloudflare.com)
- jspdf 2.5.1 - PDF document generation (CDN: cdnjs.cloudflare.com)
- jszip 3.10.1 - ZIP archive creation (CDN: cdnjs.cloudflare.com)

**Fonts & UI:**
- Google Fonts CDN - Cormorant Garamond, DM Sans, EB Garamond

## Configuration

**Environment:**
- No `.env` files
- Configuration via hardcoded constants in `index.html`:
  - `GD_CLIENT_ID` - Google OAuth 2.0 Client ID
  - `GD_SCOPE` - Google API scopes (Drive, Calendar, Tasks)
  - Cloudflare Worker endpoint: `https://florelle.brunadonaa.workers.dev`
- Server-side secrets (Cloudflare Worker):
  - `ANTHROPIC_KEY` - Anthropic API key (environment variable in Worker)

**Build:**
- No build configuration files
- Direct HTML/JS/CSS deployment to GitHub Pages

## Platform Requirements

**Development:**
- Text editor (VS Code recommended)
- Git for version control
- Cloudflare account (for Worker deployment)
- Google OAuth credentials (for Drive/Calendar/Tasks APIs)

**Production:**
- Deployment: GitHub Pages (`https://brunadona.github.io/florelle-app/`)
- Cloudflare Worker edge compute (`florelle.brunadonaa.workers.dev`)
- HTTPS required for Service Workers and OAuth

## Application Architecture

**Entry Points:**
- `index.html` - Single-page application (PWA)
- `sw.js` - Service Worker (cache management, offline support)
- `worker.js` - Cloudflare Worker (backend API, integrations)

**Storage Strategy:**
- Client-side: localStorage (persistent data cache)
- Server-side: Cloudflare KV (synced data, shared across devices)
- Browser memory: Application state in global variables

**Performance Optimizations:**
- Service Worker with cache-busting (cache: no-store policy)
- Lazy-loading of fonts via preconnect
- Minified inline CSS and JavaScript
- CDN-hosted external libraries (html2canvas, jspdf, jszip)

---

*Stack analysis: 2026-08-09*
