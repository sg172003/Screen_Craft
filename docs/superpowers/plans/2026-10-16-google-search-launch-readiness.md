# Google Search Launch Readiness Implementation Plan

> **For agentic workers:** Execute this plan inline because the user explicitly authorized these changes. Preserve the current landing-page design.

**Goal:** Prepare ScreenCraft's existing web app for a Google Search launch by improving privacy transparency, useful help content, crawl metadata, and launch verification.

**Architecture:** Keep the existing Vite and React application. Add accessible, brand-consistent privacy and help pages with stable public URLs, link them from the current footer, gate GA4 behind an explicit analytics choice, and keep sitemap entries limited to real public content pages.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS, static public assets, Playwright.

---

### Task 1: Privacy controls and disclosure

**Files:**
- Modify: `app/src/lib/analytics.ts`
- Create: `app/src/components/AnalyticsConsent.tsx`
- Modify: `app/src/App.tsx`
- Create: `app/public/privacy/index.html`
- Modify: `app/src/sections/LandingPage.tsx`

- [x] Default GA4 to off until the user chooses; persist the choice locally and provide a way to change it later.
- [x] Document local media processing, analytics events and metadata, the absence of media/file-name uploads, local storage, service-worker caching, and browser-dependent video support without inventing retention periods or contact details.
- [x] List the actual GA4 event payloads and local-storage values in the notice.
- [x] Link the privacy page and analytics settings from the existing footer without changing the landing layout.

### Task 2: Helpful public guide

**Files:**
- Create: `app/public/help/index.html`
- Modify: `app/src/sections/LandingPage.tsx`

- [x] Add a concise how-to page covering supported formats, size/dimension/duration limits, upload/paste, customization, export scale, and browser-dependent video codecs.
- [x] Add a footer link and clear route back to the editor.

### Task 3: Search metadata and sitemap

**Files:**
- Modify: `app/public/sitemap.xml`
- Modify: `app/index.html`

- [x] Include only stable, useful, crawlable public pages in the sitemap and avoid stale or decorative sitemap metadata.
- [x] Keep structured data consistent with visible product details and avoid promising rich results.
- [x] Match FAQ structured-data questions and answers to the visible FAQ text.

### Task 4: Verification

**Files:** no additional production files.

- [x] Run `git diff --check` and `npm run build`.
- [x] Confirm the build output contains the privacy page, help page, and shared stylesheet.
- [ ] Run a targeted local browser pass for the landing page, direct privacy/help URLs, analytics opt-in/opt-out, and mobile layout. Attempted; Python Playwright is unavailable and the in-app browser could not reach the local Vite server.
- [ ] Report browser engines actually exercised; do not imply cross-browser coverage unless those engines ran.

