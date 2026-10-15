# Google Search Launch Readiness Scope

## User goal

Prepare the existing ScreenCraft web app for discovery and launch through Google Search. Preserve the current landing-page design.

## Scope

- Add accurate privacy information that reflects in-browser media processing, the existing GA4 event payloads, local storage, and offline app-shell caching.
- Add a concise user-facing guide to help visitors understand supported media, limits, and the upload-to-export workflow.
- Link both pages from the existing site without redesigning the landing page.
- Keep the sitemap and structured data accurate for actual public content.
- Verify the production build and direct page access; exercise browser flows where supported.

## Constraints and assumptions

- This scope assumes Google Search, not Chrome Web Store or Google Play distribution.
- Do not claim Google will index or rank the site, or that structured data guarantees rich results.
- Do not invent a privacy contact, data-retention setting, or analytics configuration. If required for a complete privacy notice, ask the user.
- User media and filenames must not be included in analytics. Analytics settings should be made transparent and controllable.
- Do not change the established landing-page composition or add keyword-stuffed content.

