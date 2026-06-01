# Product Design Requirements: SPEC-176 — Web color-system fallback for older browsers + admin browser gate

## 1. Overview

- **Feature name**: Web CSS color-system fallback for pre-Chrome-119 browsers + admin browser-gate banner
- **Feature description**: The Hospeda web app renders colorless/unstyled on browsers that do not support CSS relative color syntax (`oklch(from var(...) ...)`), making interactive UI elements — including the login button — invisible to users. This spec fixes the web color rendering for older browsers and adds a clear, informational gate for admin staff on browsers that cannot run the admin panel at all.
- **Business value/impact**: Resolves Linear BETA-44 (URGENT, area-auth). A real user ("Marta") on Chrome 109/Windows 10 cannot log in because the login button is invisible. This is a conversion-blocking and trust-damaging defect on a public-facing property. The admin gate eliminates silent breakage for internal staff on outdated browsers, replacing confusion with a clear call to action.
- **Target users**:
  - **Primary**: Web visitors on Chrome 109-118 (or equivalent Safari/Firefox versions below the `oklch` relative-color threshold). This includes real users on corporate or institutional machines locked to older browser versions.
  - **Secondary**: Admin staff on browsers below Chrome 111 (the Tailwind v4 hard floor). This is an internal user group.

---

## 2. User Stories

### Story 1: Old-browser visitor can see and interact with the web UI

**As a** web visitor using an older browser (Chrome 109-118 or equivalent)
**I want** the Hospeda website to render with visible colors, readable text, and actionable buttons
**So that** I can browse accommodations, read content, and complete actions like logging in without the page appearing broken or empty

#### Acceptance Criteria:

- [ ] Given I am on Chrome 109 (or equivalent, below Chrome 119), when I visit any page of `apps/web`, then the page renders with the expected brand colors (buttons, backgrounds, text accents, card surfaces) rather than as a colorless/unstyled document
- [ ] Given I am on Chrome 109, when I visit `/es/auth/signin/`, then the login `GradientButton` has a visible background color and is clearly identifiable as a clickable element
- [ ] Given I am on Chrome 109, when I submit the login form with valid credentials, then I am authenticated and redirected normally (the fix is purely visual; the form handler already works)
- [ ] Given I am on Chrome 109, when I navigate between pages (home, accommodations, destinations, events, posts), then color-dependent UI elements (badges, category chips, state indicators, card surfaces) render with correct fallback colors — not transparent or colorless
- [ ] Given I am on Chrome 109, when I use dark mode, then the fallback colors respect the dark-mode token overrides (they do not revert to light-mode values)
- [ ] Given I am on a browser that DOES support relative color syntax (Chrome 119+), when I visit any web page, then I see zero visual difference compared to the current experience (perfect parity — the fallback does not alter appearance on supported browsers)

**Priority:** High (URGENT — blocking login for real users)
**Estimated Complexity:** Large

---

### Story 2: Modern-browser visitor sees zero visual regression

**As a** web visitor on a modern browser (Chrome 119+, Safari 16.4+, Firefox 128+)
**I want** the Hospeda website to look exactly as it does today
**So that** the fallback implementation does not introduce color drift, visual artifacts, or regressions for the majority of users

#### Acceptance Criteria:

- [ ] Given I am on Chrome 119+, when I visit any page of `apps/web`, then all colors match the existing oklch-computed values (no hex drift visible to the naked eye)
- [ ] Given I am on Chrome 119+, when I inspect the computed styles of any element using a variant token (e.g., `--brand-primary-a30`), the browser resolves it via the `@supports`-gated oklch declaration, not the sRGB fallback
- [ ] Given I am on Chrome 119+, when I visit any page, then no new layout shifts, color flashes, or paint artifacts appear relative to the pre-fix baseline
- [ ] Given I am on Chrome 119+ with dark mode enabled, when I visit any page, then dark-mode colors are unchanged

**Priority:** High (regression prevention is as important as the fix)
**Estimated Complexity:** Small (verified by automated visual parity checks — see Section 9)

---

### Story 3: Admin staff on an unsupported browser sees a clear, actionable gate

**As an** admin staff member (editor, host manager, superadmin) using a browser below Chrome 111
**I want** to see a clear banner explaining that my browser is not compatible with the admin panel and telling me what to do
**So that** I understand why the interface looks broken and know how to resolve the situation, rather than wasting time troubleshooting or filing a support ticket

#### Acceptance Criteria:

- [ ] Given I am a staff member and I open `apps/admin` on a browser below Chrome 111, when the page loads, then a full-width banner appears at the top of every admin page with a clear message in my locale (es/en/pt), stating that the browser is not compatible and prompting me to update
- [ ] Given the banner is displayed, when I read it, then it includes: (a) a short explanation that the browser version is too old, (b) the minimum browser version required (Chrome 111 / Firefox 128 / Safari 16.4), (c) a direct CTA link to https://www.google.com/chrome/ (opening in a new tab), and (d) the Hospeda support contact for edge cases (staff locked by IT policy)
- [ ] Given the banner is displayed, when the admin panel itself renders partially broken (as expected on old browsers), the banner remains visible above the broken content so staff can always read and act on it
- [ ] Given I am a staff member on Chrome 111+, when I open the admin panel, then the banner does not appear under any circumstance
- [ ] Given the banner is displayed, when I dismiss it (see Section 5 for dismissibility decision), then the dismiss behavior matches the product decision documented there
- [ ] Given the banner is displayed in Spanish (es locale), when I read it, then the text is grammatically correct Rioplatense Spanish
- [ ] Given the banner is displayed in English (en) or Portuguese (pt), when I read it, then the text is in the correct locale (all three locales covered via `@repo/i18n`)

**Priority:** Medium (admin is an internal tool; staff should have modern browsers, but the gate removes confusion)
**Estimated Complexity:** Small

---

### Story 4: Dynamic badge colors in `@repo/icons` degrade gracefully on old browsers

**As a** web visitor on Chrome 109-118
**I want** entity type badges (accommodation, destination, event, post) to appear with a reasonable color — even if not the exact oklch-computed hue
**So that** the badges are legible and identifiable, even if not pixel-perfect

#### Acceptance Criteria:

- [ ] Given I am on Chrome 109, when I view any page that renders entity type badges from `@repo/icons`, then the badge has a visible background color (not transparent or invisible)
- [ ] Given I am on Chrome 109, when I view entity badges, then the badge text is legible (sufficient contrast against the badge background)
- [ ] Given I am on Chrome 119+, when I view entity badges, then the colors are identical to today's oklch-computed values (no regression on modern browsers)
- [ ] The exact fallback strategy for JS-emitted badge colors (inline sRGB fallback vs. documented graceful degradation) is a technical decision deferred to the tech-analysis agent. This story captures the product requirement: badges must not be invisible on old browsers.

**Priority:** Medium
**Estimated Complexity:** Small

---

## 3. User Flows

### Flow 1: Old-browser visitor completes login (the BETA-44 scenario)

1. User on Chrome 109/Windows 10 navigates to `https://hospeda.com.ar/es/auth/signin/`
2. Page loads. The color-system fallbacks are in effect: the login card, input fields, and `GradientButton` render with solid sRGB colors
3. User sees the login form clearly, fills in email and password
4. User clicks the login button. The button is visually identifiable (has background color)
5. The form handler fires, Better Auth authenticates the user
6. User is redirected to their account page (normal post-login flow, unchanged)

### Flow 2: Modern-browser visitor (zero visible change)

1. User on Chrome 125 navigates to any Hospeda web page
2. Browser evaluates `@supports (color: oklch(from white l c h))` — condition is true
3. Browser uses the oklch-computed variant tokens (inside `@supports`). The sRGB fallback declarations exist in `:root` but are overridden
4. Page renders identically to the current experience. No visual change.

### Flow 3: Admin staff on old browser opens the admin panel

1. Staff member on Chrome 98 navigates to the admin panel URL
2. Browser loads the page. JavaScript feature detection runs synchronously (before full paint) and detects that the browser does not meet the minimum requirements
3. A non-dismissible (or session-dismissible — see Section 5) banner renders at the top of the page, above all admin content
4. The broken admin UI renders below the banner (broken colors, layout issues — expected)
5. Staff member reads the banner, understands the situation, clicks the "Actualizar Chrome" link
6. New tab opens at https://www.google.com/chrome/
7. If staff cannot update (IT policy), they use the support contact in the banner to report the situation

### Flow 4: Admin staff on supported browser (no gate)

1. Staff member on Chrome 118+ navigates to the admin panel
2. Feature detection confirms the browser meets requirements
3. No banner appears. Admin panel renders normally.

---

## 4. Business Rules

### Rule 1: Browser support floor — web (color rendering)

**Description:** The web app's minimum supported browser for correct color rendering is Chrome 119 (or equivalent: Safari 16.4, Firefox 128). On older browsers, the color system must degrade gracefully to solid sRGB colors rather than failing invisibly.

**Applies to:** Story 1, Story 2, all web pages

**Validation:**
- On Chrome 109: all elements using variant tokens render with a visible solid color
- On Chrome 119+: all elements using variant tokens render with the oklch-computed color
- The transition between fallback and modern color is invisible to the user (colors are visually equivalent, not dramatically different)

---

### Rule 2: Browser support floor — admin (hard gate)

**Description:** The admin panel requires Chrome 111+ (or equivalent: Safari 16.4, Firefox 128) due to the Tailwind v4 dependency. Browsers below this floor cannot be supported with color fallbacks. The product response is an informational gate, not a technical fix.

**Applies to:** Story 3, `apps/admin`

**Validation:**
- Feature detection must run before any admin content is interactive
- The gate applies to Chrome < 111, Edge < 111, Firefox < 128, Safari < 16.4
- The gate must NOT apply to any browser meeting the minimum floor

---

### Rule 3: Detection method for the admin gate

**Description:** Browser detection for the admin gate MUST use CSS feature detection (`CSS.supports()`) and/or JavaScript capability checks, NOT User-Agent string parsing. UA sniffing is brittle, spoofable, and produces false positives/negatives.

**Applies to:** Story 3

**Validation:**
- The gate implementation does not parse `navigator.userAgent` strings
- The gate fires for a headless test browser configured to NOT support the target CSS features
- The gate does NOT fire for a headless test browser configured to support the target CSS features

---

### Rule 4: i18n parity for admin gate copy

**Description:** The admin gate banner must be fully localized in all three supported locales (es, en, pt) using the project's `@repo/i18n` system. The default/fallback locale is `es` (Argentina market).

**Applies to:** Story 3

**Validation:**
- Banner copy in es, en, and pt is present in the i18n locale files
- No hardcoded strings in the banner component
- The es copy is grammatically correct Rioplatense Spanish

---

### Rule 5: Visual parity guarantee

**Description:** The sRGB fallback values for the 42 variant tokens must be derived deterministically from the canonical token values in `@repo/design-tokens`. They must not be chosen arbitrarily. The goal is that the fallback colors are the closest possible solid-color approximation to the oklch-computed result.

**Applies to:** Story 1, Story 2

**Validation:**
- Each fallback hex/rgb value is traceable to the corresponding design-token source value
- The derivation method is documented (not ad-hoc)
- Visual comparison between old-browser and modern-browser renders shows no jarring color difference (colors are recognizably the same brand palette)

---

## 5. UI/UX Requirements

### Admin Gate Banner — Placement

The banner is rendered at the very top of every admin page, above the main navigation and content. It must be visually prominent even if the admin CSS is partially broken on old browsers. It should not rely on the admin's Tailwind CSS for its own layout/colors — it should use inline styles or a minimal self-contained stylesheet so it renders correctly even when the surrounding page is broken.

### Admin Gate Banner — Dismissibility

**Recommendation: Session-dismissible (not permanently dismissible, not permanently pinned).**

Rationale:

- **Non-dismissible** is the safest choice for the user (they cannot accidentally dismiss and forget), but it is aggressively obstructive for staff who genuinely cannot update their browser (IT policy) and are stuck working with a broken admin. If they must use it daily, a permanent banner becomes an accessibility issue.
- **Session-dismissible** (dismissed via a close button, re-appears on next browser session or page reload) balances visibility with usability. Staff who cannot update are reminded on every new session, but can collapse the banner within a session to at least attempt to work. The reminder cannot be silenced permanently — the problem is never "solved" from the product's perspective until they update.
- **Permanently dismissible** (localStorage) would allow staff to suppress the banner indefinitely, which means they could forget about it and never update. This is not recommended.

**Decision for implementation:** Session-dismissible. The close button stores a flag in `sessionStorage` (not `localStorage`). Reloading the page or opening a new browser session restores the banner.

This recommendation is subject to final user approval. If the product owner decides non-dismissible is preferable (simpler, stronger nudge), the implementation is trivially simpler.

### Admin Gate Banner — Copy (proposed)

The copy below is a starting proposal. Final wording is subject to user/stakeholder review.

**es (default — Rioplatense Spanish):**
> **Tu navegador no es compatible con el panel de administración.**
> Esta herramienta requiere Chrome 111, Firefox 128, Safari 16.4 o superior. Por favor, actualizá tu navegador para continuar.
> [Descargar Chrome] · [Contactar soporte]

**en:**
> **Your browser is not compatible with the admin panel.**
> This tool requires Chrome 111, Firefox 128, Safari 16.4 or higher. Please update your browser to continue.
> [Download Chrome] · [Contact support]

**pt:**
> **Seu navegador não é compatível com o painel de administração.**
> Esta ferramenta requer Chrome 111, Firefox 128, Safari 16.4 ou superior. Atualize seu navegador para continuar.
> [Baixar Chrome] · [Contatar suporte]

The "Descargar Chrome" / "Download Chrome" / "Baixar Chrome" CTA links to `https://www.google.com/chrome/` and opens in a new tab (`target="_blank" rel="noopener noreferrer"`).

The "Contactar soporte" / "Contact support" / "Contatar suporte" CTA links to the Hospeda support contact. The exact URL/email is an open question (see Section 11).

### Accessibility Requirements

- The banner must have `role="alert"` or `role="banner"` and be announced by screen readers
- The close button (if session-dismissible) must have an accessible label (`aria-label="Cerrar aviso"` / `"Close notice"` / `"Fechar aviso"`)
- Color contrast of the banner itself must meet WCAG AA (4.5:1 for text) even on old browsers, since the banner uses self-contained styles
- The CTA links must be distinguishable from surrounding text (underline or icon, not color alone)

### Web Color Fallbacks — Visual Contract

From a product standpoint, the fallback colors must:

1. Be recognizably the same brand palette (warm orange for `--brand-accent`, blue-teal for `--brand-primary`, etc.)
2. Not produce jarring contrast issues (a semi-transparent token at 15% opacity that was previously barely visible should map to a very light solid color approximation, not a fully opaque or invisible one)
3. Work correctly in dark mode (dark-mode token overrides must be respected in the fallback layer too)

The exact hex values are a technical decision (deferred to tech-analysis). The product requirement is that the colors must be visually coherent and brand-aligned.

### Internationalization

- Admin gate banner: es/en/pt, all via `@repo/i18n` locale files
- Web color fix: no user-facing text; no i18n changes needed beyond the admin banner

---

## 6. Edge Cases & Error Handling

### Edge Case 1: Staff member genuinely cannot update their browser (IT policy)

**Condition:** Staff member's corporate IT department locks the browser version below Chrome 111. They cannot self-update.

**Expected Behavior:** The banner shows the support contact. The admin panel remains accessible (behind the banner) even in its broken state, so staff can attempt to use critical functions while waiting for IT resolution. The banner is session-dismissible so they can collapse it within a session.

**User Feedback:** Banner copy includes "Contactar soporte" CTA. The support team handles IT-policy escalation out of band.

---

### Edge Case 2: Partial oklch support (browser supports plain oklch but not relative color syntax)

**Condition:** Chrome 111-118 supports `oklch()` but NOT `oklch(from var(...) ...)`. These browsers would previously have rendered the ~286 plain `oklch()` tokens correctly but fail on the ~679 relative-color usages.

**Expected Behavior:** The `@supports (color: oklch(from white l c h))` gate correctly identifies these browsers as NOT supporting relative colors and applies the sRGB fallbacks. Plain oklch tokens (not variant-derived) remain as-is and work on these browsers. Net result: a significant improvement for Chrome 111-118 users who were previously seeing partial color breakage.

**User Feedback:** No user-facing message needed. The color rendering improves transparently.

---

### Edge Case 3: Dark mode on old browser

**Condition:** User on Chrome 109 has dark mode enabled (`data-theme="dark"` set on `<html>`).

**Expected Behavior:** The sRGB fallback tokens respect dark-mode overrides. The dark-mode variant of each base token (as defined in `@repo/design-tokens`) is used to derive the dark-mode fallback. The user should not see light-mode colors on dark backgrounds.

**User Feedback:** No user-facing message. Dark mode renders correctly with fallback colors.

---

### Edge Case 4: Admin panel loaded with a browser-spoofed UA

**Condition:** A browser that actually lacks the required CSS features presents a spoofed UA string claiming to be a modern browser.

**Expected Behavior:** Because detection uses `CSS.supports()` (capability-based), not UA parsing, the actual capabilities of the browser are detected regardless of what the UA string claims. If the features are absent, the gate fires. If they are present, the gate does not fire.

**User Feedback:** Correct behavior is transparent to the user.

---

### Edge Case 5: `@repo/icons` badge colors on old browsers

**Condition:** An old-browser user views a page with entity-type badges whose colors are computed at runtime via JavaScript template literals using `oklch(from var(--token) ...)`.

**Expected Behavior:** The badge renders with a fallback color (either a JS-computed sRGB value or a documented static color per badge type). The badge is never invisible or transparent. The exact mechanism is deferred to tech-analysis.

**User Feedback:** Badge color may differ slightly from the modern-browser experience (acceptable degradation), but the badge is always visible and legible.

---

### Edge Case 6: CI guard false positive

**Condition:** A developer legitimately adds a new variant token definition inside the designated `@supports` block, which the CI guard could flag.

**Expected Behavior:** The CI guard is scoped to detect `oklch(from` OUTSIDE the token-definition file(s). New token definitions in the correct location do not trigger the guard.

**User Feedback:** N/A (developer-facing). The CI guard documentation explains the allowed location.

---

## 7. Non-Functional Requirements

### Performance

- The sRGB fallback declarations add ~42 additional CSS custom property declarations to `:root`. At this scale this has no measurable impact on style resolution or paint time.
- The `@supports` block evaluation is a synchronous browser operation and adds negligible overhead.
- The admin gate feature detection runs synchronously at page load. It must complete within the same synchronous execution block as the initial script evaluation (no async/await patterns that could delay the banner).

### Security

- The admin gate detection mechanism must not be bypassable by manipulating `sessionStorage` to permanently suppress the banner (session-scoped dismissal only). If staff manipulate `sessionStorage` to suppress the banner on their unsupported browser, they accept the broken admin experience — this is an internal tool with no external security implications.
- No PII or sensitive data is involved in either the color fallback system or the browser gate.

### Scalability

- The 42 variant tokens cover the current 679 call-site usages. If new call-sites are added in future that require new variant combinations, the `@supports` pattern is straightforward to extend. The CI guard ensures no new inline relative-color usages bypass the token system.
- The admin gate is a one-time detection pattern. No scaling concerns.

---

## 8. Dependencies

### Internal Dependencies

- **`@repo/design-tokens`**: The canonical source of base token values. The 42 sRGB fallback values must be derived from the values defined in this package. The generator in this package is the proposed SSOT for emitting the new variant tokens.
- **`@repo/i18n`**: Admin gate banner copy (es/en/pt) goes through the project's i18n system.
- **`@repo/icons`**: The ~5 dynamic badge color computations are in this package and require a separate fallback strategy.
- **`apps/web/src/styles/`**: `components.css` (heavy relative-color usage), `global.css` (base tokens and one existing `oklch(from var(--ring) ...)` call), `css-var-themes.css` (theme overrides).
- **`apps/admin/src/styles.css`**: No CSS changes planned; the gate is a JS/HTML addition.

### External Dependencies

- None. No new third-party libraries required for either the color fallback or the admin gate.

---

## 9. Success Metrics

### Quantitative Metrics

- **Primary**: Zero reports of invisible/colorless page rendering on Chrome 109-118 after the fix ships (tracked via BETA-44 ticket closure and future Linear report volume)
- **Regression rate**: Zero visual regression reports from modern-browser users within 30 days of ship (monitored via Linear bug reports and user feedback)
- **CI guard coverage**: The CI guard catches any new `oklch(from` usage at a call site outside the designated token file on every PR (measured by guard execution in CI)
- **Test coverage**: The regression test for the token structure (non-oklch fallback in `:root` + oklch in `@supports`) must pass on every PR
- **Admin gate trigger accuracy**: The gate fires on test browsers configured below Chrome 111 and does NOT fire on browsers at or above Chrome 111 (verified by automated tests)

### Qualitative Metrics

- BETA-44 is closeable ("Marta's login works"): the issue reporter or a manual reproduction confirms login is functional on Chrome 109 (or the closest reproducible equivalent)
- The admin banner copy is clear and actionable: internal staff review confirms they understand the message and the update path
- No color-drift complaints from existing users: the web's brand identity looks the same to modern-browser users after the fix

---

## 10. Out of Scope

The following items are explicitly NOT part of this spec and will not be addressed:

- **Full Chrome <111 support for the admin panel.** The Tailwind v4 dependency makes this infeasible without a major architectural change. The admin gate is the product response.
- **`color-mix()` rework beyond the 6 toast usages.** The toasts are a localized case. If they need fallbacks, that is a future micro-fix, not part of SPEC-176.
- **`text-wrap: balance/pretty` fallback.** These properties degrade harmlessly (browsers that do not support them simply use default text wrapping). No user impact.
- **Supporting `:has()`, `@container`, or `dvh/svh` on pre-Chrome-105 browsers.** These are already below the Chrome 109 baseline being addressed and pre-date even the issue reporter's environment.
- **A visual regression testing framework (e.g., Percy, Playwright screenshot diffing) as a new CI dependency.** Parity verification uses the existing Vitest-based CSS structure tests and the CI guard. A full visual regression suite is a future SPEC.
- **Automatic browser update prompts on the web frontend.** The web site is public-facing; adding a "please update your browser" banner for Chrome 109-118 visitors (who will NOW see the site correctly) is not needed.
- **IE 11 or legacy Edge support.** These browsers are not in scope for any Hospeda surface.
- **Changing the admin's Tailwind v4 dependency or minimum browser floor.** The Chrome 111 floor is fixed by the framework choice, not by this spec.

---

## 11. Open Questions

Questions that require stakeholder input before or during implementation:

- [ ] **Admin banner support contact**: What is the correct support contact URL or email for the "Contactar soporte" CTA in the admin gate banner? (e.g., `soporte@hospeda.com.ar`, a Linear form, a WhatsApp link)
- [ ] **Banner dismissibility final decision**: Is the recommendation of "session-dismissible" approved, or does the product owner prefer non-dismissible? (See Section 5 for rationale on both options.)
- [ ] **Marta confirmation**: Has the BETA-44 reporter been contacted to confirm whether the page appeared colorless/broken, and has a real Chrome 109 reproduction been attempted? Closing BETA-44 should ideally include a real-browser verification, not just the logical inference.
- [ ] **Chrome 111-118 users**: These users currently see broken relative colors (they support plain oklch but not the relative syntax). After SPEC-176, they will see sRGB fallback colors instead of their current broken experience. Is there any product concern about the color difference for this subset, or is the fix universally acceptable?
- [ ] **`@repo/icons` fallback strategy decision**: Should the ~5 dynamic badge color JS outputs have a JS-computed sRGB fallback added, or is documented degradation (visible but slightly off-color badges) acceptable for old browsers? This is a product-level decision about acceptable degradation; the technical mechanism is deferred to tech-analysis.

---

## 12. Approval

- [ ] Product Owner approval
- [ ] Stakeholder review completed
- [ ] Technical feasibility confirmed (tech-analysis agent)
- [ ] Ready for technical analysis
