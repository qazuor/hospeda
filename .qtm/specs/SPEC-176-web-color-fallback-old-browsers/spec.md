---
specId: SPEC-176
title: Web color-system fallback for older browsers (oklch/@supports) + admin browser gate
type: fix
status: draft
created: 2026-05-30
driver: Linear BETA-44
---

# SPEC-176 — Web color-system fallback for older browsers + admin browser gate

> SEED spec written from the BETA-44 root-cause investigation. To be formalized
> (PDR / tech-analysis / tasks) by the spec agents in the SPEC-176 worktree.
> Full investigation context in engram: `worktree/linear-issues/beta-44`,
> `BETA-44 audit: real browser floor is ~Chrome 119`.

## 1. Origin & problem statement

Linear **BETA-44** (URGENT, area-auth, source-web): user "Marta" on **Chrome 109 / Windows 10**
fills the login form at `/es/auth/signin/`, presses the button, and "nothing visible happens".

### What the investigation PROVED (do not redo — start here)

- **It is NOT the JS bundle.** Built `apps/web` for production and scanned all 112 client
  chunks with esbuild: zero syntax delta between `chrome109` and `chrome111` targets, and
  no post-109 runtime APIs (`toSorted`/`toReversed`/`groupBy`/`withResolvers`/...). The
  bundle parses and runs on Chrome 109. (Detector: `/tmp/beta44-detect.mjs`, since removed —
  re-derive if needed.)
- **It is NOT the form handler.** `apps/web/src/components/auth/SignIn.client.tsx`
  (`client:load`, lines ~137-180) is sane: try/catch, `translateApiError`, `role="alert"`,
  `isLoading` set/cleared, button disabled. If the island were hydrated and something failed,
  the user WOULD see an error or spinner.
- **It is NOT View Transitions.** Web does not use `ClientRouter` / `astro:transitions`.
- **It is NOT a universal blocker.** BETA-32/33/36/42/48 show users operating logged-in →
  login works on modern browsers. Bug is **environment-specific** to old browsers.

### The real cause (leading, evidence-backed; not yet reproduced on real Chrome 109)

The web **CSS color system is built on relative color syntax** `oklch(from var(--token) ...)`,
which requires **Chrome 119+** (Oct 2024) / Safari 16.4 / Firefox 128. **~679 occurrences
across 132 files.** On Chrome 109 the entire color layer is invalid → ignored by the browser →
the page (and the login button) renders **unstyled / colorless**. The `GradientButton` loses
its background → plausibly looks like empty space. That is the strongest explanation for
"pressed and nothing happened": the click handler works, but the UI is broken/invisible.

> Open confirmation: reproduce on a real Chrome 109, OR ask Marta whether the page looked
> colorless/broken. Posted as a comment on BETA-44 on 2026-05-30.

## 2. Audit findings (web + admin, CSS + JS)

### Web CSS (the blocker)
| Feature | Usages | Min browser | Breaks 109? |
|---|---|---|---|
| `oklch(from var(...) ...)` relative color | ~679 / 132 files | Chrome 119 | YES (critical) |
| `oklch()` plain | ~286 | Chrome 111 | yes |
| `color-mix()` | 6 (toasts) | Chrome 111 | yes (localized) |
| `text-wrap: balance/pretty` | 9 | 114/117 | no (degrades harmlessly) |
| `:has()`, `@container`, `dvh/svh` | several | 105-108 | no (pre-109) |

There is ALREADY a partial fallback `@supports (background-color: oklch(from white l c h / 0.95))`
at `apps/web/src/styles/components.css:539` — generalize this pattern.

### Census of the 679 relative-color usages (key sizing data)
- **625 (92%) are ALPHA-ONLY**: `oklch(from var(--token) l c h / N)` = "the token at N opacity".
- 49 are lightness math: `calc(l * N) c h` / `calc(l - N) c h`.
- ~5 are dynamic JS template-literals (badge colors in `@repo/icons`).
- **27 distinct base tokens** (top: `--brand-primary` 256, `--brand-accent` 158,
  `--core-foreground` 78, `--destructive` 55, `--core-card` 28, `--core-muted-foreground` 24,
  `--border` 22, ...).
- **42 distinct (base × transform) pairs** → ~42 precomputed fallback tokens needed.
(Census script: `/tmp/beta44-oklch-census2.mjs` — re-derive if removed.)

### Web JS
Clean. Only `navigator.clipboard` (Chrome 98, OK). No build target set (Vite 8 default
chrome111, but JS parses fine on 109). No change needed for JS.

### Admin
Uses **Tailwind CSS v4.1.12**, which by design targets Chrome 111+/Safari 16.4+/FF 128+
(emits oklch, `color-mix`, `@custom-variant dark` at `apps/admin/src/styles.css:54`). The admin
is **fundamentally unusable on Chrome 109 and CANNOT be fallback-ed without dropping Tailwind v4.**
Admin JS is clean. Admin `vite build.target = es2020`. Admin is an internal staff tool.

### Shared
`packages/icons/src/domain/*.ts` emits inline `oklch(from var(--token) ...)` style strings at
runtime for entity badges → affects web AND admin badges → Chrome 119.

## 3. Approved approach (user decision, 2026-05-30)

Keep oklch on modern browsers; add solid-color fallbacks for old browsers. Strategy:
**Centralize the 42 variant computations into intermediate CSS custom properties**, each
defined twice: a solid sRGB fallback at `:root`, then redefined as the oklch relative
computation inside `@supports (color: oklch(from white l c h))`.

```css
:root {
  /* Fallback — valid on Chrome 109 (rgb space-syntax + slash alpha = Chrome 65+) */
  --brand-primary-a30: rgb(232 116 59 / 0.3);
}
@supports (color: oklch(from white l c h)) {
  :root {
    --brand-primary-a30: oklch(from var(--brand-primary) l c h / 0.3);
  }
}
```

Then swap the ~679 call sites from inline `oklch(from var(--brand-primary) l c h / 0.3)` to
`var(--brand-primary-a30)`.

### Why centralize (hard technical constraint)
The naive two-declaration stack at the call site (`color: #fallback; color: oklch(from var() ...)`)
**does NOT work**: per the CSS Variables spec, a `var()` that substitutes to an invalid value makes
the declaration "invalid at computed-value time" → the property falls back to `inherit`/`initial`,
NOT to the previous declaration. So `oklch()` must be removed from the call site and placed behind
a gated token. Bonus: this is a DRY win (679 inline computations → ~42 semantic tokens).

## 4. Scope

### In scope
1. **Web tokens**: ~42 centralized variant tokens (alpha + lightness) with sRGB fallback +
   `@supports` oklch override. Fallback values derived by converting each base token's oklch →
   sRGB hex (deterministic; verify against `@repo/design-tokens` source values).
2. **Web call-site swap**: replace ~679 `oklch(from ...)` usages with `var(--token)`. Mechanical;
   consider a codemod with careful alpha→token mapping.
3. **Generalize** the existing `@supports` block at `components.css:539`.
4. **`@repo/icons`**: JS fallback for the ~5 dynamic badge color cases (compute fallback inline
   style, or accept documented degradation).
5. **Admin**: browser-gate banner ("navegador no compatible, actualizá") for < Chrome 111.
   NO color fallback for admin (Tailwind v4 hard floor).
6. **Guard + tests**: CI guard script (no `oklch(from` in web call sites — only in token defs
   behind `@supports`); regression test asserting each variant token has a non-oklch fallback
   outside `@supports` and an oklch value inside it.

### Out of scope
- Full Chrome <111 support for admin (would require dropping Tailwind v4).
- `color-mix` rework beyond the toast fallback.
- `text-wrap` (degrades harmlessly).

## 5. Regression test plan (bug-fix → test first)
- A test/guard that parses the web token CSS and asserts: for every `--*-aNN` / variant token,
  a non-oklch (rgb/hex) declaration exists at `:root` AND an oklch declaration exists inside the
  `@supports` block.
- A guard script (sibling of `scripts/check-*.sh`) that fails CI if `oklch(from` appears in web
  source OUTSIDE the designated token-definition file(s).
- Optional: a built-CSS assertion that the critical login-path tokens resolve to a solid color
  when `@supports` is unsupported.

## 6. Open questions for formalization
- Exact list + naming convention of the 42 tokens (e.g., `--{base}-a{NN}`, `--{base}-l{±NN}`).
- Source of truth for fallback hex values (convert oklch tokens vs `@repo/design-tokens`).
- Codemod vs manual for the 679 call-site swaps; how to verify visual parity.
- Admin gate: detection method (UA? CSS `@supports` probe + JS?) and copy/i18n.
- Whether to also set an explicit `build.target` / browserslist for hygiene (JS already fine).

## 7. Key file pointers
- `apps/web/src/styles/global.css` — base color tokens (oklch), `oklch(from var(--ring) ...)` at :29
- `apps/web/src/styles/components.css` — heavy relative-color usage; existing `@supports` at :539
- `apps/web/src/components/auth/SignIn.client.tsx` — login island (sane; not the bug)
- `apps/web/src/pages/[lang]/auth/signin.astro` — login page (oklch decoratives)
- `packages/icons/src/domain/*.ts` — dynamic badge color strings (oklch relative)
- `apps/admin/src/styles.css` — Tailwind v4 entry + oklch theme + `@custom-variant dark`
