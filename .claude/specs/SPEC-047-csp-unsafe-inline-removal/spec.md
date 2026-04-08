# SPEC-047: CSP unsafe-inline Removal (Pre-Phase 2 Hardening)

| Field | Value |
|-------|-------|
| **Spec ID** | SPEC-047 |
| **Title** | CSP unsafe-inline Removal (Pre-Phase 2 Hardening) |
| **Type** | security |
| **Status** | draft |
| **Priority** | HIGH |
| **Complexity** | MEDIUM |
| **Created** | 2026-03-17 |
| **Origin** | GAP-042-05, GAP-042-14 (from `specs-gaps-042.md`) |
| **Blocks** | SPEC-046 Phase 2 (CSP enforcement transition) |
| **Dependencies** | SPEC-042 Phase 1 (CSP Report-Only) must be complete |
| **Does NOT depend on** | SPEC-045 (Vite 7 migration) .. this is web app only |

---

<!-- Added: Cross-reference execution order, 2026-03-17 -->
## CSP Phase 2 Execution Chain

SPEC-047 is Phase B1 in the CSP enforcement chain. It runs in PARALLEL with SPEC-045 (Phase B2). It affects only the web app (`apps/web/`).

### Execution Order

| Phase | Spec | Scope | Depends On | Status |
|-------|------|-------|------------|--------|
| **A** | **SPEC-042** | CSP Phase 1 Report-Only for web + admin | None | Completed |
| **B1** | **SPEC-047** (this spec) | Remove `'unsafe-inline'` from web `script-src` | SPEC-042 | Draft |
| **B2** | **SPEC-045** | Vite 7 migration + admin nonce wiring | SPEC-042 | Draft |
| **C** | **SPEC-046 §1B** | Apply 8 quick-win CSP directive fixes | SPEC-045 | Draft |
| **D** | **SPEC-046** | 14-day observation period on staging | SPEC-045 + SPEC-047 + quick wins | Draft |
| **E** | Phase 2 switch | Change Report-Only to enforcement | SPEC-046 passing | — |

> **This spec does NOT depend on SPEC-045.** It only touches `apps/web/` (Astro) while SPEC-045 only touches `apps/admin/` (TanStack Start). They can execute simultaneously with no merge conflicts.

### What This Spec Unblocks

Once SPEC-047 is complete:
- Web app `script-src` uses hash-based integrity instead of `'unsafe-inline'`
- SPEC-046 observation period can track web CSP with meaningful hash-based protection
- Phase 2 enforcement for web becomes viable (hashes block unknown scripts)

### References

- Origin spec: `.claude/specs/SPEC-042-csp-nonce-integration/spec.md`
- Gap analysis: `.claude/specs/specs-gaps-042.md` (GAP-042-05, GAP-042-14)
- Parallel track: `.claude/specs/SPEC-045-vite7-migration/spec.md`
- Next in chain: `.claude/specs/SPEC-046-csp-post-deploy-verification/spec.md`

## Problem Statement

The web app's CSP HTTP header (set in `apps/web/src/middleware.ts:111`) includes `'unsafe-inline'` in `script-src`:

```
script-src 'self' 'strict-dynamic' 'unsafe-inline' https:
```

This exists because two scripts in `BaseLayout.astro` use the `is:inline` directive, which **bypasses Astro's module bundler** and therefore does **not** receive auto-computed SHA-256 hashes. Without `'unsafe-inline'`, these scripts would be blocked in CSP1 browsers (where `'strict-dynamic'` is not supported).

### Current CSP fallback chain

| CSP Level | What the browser uses | Protection level |
|-----------|----------------------|-----------------|
| **CSP3** (all modern browsers) | `'strict-dynamic'` .. ignores `'unsafe-inline'` and `https:` | Secure |
| **CSP2** | Hashes from `<meta>` tag .. ignores `'unsafe-inline'` when hashes present | Secure (but `is:inline` scripts have NO hashes) |
| **CSP1** | `'unsafe-inline'` + `https:` as fallback | **Insecure** .. allows any inline script |

The result: Astro's hash-based CSP protection is **irrelevant** for the two `is:inline` scripts because they have no hashes, and `'unsafe-inline'` allows everything anyway.

### Why this blocks Phase 2

When SPEC-046 transitions from `Content-Security-Policy-Report-Only` to enforced `Content-Security-Policy`, the policy must actually protect against XSS. Keeping `'unsafe-inline'` in an enforced policy provides **zero protection** against script injection in CSP1 browsers.

---

## Scope

### In Scope

1. **Migrate FOUC prevention script** (`BaseLayout.astro:84-91`) from `is:inline` to a bundled/hashed approach
2. **Migrate scroll-reveal observer** (`BaseLayout.astro:119-178`) from `is:inline` to a bundled/hashed approach
3. **Remove `'unsafe-inline'` from `script-src`** in `apps/web/src/middleware.ts:111`
4. **Document all inline scripts** in web components (audit of 10+ `<script>` blocks across components)
5. **Verify all scripts still work** after migration (dark mode, scroll animations, navigation)
6. **Update CSP tests** to assert `'unsafe-inline'` is absent from `script-src`

### Out of Scope

- `style-src 'unsafe-inline'` .. required for Sentry Session Replay (rrweb), tracked separately
- Admin app CSP (nonce-based, handled by SPEC-042)
- API app CSP defaults (`apps/api/src/utils/env.ts` default value, tracked by GAP-042-09)
- Phase 2 enforcement transition (SPEC-046)

---

## Current State

### `is:inline` scripts (2 total, both in BaseLayout.astro)

#### 1. FOUC prevention (lines 84-91)

```html
<script is:inline>
  (function() {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  })();
</script>
```

- **Purpose**: Reads `localStorage` and sets `data-theme="dark"` before first paint to prevent flash of unstyled content (FOUC).
- **Constraint**: MUST execute synchronously in `<head>` before any rendering. If deferred, users see a white flash before dark mode applies.
- **Size**: ~7 lines, ~250 bytes.

#### 2. Scroll reveal observer (lines 119-178)

```html
<script is:inline>
  (function () {
    // IntersectionObserver setup for .scroll-reveal elements
    // MutationObserver for Server Islands arriving after initial load
    // Reduced motion support
  })();
</script>
```

- **Purpose**: Sets up IntersectionObserver for scroll-reveal animations and MutationObserver for dynamically added content (Server Islands).
- **Constraint**: Must run after DOM is parsed. Currently placed at end of `<body>`.
- **Size**: ~60 lines, ~2KB.

### Non-`is:inline` scripts (auto-hashed by Astro)

These scripts use regular `<script>` tags (without `is:inline`) and are automatically bundled and hashed by Astro. They are **already CSP-safe** and require no migration:

| Component | File | Purpose |
|-----------|------|---------|
| LitoralMap | `components/destination/LitoralMap.astro:312` | Map interaction |
| DestinationCarousel | `components/destination/DestinationCarousel.astro:116` | Carousel navigation |
| DestinationPreview | `components/destination/DestinationPreview.astro:156` | Preview hover logic |
| AccordionFAQ | `components/shared/AccordionFAQ.astro:127` | Accordion toggle |
| SortDropdown | `components/shared/SortDropdown.astro:57` | Sort selection |
| NavigationProgress | `components/shared/NavigationProgress.astro:20` | Navigation bar |
| ThemeToggle | `components/ui/ThemeToggle.astro:70` | Theme persistence |
| HeroSection | `components/sections/HeroSection.astro:103` | Hero animations |
| Header | `layouts/Header.astro:161` | Mobile menu toggle |
| Footer | `layouts/Footer.astro:116` | Footer interactions |
| ForgotPassword | `pages/[lang]/auth/forgot-password.astro:48` | Form logic |
| AccountPage | `pages/[lang]/mi-cuenta/index.astro:352` | Account logic |

Additionally, JSON-LD scripts (`type="application/ld+json"`) are data-only and not subject to `script-src` restrictions.

---

## Technical Approach

### Option A: Regular `<script>` tags (Astro auto-hash)

Remove `is:inline` and let Astro bundle and hash the scripts automatically.

**Pros:**
- Simplest approach. Astro handles everything.
- Scripts get SHA-256 hashes in the `<meta>` CSP tag automatically.
- No manual hash management.

**Cons:**
- Astro bundles regular `<script>` tags as **deferred ES modules** (`type="module"`). They execute after HTML parsing, not during `<head>` processing.
- **FOUC prevention WILL break**: The dark mode script must execute synchronously before first paint. A deferred module would cause a visible white flash before dark mode applies.
- Scroll-reveal script may work fine since it already runs after DOM parsing.

**Verdict**: Works for scroll-reveal. Does NOT work for FOUC prevention.

### Option B: Manual SHA-256 hashes in CSP header

Keep `is:inline` but compute SHA-256 hashes of the script content and add them to the CSP HTTP header. This allows removing `'unsafe-inline'` while preserving synchronous execution.

**Pros:**
- Preserves synchronous execution for FOUC prevention.
- Explicit hash allowlist is more secure than `'unsafe-inline'`.
- No change to script behavior.

**Cons:**
- Hashes must be updated whenever script content changes (fragile).
- Requires a build step or script to compute hashes.
- Dual policy complexity: hashes in both `<meta>` (Astro) and HTTP header (middleware).
- Manual hash in middleware must match exact script bytes (whitespace-sensitive).

**Verdict**: Works but adds maintenance burden.

### Option C: CSS-only FOUC prevention + regular script for scroll-reveal

Replace the FOUC prevention JavaScript with a pure CSS approach, then migrate scroll-reveal to a regular `<script>`.

**CSS-only dark mode approach:**
```css
/* In global.css - applied before any JS runs */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    /* dark mode tokens */
  }
}
```

Combined with a `<meta name="color-scheme" content="light dark">` tag that tells the browser to apply system preference immediately.

**Pros:**
- Zero JavaScript needed for initial theme application.
- No FOUC by design .. CSS is render-blocking, applied before first paint.
- Scroll-reveal migrates cleanly to regular `<script>` (auto-hashed).
- Cleanest solution long-term.

**Cons:**
- Requires restructuring how dark mode tokens are defined in `global.css`.
- Must handle the case where user has explicitly chosen a theme via `localStorage` (CSS cannot read `localStorage`).
- The ThemeToggle component must coordinate with the CSS approach.
- More complex implementation than Option B.

**Verdict**: Best long-term but highest implementation effort.

### Option D (Recommended): Hybrid approach

1. **FOUC prevention**: Use Option B (manual hash). The script is tiny (~250 bytes), stable, and rarely changes. Computing its SHA-256 once and adding it to the middleware CSP header is low-effort and low-risk.
2. **Scroll-reveal**: Use Option A (regular `<script>` tag). It already runs after DOM parsing, so deferred execution is fine. Astro auto-hashes it.
3. **Remove `'unsafe-inline'`** from `script-src` in middleware.

**Why this is recommended:**
- Minimal changes to existing behavior.
- FOUC prevention stays synchronous (no visual regression).
- Scroll-reveal gets proper Astro bundling (smaller, cached, hashed).
- Manual hash for one tiny script is acceptable maintenance burden.
- Can later upgrade FOUC prevention to Option C in a separate spec.

---

## Implementation Plan

### Task 1: Migrate scroll-reveal observer to regular `<script>`

**File**: `apps/web/src/layouts/BaseLayout.astro`

1. Remove `is:inline` from the scroll-reveal `<script>` tag (line 119).
2. Convert the IIFE to a top-level module script (Astro wraps regular scripts in modules automatically).
3. Verify IntersectionObserver and MutationObserver still work after page load.
4. Verify Server Island content gets observed (MutationObserver must fire for late-arriving nodes).
5. Verify reduced-motion preference is respected.

**Risk**: Low. The script already executes after DOM parsing. Deferred execution should be equivalent.

### Task 2: Compute SHA-256 hash for FOUC prevention script

**File**: `apps/web/src/middleware.ts`

1. Extract the exact FOUC prevention script content (bytes between `<script is:inline>` and `</script>`).
2. Compute SHA-256 hash: `echo -n '<script content>' | openssl dgst -sha256 -binary | openssl base64`.
3. Add the hash to `script-src` in the middleware CSP header.
4. Document the hash computation process in a code comment for future maintainers.

**Note**: The hash must match the **exact** content Astro emits. Whitespace differences will cause a mismatch. The hash should be verified against the built output.

### Task 3: Remove `'unsafe-inline'` from `script-src`

**File**: `apps/web/src/middleware.ts:111`

1. Replace `"script-src 'self' 'strict-dynamic' 'unsafe-inline' https:"` with `"script-src 'self' 'strict-dynamic' 'sha256-XXXX' 'unsafe-inline' https:"` first (with hash added).
2. Then remove `'unsafe-inline'`: `"script-src 'self' 'strict-dynamic' 'sha256-XXXX' https:"`.

**Wait**: Actually, `'unsafe-inline'` should be **kept as CSP1 fallback**. Per the CSP spec:
- CSP3 browsers: `'strict-dynamic'` ignores `'unsafe-inline'`.
- CSP2 browsers: Hashes ignore `'unsafe-inline'`.
- CSP1 browsers: Only `'unsafe-inline'` works (hashes and `'strict-dynamic'` are unknown).

The `'unsafe-inline'` is only dangerous in CSP1 browsers (IE11, very old mobile browsers). In CSP2+ it is automatically ignored when hashes are present. The SPEC-042 spec explicitly documents this layered fallback (Revision #21).

**Decision point**: Should `'unsafe-inline'` be removed entirely (breaking CSP1 browsers) or kept as a backward-compatible fallback? This needs user input.

**Recommended**: Keep `'unsafe-inline'` but ensure hashes are present so CSP2+ browsers ignore it. This matches the Google-recommended `'strict-dynamic'` + hash + `'unsafe-inline'` + `https:` pattern.

**Revised goal**: The real fix is ensuring the `is:inline` scripts have proper hashes so that CSP2+ browsers use hash-based integrity instead of falling back to `'unsafe-inline'`. The `'unsafe-inline'` token stays as a CSP1 safety net.

### Task 4: Update CSP tests

**Files**: `apps/web/test/lib/middleware-helpers.test.ts` (or equivalent)

1. Add test asserting `script-src` contains `sha256-` hash(es).
2. Add test asserting the hash matches the actual FOUC prevention script content.
3. Add test verifying the CSP fallback chain: `'strict-dynamic'` + hash + `'unsafe-inline'` + `https:`.
4. Consider adding a build-time hash verification script that fails CI if the FOUC script changes without updating the hash.

### Task 5: Verify all page functionality

1. Dark mode toggle works without FOUC.
2. Scroll-reveal animations trigger on scroll.
3. Server Island content gets reveal animations.
4. Reduced motion preference disables animations.
5. No CSP violations in browser console (Report-Only mode).
6. Check Sentry for any new CSP violation reports.

### Task 6: Document inline script inventory

Create or update documentation listing all inline scripts in the web app, their CSP status (auto-hashed vs manual hash), and their execution requirements.

---

## Acceptance Criteria

- [ ] Scroll-reveal script migrated from `is:inline` to regular `<script>` (Astro auto-hashes it)
- [ ] FOUC prevention script has a manually computed SHA-256 hash in the CSP `script-src` directive
- [ ] CSP `script-src` includes hash(es) so CSP2+ browsers use hash-based integrity
- [ ] All page functionality preserved: dark mode (no FOUC), scroll-reveal animations, Server Island animations
- [ ] Reduced motion preference still disables animations
- [ ] CSP tests updated to verify hash presence and fallback chain
- [ ] No new CSP violations in Sentry after deployment
- [ ] All 10+ non-`is:inline` scripts documented as auto-hashed (no action needed)
- [ ] Code comments document the hash computation process and when to regenerate

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| FOUC on dark mode if hash is wrong | MEDIUM | HIGH | Verify hash against `pnpm build` output; add CI check |
| Scroll-reveal breaks when deferred | LOW | MEDIUM | Script already runs post-DOM; test with Server Islands |
| Hash becomes stale after script edit | MEDIUM | MEDIUM | CI script to verify hash matches source; code comment warning |
| CSP1 browsers lose protection | LOW | LOW | Keep `'unsafe-inline'` as fallback; CSP1 browsers are <1% of traffic |
| Astro changes script output format | LOW | MEDIUM | Pin Astro version; hash verification in CI |

---

## Future Considerations

1. **Option C upgrade**: Migrate FOUC prevention to CSS-only approach in a future spec, eliminating the manual hash entirely.
2. **Build-time hash automation**: Create a Vite plugin or build script that auto-computes the hash and injects it into middleware, removing manual maintenance.
3. **`style-src 'unsafe-inline'` removal**: Tracked separately. Depends on Sentry/rrweb supporting CSP without `'unsafe-inline'` in `style-src`.

---

## References

- [GAP-042-05](../specs-gaps-042.md#gap-042-05-unsafe-inline-en-script-src-web-anula-hash-based-integrity): `'unsafe-inline'` in `script-src` negates hash-based integrity
- [GAP-042-14](../specs-gaps-042.md#gap-042-14-isinline-scripts-no-reciben-hashes-de-astro): `is:inline` scripts do not receive Astro hashes
- [SPEC-042](../SPEC-042-csp-nonce-integration/spec.md): CSP Phase 1 implementation (Report-Only mode)
- [SPEC-046](../SPEC-046-csp-post-deploy-verification/spec.md): CSP Phase 2 enforcement transition
- [Google CSP Strict](https://csp.withgoogle.com/docs/strict-csp.html): Recommended `'strict-dynamic'` + hash + `'unsafe-inline'` + `https:` pattern
- [Astro experimental.csp docs](https://docs.astro.build/en/reference/configuration-reference/#experimentalcsp): Astro's built-in CSP hash generation
