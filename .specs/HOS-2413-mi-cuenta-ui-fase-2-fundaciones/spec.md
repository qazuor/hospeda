---
title: Mi Cuenta UI · Phase 2 · Foundations (account shell, mobile bar, component kit, async states, save bar, locked state, CSS guards, visual regression)
linear: HOS-2413
statusSource: linear
created: 2026-11-20
type: feature
parent: HOS-2409   # epic «rediseño visual de Mi Cuenta»
children:
  - HOS-2455   # account shell: compact header, one-line footer, no mobile dock
  - HOS-2456   # mobile/tablet account bar + drawer (< 1024px)
  - HOS-2457   # Button + action link
  - HOS-2458   # flat Section with gradient top bar
  - HOS-2459   # form fields
  - HOS-2460   # StatusPill + Badge/CountPill
  - HOS-2461   # Dialog, Drawer, ConfirmDialog
  - HOS-2462   # Pagination
  - HOS-2463   # Tabs + NavTabs
  - HOS-2464   # Switch + preference row
  - HOS-2465   # PageHeader
  - HOS-2466   # async states
  - HOS-2467   # StickySaveBar + autosave chip
  - HOS-2468   # locked state
  - HOS-2469   # breakpoint allowlist + guard
  - HOS-2470   # CSS literals guard
  - HOS-2471   # visual regression, light + dark
related:
  - HOS-2454   # phase-1 app tokens (hard prerequisite, see OQ-4)
  - HOS-2410   # help center: owns the `data-help` convention this spec applies
  - HOS-2414   # phase 3: first page migrations (consumes this kit)
  - HOS-2435   # phase-1 a11y fix of the preferences switch
  - HOS-2421   # phase-1 fix: «Mis comercios» false empty on API failure
  - HOS-2422   # phase-1 fix: guest inbox false empty on API failure
  - HOS-2424   # phase-1 fix: dashboard shows 0 when stats fail
  - HOS-958    # dialog max-height + scroll (check:dialog-panel)
areas:
  - web
  - devops
umbrellaBranch: epic/HOS-2409-mi-cuenta-ui
smokeLabels:
  # The shell switch (T-029) changes the chrome of every /mi-cuenta page at once:
  # compact header, one-line footer, no dock, new sidebar, account bar below
  # 64rem. CI renders it, but only a person on staging can confirm it against
  # real accounts of every role. The kit itself is not adopted by any page yet,
  # so no billing smoke applies in this phase (LockedState is adopted in phase 3).
  - status-needs-smoke-staging
---

# Mi Cuenta UI · Phase 2 · Foundations

> Spec language is English (repo rule). Owner decisions are quoted by their
> epic id (D1…D24, HOS-2409) with a short title, so nobody has to look them up.

## 1. Summary

Phase 2 of the Mi Cuenta redesign builds the pieces every later page needs,
and no page content migrates yet:

- **Shell.** An account shell for `/mi-cuenta/*` with a compact site header, a
  one-line account footer and no mobile dock (D1 «marco compacto»).
- **Mobile navigation.** Below 64rem, one sticky bar «≡ Mi cuenta / sección» that
  opens a drawer with the sidebar groups (D3 «nav mobile única»).
- **Component kit.** One React component per piece in
  `apps/web/src/components/account/ui/`, styled with CSS Modules (D16 «un
  componente React por pieza», D17 «ubicación del kit»). The set: Button,
  Section, the form fields, StatusPill, Dialog, Drawer, ConfirmDialog,
  Pagination, Tabs, Switch, PageHeader, the async states, StickySaveBar,
  AutoSaveChip and LockedState.
- **Guards.** Two CI guards: a breakpoint allowlist (D6 «breakpoints cerrados»)
  and a CSS literals guard.
- **Visual regression.** Light and dark, desktop and mobile (D18 «modo oscuro en
  alcance»).

The approved component catalog (v5, owner 2026-11-20) is the visual source of
truth: <https://claude.ai/artifact/26HuDrHSqJJ7jtDwbnfFzq>. Where this spec and
the catalog disagree on something visual, the catalog wins. Where the catalog
proposes an implementation that conflicts with the repo, this spec says so in
§11 instead of choosing silently.

## 2. Problem

The 20/11/2026 audit (staging `b66bf18705`, 77 pages) found that the account
looks dated because it has no system, not because of any single component:

- **No app shell.** 72 of 77 pages render under `BaseLayout` with the marketing
  `Header` (653 lines), `Footer` (1,043 lines) and `MobileDock`, inside the
  1350px site container. `AccountLayout.astro` is 810 lines, over the 500-line
  limit. It has one breakpoint (`@media (max-width: 768px)`, line 742) and turns
  its toggle into a sticky bar with an `IntersectionObserver` (lines 423-441).
  On a phone up to three navigations of the same area compete (sidebar toggle,
  avatar menu, site mobile menu) plus the dock.
- **Duplicated primitives.** The audit counted 70 button recipes, 7 paginations,
  3-4 empty states, 3 switches, 45 badges and `.fieldInput` copied 10 times.
- **Tokens exist but are bypassed.** It found 790 literal font sizes (54
  values), 36 radii, 34 shadows, ~130-150 hex colors and 46 `var()` fallbacks
  that contradict their token. It also found 14 distinct viewport breakpoints
  and zero container queries.
- **Async failures render as empty or zero** (HOS-2421, HOS-2422, HOS-2424).
- **No fixed save bar and no unified locked state.** The audit found silent
  redirects, raw «Entitlement required» errors and «Plus y VIP» hardcoded in
  `AlertsList.client.tsx:284`.

Without the foundations, phases 3-5 would each re-solve these and the account
would fragment again.

## 3. Goals

- **G-1.** One kit piece = one React component in
  `apps/web/src/components/account/ui/`, CSS Modules, tokens only. Astro
  renders it without `client:*` unless it is interactive.
- **G-2.** One account shell for every page that renders through
  `AccountLayout` today (73 of 77 `.astro` files under `mi-cuenta/`). It
  follows D1 «marco compacto», D3 «nav mobile única» and D6 «breakpoints
  cerrados», and it is rolled out without breaking any of those pages (§6.6,
  OQ-1).
- **G-3.** Async regions have five explicit states (loading, error, empty,
  locked, content). A failure can never render as empty or zero.
- **G-4.** Two save models, signalled: StickySaveBar for explicit saves,
  AutoSaveChip for direct-action saves (D8 «dos modelos de guardado»).
- **G-5.** One LockedState for role, plan or permission blocks. Plan names come
  from the catalog, never from a literal (D9 «sin acceso único», D22 «prueba del
  turista preparada»).
- **G-6.** Two CI guards keep the account from re-fragmenting: the breakpoint
  allowlist and the CSS literals guard. Each runs as its own step in the CI
  `Guards` job AND in `pnpm check:guards`.
- **G-7.** Visual regression of the kit and the shell, light and dark, desktop
  and mobile, on a production build, failing CI on unapproved diffs (D18).
- **G-8.** Every kit component can carry `data-help`, and every Section must,
  per HOS-2410's convention (owner AC, 2026-11-20).

## 4. Non-goals

- **NG-1.** Migrating page content to the kit. Pages keep their old components
  until phases 3-5 (HOS-2414…2416). Phase 2 changes only the chrome around
  them (the shell).
- **NG-2.** Deleting old components (`AccountSectionCard`, `AccountButton`,
  `AccountEmptyState`, `PlanGate`-style upsells, …). They are retired in phase 5.
- **NG-3.** Editor-specific pieces (EditorSectionNav, EditorSwitcher,
  EditorHub, PhotoGrid, Repeater, OpeningHours, LocationPicker,
  TranslationTabs). They belong to phase 4 (D2 «nav del editor por container
  query»).
- **NG-4.** Data pieces the catalog lists that no phase-2 child asks for:
  Table, DataList, ListRow, InboxRow, StatCard, Avatar, Menu, Tooltip,
  ChatBubble, UpsellCard and Toast. They are built in the phase whose first
  page needs them (Toast: OQ-11).
- **NG-5.** `FocusShell` for the three focus pages (`agregar-contrasena`,
  `cambiar-contrasena`, `completar-perfil`). They keep `BaseLayout` in this
  phase; their migration belongs to phase 3.
- **NG-6.** Applying the breakpoint allowlist or the literals guard to the public
  site (OQ-9).
- **NG-7.** Promoting the kit to `components/ui/` (D17: separate issue).
- **NG-8.** New runtime dependencies. Everything is built on React, CSS Modules,
  `@repo/icons`, `@repo/i18n` and `@repo/design-tokens`. Tests use Vitest,
  testing-library and the Playwright the repo already has.

## 5. Current baseline (verified on `origin/staging` `dd2e439713`, 2026-11-20)

### 5.1 Layouts

- 77 `.astro` files under `apps/web/src/pages/[lang]/mi-cuenta/`:
  - 43 import `AccountLayout` directly;
  - 30 render through `EditorShellLayout`, `EditorSectionLayout` or
    `ListingEditorSectionLayout`, and all of them wrap `AccountLayout`
    (`EditorShellLayout.astro:30,84`);
  - 3 use `BaseLayout` directly (the focus pages, NG-5);
  - 1 (`comercio/nuevo`) uses no layout.

  **`AccountLayout` is therefore the single funnel for 73 pages.** That is
  what makes a controlled switch possible (§6.6).
- `AccountLayout.astro` (810 lines):
  - builds the nav from `getNavForSurface({ surface: 'sidebar' })` gated by
    `isVisibleByRoles` and `Astro.locals.user.roles`;
  - adds `PROVIDER_NAV_GROUP` through `placeProviderGroup` when
    `Astro.locals.user.ownsHostTradeListing`, plus discovery doors and the
    AI-assistants reveal island;
  - renders the count pills as islands (`WhatsNewCountPill`,
    `BenefitUsagesCountPill`).
- `BaseLayout.astro` (388 lines) renders `Header` → `main#main-content` →
  `Footer` → `MobileDock` (lines 252-260). It has no prop to change any of them.
  `Header.astro` (653) and `Footer.astro` (1,043) take only `locale`, and both
  are already over the 500-line limit.
- `NavSurface = 'sidebar' | 'avatar' | 'mobile'` (`config/navigation.ts:55`).
- **Session-blind guard.**
  `apps/web/test/pages/cacheable-pages-are-session-blind.guard.test.ts`
  exempts `[lang]/mi-cuenta/` with the reason «The account area IS the
  personalized surface. Never cacheable.» The guard's blind-spot 5 says it does
  not see layouts. This spec adds no new session read and does not widen that
  exemption.

### 5.2 Tokens

- **Package.** `packages/design-tokens`: themes `web-light.ts` and
  `web-dark.ts` (dark selector `[data-theme="dark"]`), primitives under
  `src/tokens/`, CSS generated to `dist/tokens.web.css`.
- **Existing contrast tests.** `account-button-contrast.test.ts`,
  `plan-comparison-contrast.test.ts` and `withdrawal-cta-contrast.test.ts` use
  the culori 8-bit WCAG pipeline. They are the model for the new tests.
- **What exists today.**
  - Color: `brand-primary`, `brand-primary-link`, `brand-accent`,
    `brand-accent-text`, `destructive-text`, `success`/`warning`/`info`,
    `border`, `input`, `ring`.
  - Radius: `radius-sm/md/lg/xl`, `radius-card: 24px`, `radius-pill`,
    `radius-button: 8px`.
  - Shadow: `shadow-card`, `shadow-card-hover`, `shadow-overlay`.
- **What is missing.** Role status tokens, focus ring, control heights, app
  typography aliases and the radius scale. HOS-2454 (phase 1, Backlog) owns
  those.
  - The catalog also uses `action-*`, `on-action-*`, `control-bg`,
    `control-border`, `nav-active-*`, `upsell-*`, `shadow-sticky` and the
    layout widths (`sidebar-w`, `form-max`, `reading-max`, `editor-nav-w`). As
    far as HOS-2454's text says, none of these are in its scope (T-001 covers
    the delta).

### 5.3 Reusable mechanisms the kit must compose, not re-implement

| Mechanism | Where | Why the kit reuses it |
|---|---|---|
| Modal primitive | `components/shared/ui/Dialog.client.tsx` + `lib/focus-trap.ts` + `hooks/useDialogHistoryBack` (HOS-310) | Portal, scroll lock on `<html>` and `<body>`, focus trap, back-button close. `scripts/check-dialog-panel.ts` (HOS-958) asserts every `<dialog>` carries `dialog-panel`/`dialog-viewport` and that the shared primitive composes them |
| Native-dialog ban | `scripts/check-no-native-dialogs.ts` (HOS-957) | ConfirmDialog replaces `confirm()` and must pass this guard |
| Confirmation helper | `lib/forms/show-confirmation-dialog.tsx` | The existing imperative confirm: `useConfirm()` builds on it or replaces it, never duplicates it |
| Unsaved-changes guard | `lib/forms/use-unsaved-changes-guard.ts` + `leave-warning-registry.ts` (HOS-373, HOS-1018) | One capture-phase listener per page. It handles Astro `ClientRouter` soft navigation correctly; `astro:before-preparation` does not. StickySaveBar must register through it |
| Invalid-field focus | `lib/forms/focus-first-invalid-field.ts`, `field-errors.ts`, `build-field-id.ts` | Field and StickySaveBar's «Ir al primer error» use these |
| Plan gate data | `hooks/useListingPlanGate.ts` (`open` / `preTrial` / `plan`) + `lib/billing/*` catalog readers | LockedState is presentational. The caller resolves the reason from these sources |
| Loading convention | `apps/web/docs/loading-states.md` (SPEC-228) + `scripts/check-web-loading-patterns.sh` | The account Skeleton has to be documented there as the account-area pattern |

### 5.4 Guards and visual tooling

- **Model guard.** `apps/web/scripts/check-css-relative-colors.cjs`: a
  count-pinned per-file allowlist that fails on new occurrences AND on stale
  entries, and strips comments and `@supports` before scanning. It runs through
  `apps/web` `lint`, **not** through the CI `Guards` job nor `check:guards`.
  The new guards follow its algorithm but are wired like the root guards.
- **Root guards.** They live in `scripts/*.ts` (run with `tsx`), with tests in
  `scripts/__tests__/`. Each one has a `check:*` script in the root
  `package.json`, chained into `check:guards`, and a step in the `guards` job
  of `.github/workflows/ci.yml` (line 244 on).
- **Visual tooling.**
  - `apps/web/playwright-visual.config.ts` + `tests/visual-snapshots/` (SPEC-153)
    exist. They use `toHaveScreenshot` and a theme switch via
    `localStorage.theme`, start `astro dev`, commit no baselines (`.gitkeep`)
    and are not in CI.
  - `apps/e2e` (Playwright `^1.65`) runs in `e2e-pr.yml` on PRs to
    `staging`/`main`/`epic/**`. It builds the three apps for production, migrates
    and seeds a DB, and runs `@p0`.
  - `@playwright/test` is already a dependency of `apps/web` and `apps/e2e`.
- **Environment finding (HOS-2409).** Astro 7.4.7 breaks island hydration under
  `astro dev`. Visual regression must run on a production build.

## 6. Proposed design

### 6.1 Kit layout and conventions

```text
apps/web/src/components/account/ui/
  Button.tsx + Button.module.css          (+ LinkButton, TextLink in their own files)
  Section.tsx + Section.module.css
  Field.tsx, TextInput.tsx, InputGroup.tsx, PhoneField.tsx, Select.tsx,
  Textarea.tsx, Checkbox.tsx, Radio.tsx   (each + .module.css)
  StatusPill.tsx, CountPill.tsx, status-tone.ts
  Dialog.tsx, Drawer.tsx, ConfirmDialog.tsx, use-confirm.ts
  Pagination.tsx, Tabs.tsx, NavTabs.tsx, Switch.tsx, SwitchRow.tsx
  PageHeader.tsx
  Skeleton.tsx, EmptyState.tsx, ErrorState.tsx, Alert.tsx, AsyncRegion.tsx
  StickySaveBar.tsx, use-save-bar.ts, AutoSaveChip.tsx
  LockedState.tsx
  AccountSidebar.tsx, AccountBar.tsx, AccountFooter.tsx
  help-anchor.ts                           (HelpAnchor type + helpAttr())
  index.ts                                 (named re-exports only)
  README.md                                (kit rules, link to the catalog)
```

- **Repo rules.** Named exports only; RO-RO props objects with `readonly`
  fields; JSDoc on every export; strict TS with no `any`; `import type` for
  types; max 500 lines per file (split before reaching it).
- **Text.** All copy goes through `@repo/i18n`, in a new `account.ui.*`
  namespace in `packages/i18n/src/locales/{es,en,pt}/account.json`. The kit
  never hardcodes a string, not even an `aria-label` or a `t()` inline fallback
  (D23 «fallbacks inline fuera de la épica» is about existing calls; new code
  adds none).
- **Icons.** They come only from `@repo/icons`. The catalog's `mc-i-*` masks are
  approximations and are not ported.
- **CSS.** CSS Modules colocated; tokens only (`var(--…)`, no literal
  font-size, radius, shadow or color). Page-layout media queries use only
  30/48/64/80rem `min-width`. Components respond to their container through
  `@container`. Both rules are enforced by the T-025/T-026 guards.
- **Hydration.** Non-interactive pieces render from Astro with no `client:*`
  (React is already loaded site-wide by `BaseLayout`, D16). Interactive pieces
  (Dialog, Drawer, ConfirmDialog, client-mode Tabs, Switch, StickySaveBar,
  AutoSaveChip retry, AccountBar, `loadMore` Pagination) are used either inside
  an existing island or with the least eager directive that works
  (`client:idle`, `client:visible`, or `client:media` for AccountBar).
- **Tests.** They live in `apps/web/test/components/account/ui/<Name>.test.tsx`
  (Vitest + `@testing-library/react` + `user-event`, AAA). Keyboard behaviour
  is tested with `user-event`, never by calling handlers directly.

### 6.2 `data-help` (owner AC, HOS-2410 convention)

- `help-anchor.ts` exports:

  ```ts
  type HelpAnchor =
    | `section:${string}.${string}`
    | `section:${string}.${string}#${string}`;
  function helpAttr(input: { readonly helpId?: HelpAnchor }): { readonly 'data-help'?: HelpAnchor };
  ```

- **Section** requires `helpId` in its props type, so a Section without one does
  not compile. Every other kit component takes an optional `helpId` and renders
  it as `data-help` on its root, which covers the highlighted controls
  (`section:venue.carta#save-disabled`).
- **What the kit validates.** It checks only the SHAPE (regex test). Whether an
  anchor resolves to an article is HOS-2410's guard (its `docs/screenshots.md`
  §2 adds a unit test listing every `data-help` value in `apps/web/src`).
  When `packages/help` lands, `HelpAnchor` is re-exported from there and the
  local type is deleted.
- **One known difference.** HOS-2410's `screenshots.md` §2 says attributes go
  «only where a shot or a «?» button needs them». The owner AC on the epic
  (2026-11-20) is stricter for sections, and this spec follows the owner. That
  costs nothing at runtime.

### 6.3 Tokens (T-001)

Tokens live only in `packages/design-tokens`.

- **What phase 2 adds.** Only the delta HOS-2454 does not cover, with the
  catalog's names and values:
  - action tokens: `action-primary`, `action-primary-hover`,
    `on-action-primary`, `action-accent`, `action-accent-hover`,
    `on-action-accent`, `action-danger`, `on-action-danger`;
  - control and navigation tokens: `control-bg`, `control-border`,
    `nav-active-bg`, `nav-active-fg`;
  - upsell tokens: `upsell-bg`, `upsell-fg`, `upsell-border`;
  - shadow: `shadow-sticky`;
  - layout widths: `sidebar-w` 240px, `editor-nav-w` 224px, `form-max` 720px,
    `reading-max` 640px;
  - documentation-only constants for `bp-sm/md/lg/xl` and `cq-editor-nav`.
- **Why the breakpoint constants are documentation only.** Custom properties
  cannot be used inside `@media`/`@container` preludes. The guard (§6.7)
  enforces the literal values, and the TS export lets tests and `matchMedia`
  callers import the same numbers.
- **D4 «color de acción», as adjusted by the owner on 2026-11-20 (binding).**
  - `action-primary` is an exact alias of `brand-primary`, and `action-accent`
    an exact alias of `brand-accent`, in both themes.
  - `on-action-primary` and `on-action-accent` are white.
  - No darker action token is added. White on these colors misses WCAG AA.
  - The catalog states 3.56:1 (light) and 2.93:1 (dark) for blue, and 2.82:1
    and 2.62:1 for orange. The owner's comment says 2.7:1 for orange in light.
  - The test computes the real ratios from the repo's theme values, pins them
    as `OWNER_ACCEPTED_D4` with a comment citing the decision, and fails if
    either alias drifts or the ratio drops below the pinned value. A palette
    change therefore forces someone to revisit the decision instead of silently
    worsening it.
  - Every other text and control pair must pass AA (4.5:1 text, 3:1 non-text):
    link, secondary, ghost, status pairs, `control-border` on card,
    `focus-ring` on card/muted/popover, upsell pair.

### 6.4 Component contracts (summary; full per-task detail in `docs/tasks.md`)

| Piece | Key props (RO-RO) | Behaviour that tests pin |
|---|---|---|
| Button / LinkButton | `variant: primary\|secondary\|ghost\|quiet\|danger\|danger-ghost\|accent`, `size: sm\|md\|lg`, `loading`, `icon`, `iconOnly` (type requires `aria-label`), `block`, `as: 'a'` + `href` | `loading` → `aria-busy`, width kept, no double submit; `accent` documented for upsell/sumarse only; focus ring token |
| TextLink | `variant: default\|quiet\|muted`, `external` | never `brand-primary` as text; external adds icon, `rel="noopener"` and a hidden «(se abre en otra pestaña)» |
| Section | `title`, `helpId` (required), `description?`, `headingLevel?: 2\|3`, `actions?`, `footer?`, `variant?: default\|danger`, `flush?` | `<section aria-labelledby>`; flat (12px radius, 1px border, no shadow, no hover); 3px gradient top bar `brand-primary → brand-accent` at .65 on EVERY variant (D5 «secciones planas con barra degradé»); nesting refused (§6.5) |
| Field | `label`, `hint?`, `error?`, `required?`, `optional?`, `id?`, render-prop `children({ id, describedBy, invalid })` | label always visible; `aria-describedby` → hint + error; error = icon + text; `aria-invalid` |
| TextInput / InputGroup / PhoneField / Select / Textarea / Checkbox / Radio | per the catalog | 44px tall, 16px text, `control-border` ≥ 3:1; Textarea counter announces at 90% and 100% only; native `<select>`, checkbox and radio inside `<fieldset>/<legend>` |
| StatusPill / CountPill | `status`+`domain` or `tone`+`children`; CountPill `count`, `max`, `label` | always a word, never color alone; tone from `status-tone.ts` per domain (the catalog's table) |
| Dialog / Drawer / ConfirmDialog | `open`, `onOpenChange`, `title`, …; Drawer `side: bottom\|right`; ConfirmDialog via `useConfirm()` | focus trap, Escape, focus return, max-height + inner scroll (`dialog-panel`), back button closes; ConfirmDialog `role="alertdialog"`, initial focus on Cancel |
| Pagination | `variant: numbered\|prevNext\|loadMore`, `page`, `pageCount?`, `hrefFor?` or `onPageChange`, `onLoadMore?` | `<nav aria-label>` translated; `aria-current="page"`; first/last/disabled; loadMore announces and moves focus to the first new item |
| Tabs / NavTabs | `items`, `value`, `onChange?`, `variant: underline\|segmented`, `ariaLabel` | WAI-ARIA tabs (arrows, Home/End, roving tabindex); NavTabs = links with `aria-current`; horizontal scroll without page overflow |
| Switch / SwitchRow | `checked`, `onCheckedChange`, `disabled`; Row `label`, `description`, `saving?`, `error?`, `locked?` | `role="switch"` + `aria-checked`, visible focus, name via `aria-labelledby`, saving/error states |
| PageHeader | `title`, `description?`, `breadcrumbs?`, `back?: {label, href}`, `status?`, `actions?`, `tabs?` | the page's only `h1`; back is a real labelled link; one primary action, full-width below 30rem |
| Skeleton / EmptyState / ErrorState / Alert / AsyncRegion | §6.8 | failure never renders as empty or zero |
| StickySaveBar / AutoSaveChip | §6.9 | §6.9 |
| LockedState | §6.10 | §6.10 |

### 6.5 Section nesting (D5 «nunca una caja dentro de otra»)

React context alone is not enough. Astro slots do not carry context across
separate non-hydrated React roots, so `<Section>` in a page that slots another
component rendering `<Section>` would pass a context check. Two layers:

1. **Render time.** `Section` reads a `SectionDepthContext`. Nested inside
   another Section in the same React tree, it throws `KitNestingError` in
   development and tests. In production it logs through `@repo/logger` and
   renders its children without the box, so a page never breaks.
2. **DOM.** Every Section root carries `data-kit-section`. The structural e2e
   sweep (T-029) asserts `[data-kit-section] [data-kit-section]` matches
   nothing on every account route. That check sees what context cannot.

### 6.6 Shell and rollout (T-014…T-019, T-029; decision in OQ-1)

- **`AccountShell.astro`** (new layout, OQ-2) composes:
  - `BaseLayout chrome="account"` (new prop, default `'site'`). It renders
    `AccountHeader` instead of `Header`, `AccountFooter` instead of `Footer`,
    and **no** `MobileDock`. `Header.astro` and `Footer.astro` do not grow:
    both already exceed 500 lines, so the compact header is a new
    `AccountHeader.astro`. It reuses the existing logo, user menu and site-menu
    islands, and keeps access to the site menu with the curated entries (D3).
  - `AccountSidebar` (React, no hydration; `<details>/<summary>` groups) from
    64rem up, sticky, `sidebar-w`.
  - `AccountBar` + AccountDrawer (React, `client:media="(max-width: 63.99rem)"`)
    below 64rem. The bar is 48px and sticky under the 56px compact header.
  - The content column is `<main id="main-content">` with
    `container-type: inline-size; container-name: account-content` and a
    template: `list`, `form` (max `form-max`, left-aligned), `dashboard`,
    `reading` (max `reading-max`) or `editor`.
  - A «Ir al contenido» skip link stays.
- **Nav model.** The nav data logic leaves `AccountLayout.astro` and moves into
  `lib/account-nav-model.ts`. That covers the groups, role gating, the provider
  group, discovery doors, the AI-assistants item and the active-section
  overrides. It is a pure function over `{ roles, ownsHostTradeListing,
  mcpEnabled, activeSection }`, unit-tested. The sidebar and the drawer consume
  the same model (one source, D3 «same groups as the sidebar»). Session reads
  stay exactly where they are today: the layout frontmatter. Per-user counts
  stay islands.
- **Rollout (recommended, OQ-1 option C, "short-lived switch").**
  `AccountLayout` gains `shell?: 'legacy' | 'account'`.
  - PR-3 lands the new shell with the default `'legacy'`, so no production page
    changes. The kit gallery (T-027) and the shell's own tests render
    `'account'`.
  - PR-5 (T-029) flips the default to `'account'` for all 73 pages at once.
    The same PR adds the structural sweep over every account route and the
    page baselines, and deletes the legacy markup and CSS from
    `AccountLayout.astro`, which leaves it as a thin delegating wrapper well
    under 500 lines.
  - The prop is gone before phase 2 closes. The two shells never coexist into
    phase 3.

### 6.7 Guards (T-025, T-026)

Both guards share `scripts/lib/account-css-scope.ts`, which defines the ACCOUNT
SURFACE:

- `apps/web/src/components/account/**`;
- `apps/web/src/layouts/{Account*,Editor*,ListingEditor*}.astro`;
- `apps/web/src/pages/[lang]/mi-cuenta/**`;
- every component directory the account pages import from. That list is
  resolved once at implementation by tracing the imports of
  `pages/[lang]/mi-cuenta/**` and the account layouts, frozen in the scope
  module and documented in its header.

Inside the scope:

- **Strict zone.** `components/account/ui/**`, `AccountShell.astro` and
  `AccountHeader.astro`: zero tolerance. The guard refuses any allowlist entry
  under these paths.
- **Legacy zone.** The rest of the scope: count-pinned per file and per rule.
  Counts may only go down; a stale entry fails, exactly as in
  `check-css-relative-colors.cjs`. The initial counts are generated once by a
  `--print-baseline` flag and committed.

Both guards:

- scan `.css`, `.astro` (`<style>` and `style=`) and `.tsx`/`.ts` (`style={{…}}`
  objects, `matchMedia(...)`, `client:media`). They strip comments and
  `@supports` conditions first;
- carry a header with WHAT THEY DO NOT SEE (computed styles, values built at
  runtime, CSS-in-JS from a variable, files outside the scope). That is the
  repo convention: «read a guard's header before trusting its green»;
- have a non-vacuity test over synthetic sources in `scripts/__tests__/`. It
  requires every rule to flag its violation and the strict zone to reject an
  allowlist entry;
- are wired three ways: a root `package.json` script, a link in
  `check:guards`, and **their own step** in the `guards` job of `ci.yml`.

| Guard | Rule | Allowed |
|---|---|---|
| `check:account-breakpoints` (HOS-2469) | width features in `@media`, `matchMedia`, `client:media` | `(min-width: 30rem\|48rem\|64rem\|80rem)` and the range form `(width >= …)`. The `client:media` / `matchMedia` complement `(max-width: 63.99rem)` is allowed only for the four values. Non-width features are free (`prefers-*`, `hover`, `pointer`, `forced-colors`, `print`). `@container` is free in value but must use `rem` |
| `check:account-css-literals` (HOS-2470) | `font-size`/`font` size, `border-radius` + longhands, `box-shadow`, any color literal (`#hex`, `rgb[a]()`, `hsl[a]()`, `oklch()`, `oklab()`, named colors except `transparent`/`currentColor`), including literal `var()` fallbacks | `var(--token)` from `@repo/design-tokens`, `inherit`, `0`, `none`, `50%` (radius), `1em`/`100%` (font-size). Defining a component-local custom property with a literal color counts as a violation |

### 6.8 Async regions (T-020, T-021)

- **Skeleton.** `text`, `title`, `circle` and `block` variants, plus
  `Skeleton.Row` and `Skeleton.Stat`. The container sets `aria-busy` and a
  hidden «Cargando…». It stays static under `prefers-reduced-motion`.
- **EmptyState.** `default` and `compact`, an `h3`, and an optional next action.
- **ErrorState.** `block` and `inline` variants; `inline` renders through
  `Alert tone="danger"`. It uses `role="alert"`, translated copy and a
  «Reintentar» button. Focus returns after the retry. It never shows raw API
  text.
- **Alert.** `info`, `success`, `warning` and `danger` tones; the `banner`
  variant is optional. It is built here because ErrorState needs it (OQ-11).
- **`AsyncRegion`.** This is the spec's reading of «ResultState» (OQ-10). It is
  a renderer over a discriminated union:

  ```ts
  type AsyncResult<T> =
    | { status: 'loading' }
    | { status: 'error'; retry: () => void }
    | { status: 'empty' }
    | { status: 'locked'; reason: LockReason }
    | { status: 'ready'; data: T };
  ```

  Each state needs its own render prop, so a caller cannot map `error` to the
  empty view. A StatCard-style consumer shows «—» + Reintentar, never `0`. A
  regression test reproduces the HOS-2421/2422/2424 shape: a rejected fetch
  renders ErrorState, not EmptyState and not 0.

### 6.9 Save models (T-022, T-023; D8 «dos modelos de guardado»)

- **`useSaveBar({ isDirty, onSave, onDiscard, errorCount, onJumpToError })`**
  composes `useUnsavedChangesGuard`. It never adds its own `beforeunload` or
  click listener, so the leave-warning registry stays the single owner (HOS-1018).
- **StickySaveBar.**
  - It is hidden while clean.
  - When dirty it shows «● Cambios sin guardar · Descartar · Guardar», then
    passes through `saving`, `saved` and `error` with «Ir al primer error»
    (`focus-first-invalid-field`).
  - It is a named `region` and announces state changes (`status`, or `alert`
    for errors). Ctrl/Cmd+S saves.
  - Desktop: sticky at the bottom of the content column. Mobile: fixed, full
    width, safe-area aware, 44px buttons.
  - It reserves its own height at the end of the form, so the last field is
    never covered (test: the spacer exists only while the bar is visible).
- **AutoSaveChip.** «✓ Se guarda automáticamente · 14:02» with `saved`,
  `saving` and `error` states («No se guardó · Reintentar»). It uses
  `role="status"` (`alert` on error) and formats the time as es-AR 24h through
  `@repo/i18n` formatting. The kit README documents that the two models never
  share a Section.

### 6.10 LockedState (T-024; D9 «sin acceso único», D22 «prueba del turista»)

- **Props.**
  - `feature: { title, description, icon? }`;
  - `reason: { kind: 'plan'; plans: readonly PlanRef[]; current?: PlanRef } | { kind: 'role'; role } | { kind: 'permission' }`;
  - `primaryAction?`, `secondaryAction?`, `size?`, `helpId?`.
- **Where plan names come from.** `PlanRef` carries the display name the CALLER
  read from the plan catalog. The component never maps a slug to a name, and no
  plan name, price or limit literal appears in the kit. The existing
  `check:commercial-values` (G7) plus a kit test with a fixture catalog prove it.
- **Actions.**
  - Plan reason: «Ver planes» uses `accent`; «Empezar prueba» renders only when
    the caller passes it. That is the D22 hook. Phase 2 does not decide trial
    eligibility; `useListingPlanGate`'s `preTrial` answer is the expected
    source.
  - Role reason: «Sumar mi local»-style `accent`.
  - Permission reason: no button; a link to whoever can grant it.
- **Never:** a redirect, a raw error, or active controls on the blocked feature.
  The test renders each reason and asserts no enabled form control exists
  inside.
- **Billing note.** No page adopts it in phase 2. Adoption on plan pages
  (phase 3) requires the staging billing smoke.

### 6.11 Visual regression (T-027, T-028, T-029; tool in OQ-5)

- **Recommended tool.** Playwright `toHaveScreenshot` inside `apps/e2e`. It is
  already a dependency, already builds production apps with a seeded DB and auth
  fixtures, and `e2e-pr.yml` already runs on `epic/**`. No new dependency.
- **Specs.** `apps/e2e/tests/visual/*.visual.spec.ts`, tagged `@visual`, run as
  their own step in `e2e-pr.yml`. The matrix is light + dark (theme set through
  `localStorage.theme` + reload, as SPEC-153 does) × desktop 1280 + mobile 375.
  Chromium only, `animations: 'disabled'`, `caret: 'hide'`, fonts awaited.
- **Kit baselines.** One shot per component state on the kit gallery (T-027).
- **Shell and page baselines.** The new shell on a representative set: the
  dashboard, `editar`, `preferencias`, `favoritos`, the accommodation list and
  one editor section. Every migrated page adds its own baselines in phases 3-5
  (HOS-2471 AC «por página migrada»).
- **Structural sweep.** Over ALL account routes, without pixels: no horizontal
  overflow at 375/768/1280, no `MobileDock`, exactly one `h1`, no nested
  `[data-kit-section]`, AccountBar visible below 64rem and sidebar from 64rem.
- **Approving a change.** The baselines are regenerated inside the pinned
  Playwright image (same version as `@playwright/test`), never on a developer's
  host fonts. The PNG diff is reviewed in the PR. CI never updates baselines on
  its own. Documented in `apps/e2e/README.md` (OQ-7).

## 7. Data model / contracts

- **No DB, API, schema or migration changes.**
- **New i18n namespace** `account.ui.*` (es, en, pt). `check:i18n-keys` covers
  it.
- **New tokens** (§6.3) in `packages/design-tokens`. The CSS regenerates through
  the package build. The `seed/web-baseline.json` round-trip validation must be
  updated for the added tokens only.
- **Possible new env var** for the kit gallery gate (OQ-6). If chosen, it
  follows the 5-step env workflow (registry, Zod, `.env.example`, docs). The
  agent then stops and asks the owner to set it in Coolify; the recommended
  default is «off», so production needs no value.

## 8. UX / UI behavior

The catalog is binding for visuals: tokens, sizes, copy tone (rioplatense
voseo, sentence case, verb + object buttons) and states. Key behaviours:

- **≥ 64rem.** Compact header (56px), sticky sidebar (240px) and content column
  by template, then the one-line footer.
- **< 64rem.** Compact header, then the sticky AccountBar «≡ Mi cuenta /
  <sección>», then content. The bar opens a bottom-sheet drawer with the same
  groups. No dock.
- **Locked nav items.** They stay visible with a lock and stay navigable to a
  LockedState (D9). They are never hidden in silence.
- **One primary action per view.** It goes full width on mobile.
- **Focus.** Single 2px `focus-ring` outline with a 2px offset, everywhere.

## 9. Acceptance criteria

- **AC-1.** Every kit piece in §6.1 exists as one React component (+ CSS
  Module) in `apps/web/src/components/account/ui/` and is exported by name from
  `index.ts`. None imports Tailwind, inline SVG or `phosphor-react`.
- **AC-2.** Every kit piece has Vitest + testing-library tests (AAA) covering
  its variants, keyboard behaviour where interactive, a11y attributes and
  `data-help`. `Section` without `helpId` fails `tsc`.
- **AC-3.** The D4 aliases and their accepted ratios are pinned in a
  design-tokens test citing the owner decision. Every other §6.3 pair passes
  AA in light and dark.
- **AC-4.** `pnpm check:account-breakpoints` and `pnpm check:account-css-literals`:
  - exist;
  - run as their own steps in the CI `Guards` job and in `pnpm check:guards`;
  - pass on the kit with zero allowlist entries in the strict zone;
  - fail on each synthetic violation in their tests.
- **AC-5.** After T-029, every account route renders inside `AccountShell` with
  no `MobileDock`. The shell meets D1 «marco compacto» (compact header,
  one-line footer) and D3 «nav mobile única» (AccountBar + drawer below 64rem,
  focus trapped, Escape closes, focus returns). The structural sweep passes on
  all routes.
- **AC-6.** Visual regression of the kit and the representative pages, in
  light and dark, desktop and mobile, runs in CI on the production build and
  fails on an unapproved diff. The approval procedure is documented.
- **AC-7.** No account page content migrated to the kit (HOS-2413 «ninguna
  página migra hasta que el kit esté aprobado»). The only page-visible change
  is the shell.
- **AC-8.** No new session read in `src/pages`, the session-blind guard is
  untouched, every new file stays at or below 500 lines, and
  `AccountLayout.astro` ends below 500 lines.
- **AC-9.** No new runtime or dev dependency, unless the owner approves one
  through §11.

## 10. Risks

- **R-1.** The shell switch shifts every page's content width (the 1350px site
  container is replaced by a column next to a 240px sidebar). Pages with
  viewport media queries may reflow. Mitigation: the structural sweep at three
  widths plus baselines on the representative set before the flip; the flip is
  one revertible commit.
- **R-2.** HOS-2454 (phase 1) is not merged when PR-1 is ready (OQ-4).
- **R-3.** Screenshot flakiness: fonts, lazy images, time-based copy. Mitigation:
  wait for `document.fonts.ready`, use seeded deterministic data, a fixed clock
  for AutoSaveChip states, and mask dynamic regions.
- **R-4.** `AccountHeader` and `Header` drift apart. Mitigation: both compose the
  same sub-components (logo, user menu, site menu). AccountHeader adds no copy
  of their logic.
- **R-5.** The literals guard's legacy baseline is large (~1,000 entries).
  Mitigation: it is generated, never hand-written, and counts only go down.
- **R-6.** The section `data-help` slugs must match HOS-2410's catalog. A
  mismatch is caught by HOS-2410's resolver test once both are merged. Slugs
  are introduced by pages (phase 3+), not by the kit.
- **R-7.** `e2e-pr.yml` gets slower with the visual step. Mitigation: its own
  step; the kit gallery is one page; the page set is small. The run time is
  measured in PR-5 and reported on the PR.

## 11. Open questions (each with a recommended option)

Each needs an owner answer before the PR it gates. The recommended option is
listed first.

- **OQ-1 · How the shell switch is rolled out** (gates PR-3/PR-5).
  - **C — short-lived switch inside `AccountLayout` (recommended).** The new
    shell lands behind `shell` (default legacy) in PR-3. PR-5 flips it for all
    73 pages, with the sweep and baselines, and deletes the legacy path.
    - *Pros:* reviewable in steps, the flip is one revertible commit proven by
      CI, and the two shells never coexist past phase 2.
    - *Cons:* about two weeks of a dormant code path.
  - **A — all at once in PR-3.**
    - *Pros:* simplest.
    - *Cons:* the flip lands before the visual regression that would catch it.
  - **B — per-page opt-in through phases 3-5.**
    - *Pros:* lowest blast radius per PR.
    - *Cons:* two shells and two navs live for 3+ months, the 810-line layout
      survives until phase 5, and it contradicts HOS-2455's AC «todas las
      páginas usan el shell nuevo».
- **OQ-2 · What `AccountShell` is.** The catalog names `AccountShell.tsx`.
  - **Astro layout composing React kit pieces (recommended).** The shell needs
    `BaseLayout`'s head, SEO, `ClientRouter` and named slots, plus server-side
    nav gating. Wrapping a whole page in a React root makes every island a
    slotted child of a non-hydrated root for no gain. Sidebar, AccountBar,
    footer and PageHeader stay React (D16).
  - **Alternative:** a React shell as in the catalog.
- **OQ-3 · How Dialog and Drawer are built.** The catalog says native `<dialog>`
  with `showModal()`.
  - **Compose the existing `shared/ui/Dialog.client.tsx` mechanisms
    (recommended):** focus trap, scroll lock, back-button close (HOS-310) and
    the `dialog-panel` classes `check:dialog-panel` enforces. The visual layer
    (popover, `shadow-overlay`, scrim, sizes) is the catalog's.
  - **Alternative:** new native-`<dialog>` primitives, which must re-prove all
    of that and get added to the HOS-958 guard.
- **OQ-4 · The HOS-2454 tokens dependency.**
  - **Hard prerequisite (recommended).** PR-1 opens only after HOS-2454 is in
    the epic branch, and T-001 adds only the delta. T-002…T-006 can be written
    meanwhile.
  - **Alternative:** phase 2 absorbs HOS-2454. One fewer PR, but it mixes
    phase-1 scope into a phase-2 PR.
- **OQ-5 · Visual regression tool and location.**
  - **`apps/e2e` with `@visual` specs, run as their own step in `e2e-pr.yml`
    (recommended).** It already builds production apps, seeds a DB and has auth
    fixtures.
  - **Alternative:** revive `apps/web/playwright-visual.config.ts` (SPEC-153),
    switch it from `astro dev` to `astro build && astro preview`, and add a CI
    job. Account pages need auth and a seeded API there, which that config does
    not have.
  - **Either way:** no new dependency.
- **OQ-6 · How the kit gallery route is gated.** The page renders every kit
  state for visual regression.
  - **`/[lang]/mi-cuenta/kit/`, answering 404 unless a server env flag (for
    example `HOSPEDA_ACCOUNT_KIT_GALLERY=true`) is set (recommended).** The flag
    is set only in the E2E env and locally; off by default, so production needs
    no value.
  - **Alternative:** gate it by a staff permission. That ships a real page to
    production.
  - **Rejected:** a Storybook-like tool, which adds a dependency.
- **OQ-7 · How baselines are approved.**
  - **Regenerate inside the pinned `mcr.microsoft.com/playwright` image and
    commit the PNGs (recommended).** The reviewer looks at the diff; CI never
    updates baselines.
  - **Alternative:** a `workflow_dispatch` job that regenerates and uploads them
    as an artifact. More moving parts.
- **OQ-8 · When the guards land.** The suggested grouping puts the guards last
  (PR-5).
  - **Move T-025/T-026 into PR-1 (recommended).** They are cheap and the strict
    zone then protects the kit from its first component.
  - **Alternative:** keep them in PR-5 and fix whatever the kit accumulated.
- **OQ-9 · Guard scope.**
  - **The account surface only (recommended).** It matches D6 «breakpoints
    cerrados» and HOS-2470 («CSS de cuenta»).
  - **Alternative:** all of `apps/web`. That multiplies the legacy baseline and
    touches the public site, which the epic does not redesign.
- **OQ-10 · What «ResultState» (HOS-2466) means.** The catalog has no such
  piece.
  - **Read it as `AsyncRegion`, the five-state renderer (recommended).**
  - **Alternative:** a post-action «result» screen (success or failure after a
    flow). If that is what was meant, it is a separate piece for the phase that
    needs it.
- **OQ-11 · Alert and Toast.** Both are in the catalog but in no phase-2 child.
  - **Build Alert now and defer Toast (recommended).** ErrorState's inline
    variant is an Alert. Toast waits for the first page that needs it; the
    Switch error path uses SwitchRow's own error state plus AutoSaveChip.
  - **Alternative:** build Toast too, with no consumer to prove it.

## 12. Implementation notes

### 12.1 Task list and PR plan

There is one task or more per child issue; detail lives in `docs/tasks.md`.
All PRs target the umbrella branch `epic/HOS-2409-mi-cuenta-ui`, **never
`staging`**. No more than 2 PRs are open at once (epic organization comment).
No PR carries a Linear magic word; the phase closes through the epic's own
promotion PR. Titles use `[HOS-2413] <type>(web): …`.

| PR | Scope | Tasks | Children |
|---|---|---|---|
| PR-1 | tokens + kit scaffold + Button/Section/fields | T-001…T-006 (+ T-025/T-026 if OQ-8 = PR-1) | 2457, 2458, 2459 (+ the delta to 2454) |
| PR-2 | status + overlays + navigation primitives | T-007…T-013 | 2460, 2461, 2462, 2463, 2464 |
| PR-3 | shell behind the switch + mobile bar + PageHeader | T-014…T-019 | 2455, 2456, 2465 |
| PR-4 | async states + save models + locked state | T-020…T-024 | 2466, 2467, 2468 |
| PR-5 | guards + kit gallery + visual regression + shell flip + docs | T-025…T-030 | 2469, 2470, 2471, 2455 |

| Task | Title | Child | Depends on |
|---|---|---|---|
| T-001 | Kit token delta + D4 owner-decision contrast test | 2457/2458/2460 (2454 prerequisite) | HOS-2454 |
| T-002 | Kit scaffold, `HelpAnchor`, `account.ui` i18n namespace, kit README | 2413 | — |
| T-003 | Button, LinkButton, TextLink | 2457 | T-001, T-002 |
| T-004 | Section with gradient bar + nesting refusal | 2458 | T-001, T-002 |
| T-005 | Field, TextInput, InputGroup, PhoneField | 2459 | T-001, T-002 |
| T-006 | Select, Textarea (counter), Checkbox(Group), Radio(Group/OptionCard) | 2459 | T-005 |
| T-007 | StatusPill, CountPill, `status-tone.ts` | 2460 | T-001, T-002 |
| T-008 | Dialog | 2461 | T-003 |
| T-009 | Drawer (bottom / right) | 2461 | T-008 |
| T-010 | ConfirmDialog + `useConfirm()` | 2461 | T-008, T-003 |
| T-011 | Pagination (numbered / prevNext / loadMore) | 2462 | T-003 |
| T-012 | Tabs + NavTabs | 2463 | T-007 |
| T-013 | Switch + SwitchRow | 2464 | T-001, T-002 |
| T-014 | Extract `account-nav-model.ts` from `AccountLayout` | 2455 | — |
| T-015 | `BaseLayout chrome`, `AccountHeader`, `AccountFooter`, no dock | 2455 | T-002 |
| T-016 | AccountSidebar | 2455 | T-007, T-014 |
| T-017 | `AccountShell.astro` + templates + `AccountLayout shell` switch (default legacy) | 2455 | T-015, T-016 |
| T-018 | AccountBar + AccountDrawer | 2456 | T-009, T-016, T-017 |
| T-019 | PageHeader | 2465 | T-003, T-007 |
| T-020 | Skeleton + EmptyState | 2466 | T-002 |
| T-021 | ErrorState + Alert + AsyncRegion (+ regression test) | 2466 | T-003, T-020 |
| T-022 | StickySaveBar + `useSaveBar` | 2467 | T-003, T-010 |
| T-023 | AutoSaveChip | 2467 | T-003 |
| T-024 | LockedState | 2468 | T-003, T-007 |
| T-025 | Account CSS scope + breakpoint guard | 2469 | — |
| T-026 | CSS literals guard | 2470 | T-025 |
| T-027 | Kit gallery page (gated) | 2471 | T-003…T-024 |
| T-028 | Visual regression suite + CI step + approval docs | 2471 | T-027 |
| T-029 | Flip the shell default, delete legacy, structural sweep, page baselines | 2455, 2471 | T-017, T-018, T-028 |
| T-030 | Docs: kit README, `loading-states.md`, `apps/web/CLAUDE.md` pointer | 2413 | T-029 |

### 12.2 Further notes

- **No `tasks/` folder yet.** `.specs/README.md` says `tasks/` is created when
  implementation starts. Task Master generates it then from §12 and
  `docs/tasks.md` (`/task-master:task-from-spec`).
- **Hydration check.** Every interactive kit piece used from an `.astro` file
  is verified on a production build (`astro build && astro preview`), never
  `astro dev`.
- **Biome traps.** `useExhaustiveDependencies` (pass whole objects),
  `noExplicitAny`, `useDefaultParameterLast`.
- **Local test runs.** Run the kit's own test files and the two guard tests
  with explicit paths. Never the whole `apps/web` suite locally.

## 13. Linear

Canonical tracking: HOS-2413 (parent epic HOS-2409). Children HOS-2455…HOS-2471.
