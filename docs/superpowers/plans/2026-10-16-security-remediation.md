# ScreenCraft Security Remediation Plan

> **For agentic workers:** Use this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Remediate the dependency, injection, upload resource, and HTTP-header findings from the ScreenCraft security audit without changing the landing-page design.

**Architecture:** Keep the app client-only and preserve its current Tailwind v3 setup. Upgrade vulnerable dependencies to patched compatible versions, make generated chart styles safe React text, reject oversized image dimensions from file metadata before full image decode, and set a production CSP and complementary security headers through Vercel.

**Tech Stack:** React 19, TypeScript, Vite, npm, Vercel static hosting.

---

### Task 1: Update vulnerable dependencies

**Files:**
- Modify: `app/package.json` only if a direct package range must change
- Modify: `app/package-lock.json`

- [x] Run npm's non-breaking audit fix and review changed package versions.
- [x] Resolve compatible transitive packages and confirm that remaining Tailwind findings are confined to development tooling. The `braces` advisory currently has no patched release; its exploit requires attacker-controlled brace patterns, while this app uses fixed repository globs during build.
- [x] Re-run full and production-only `npm audit`; production dependencies are clear. Full audit still reports five high-severity package entries in the Tailwind v3 development chain.

### Task 2: Remove the chart raw-HTML sink

**Files:**
- Modify: `app/src/components/ui/chart.tsx`

- [x] Build the generated CSS string as before but render it as a React text child, not `dangerouslySetInnerHTML`.
- [x] Confirm no raw HTML sinks remain in application source.

### Task 3: Validate image dimensions before decoding

**Files:**
- Modify: `app/src/lib/fileValidation.ts`
- Modify: `app/src/hooks/useMediaUpload.ts`

- [x] Parse dimensions from supported PNG, JPEG, and WebP headers before creating a data URL or image element.
- [x] Reject unsupported or invalid image metadata and images above the existing dimension cap before full decode.
- [x] Keep the existing size limit and user-facing error behavior.

### Task 4: Harden deployed response headers

**Files:**
- Modify: `app/vercel.json`

- [x] Add a CSP that permits same-origin app assets, local blob/data media, inline styles already used by the app, and consent-gated Google Analytics resources.
- [x] Add Referrer-Policy and a least-privilege Permissions-Policy.
- [x] Remove the legacy X-XSS-Protection header; retain nosniff and frame denial.

### Task 5: Verify remediation

**Files:**
- No additional source files.

- [x] Run the production build and lint command. The build passes; lint reports 12 errors, including pre-existing Fast Refresh/state-in-effect issues and the pre-existing filename control-character regex rule.
- [x] Re-run full and production-only npm audits and source scans. Production audit has 0 advisories; full audit has 5 development-only high-severity package entries from the unpatched Tailwind v3 `braces` chain; no raw HTML sinks remain.
- [x] Parse and inspect the Vercel header configuration. The configuration check passes; live headers remain unchanged until a deployment, which was not requested here.
- [ ] Inspect the final diff and report advisories that cannot be safely fixed without a breaking migration.
