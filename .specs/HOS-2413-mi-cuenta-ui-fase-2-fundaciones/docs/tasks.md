# HOS-2413 — task detail

Companion to [`../spec.md`](../spec.md) §12. Each task gives:

- **Goal**;
- **Files** (new or changed);
- **Acceptance criteria (AC)**;
- **Tests**: Vitest + testing-library + `user-event`, AAA, under
  `apps/web/test/components/account/ui/` unless stated;
- **Depends on**.

Every task's complexity is ≤ 3, so each is one focused session.

## Rules that apply to every task

These are not repeated below.

- **Props and exports.** Named exports, RO-RO props with `readonly`, JSDoc on
  every export, strict TS, `import type`.
- **Size.** 500 lines max per file.
- **Text.** All copy goes in `account.ui.*` (es, en, pt) in
  `packages/i18n/src/locales/*/account.json`. No inline fallback strings.
- **Styling.** Tokens only, through CSS Modules; no Tailwind, inline SVG or
  `phosphor-react`.
- **Icons.** Only from `@repo/icons`, with `aria-hidden` when decorative.
- **Help anchors.** An optional `helpId` is rendered as `data-help` on the root
  through `helpAttr()`, with one test asserting it. Section is the exception:
  there it is required.
- **Focus.** A visible `focus-ring` (2px solid, 2px offset) on every focusable
  element.
- **Motion.** `prefers-reduced-motion` respected wherever there is motion.
- **Layout.** Container queries for the component's own layout. Media queries
  only at 30/48/64/80rem `min-width`.
- **Before committing.** Run the task's own test files plus `biome check` on the
  touched files, and `astro check` when `.astro` files changed. Never the whole
  package suite locally.

---

## PR-1 · tokens + kit scaffold + Button / Section / fields

### T-001 · Kit token delta + D4 owner-decision contrast test

- **Child:** HOS-2457, 2458 and 2460 (delta on top of HOS-2454).
- **Depends on:** HOS-2454 merged into the epic branch (OQ-4).
- **Goal.** Add the tokens the catalog needs that HOS-2454 does not define, in
  `packages/design-tokens` only, and record D4 «color de acción» as a pinned
  owner decision.
- **Files.**
  - `src/themes/web-light.ts` and `src/themes/web-dark.ts`:
    - action tokens: `action-primary`, `action-primary-hover`,
      `on-action-primary`, `action-accent`, `action-accent-hover`,
      `on-action-accent`, `action-danger`, `on-action-danger`;
    - control and navigation tokens: `control-bg`, `control-border`,
      `nav-active-bg`, `nav-active-fg`;
    - upsell tokens: `upsell-bg`, `upsell-fg`, `upsell-border`;
    - shadow: `shadow-sticky`.
  - `src/tokens/layout.ts`:
    - `layoutAccount`: `sidebar-w`, `editor-nav-w`, `form-max`, `reading-max`;
    - `ACCOUNT_BREAKPOINTS_REM = [30, 48, 64, 80] as const`;
    - `CQ_EDITOR_NAV_REM = 60`.
  - `src/generators/*` only if the generator needs to learn a new group.
  - `seed/web-baseline.json`: additions only, existing values unchanged.
  - New `src/tokens/account-kit-contrast.test.ts`.
  - `README.md`: an «Owner decisions» note for D4.
- **AC.**
  - `action-primary` resolves to exactly `brand-primary`, and `action-accent`
    to exactly `brand-accent`, in both themes. Both `on-*` tokens are white.
  - `OWNER_ACCEPTED_D4` pins the measured ratios with a comment citing HOS-2409
    (owner comment, 2026-11-20). The test fails if an alias changes or a ratio
    falls below its pin.
  - These pairs pass AA in light and dark (≥ 4.5:1 for text, ≥ 3:1 for
    non-text):
    - `brand-primary-link` on card;
    - secondary and ghost text;
    - `status-*-fg` on `status-*-bg`, and `status-*-solid` on card;
    - `control-border` on card and on `control-bg`;
    - `focus-ring` on card, muted and popover;
    - `upsell-fg` on `upsell-bg`;
    - `nav-active-fg` on `nav-active-bg`.
  - Breakpoint constants are exported from `src/index.ts`.
  - `pnpm --filter @repo/design-tokens build` passes, including `validate`.
- **Tests.** The contrast tests reuse the culori 8-bit pipeline (helpers copied,
  following the sibling tests' rationale). They also check the alias equality
  and snapshot the generated CSS for the new names in both themes.

### T-002 · Kit scaffold, `HelpAnchor`, i18n namespace, README

- **Child:** HOS-2413.
- **Depends on:** nothing.
- **Goal.** Create the kit folder and its shared plumbing.
- **Files.**
  - `apps/web/src/components/account/ui/help-anchor.ts` (`HelpAnchor`,
    `helpAttr`, `isHelpAnchor`).
  - `ui/index.ts` (named re-exports, extended by each later task).
  - `ui/README.md`: kit rules, a link to the catalog, the two save models, the
    nesting rule and the `data-help` rule.
  - The `account.ui` namespace (common keys: loading, retry, close, required,
    optional, «(se abre en otra pestaña)») in es, en and pt.
- **AC.**
  - `isHelpAnchor` accepts `section:<vertical>.<slug>` and
    `section:<vertical>.<slug>#<element>` (lowercase kebab segments) and
    rejects anything else.
  - `helpAttr({})` returns `{}`, never `data-help="undefined"`.
  - `check:i18n-keys` passes.
- **Tests.**
  - The anchor grammar table: valid and invalid cases.
  - `helpAttr` with and without an id.

### T-003 · Button, LinkButton, TextLink

- **Child:** HOS-2457.
- **Depends on:** T-001, T-002.
- **Goal.** One button recipe and one link recipe (D4 «color de acción»).
- **Files.** `ui/Button.tsx` + `.module.css`, `ui/LinkButton.tsx`,
  `ui/TextLink.tsx` + `.module.css`.
- **AC.**
  - Variants: `primary`, `secondary`, `ghost`, `quiet`, `danger`,
    `danger-ghost` and `accent`. Sizes: `sm` 36, `md` 40, `lg` 44 (from the
    control-height tokens).
  - `loading` sets `aria-busy`, keeps the button's width and blocks a second
    activation. `disabled` uses the native attribute.
  - `iconOnly` without `aria-label` is a TS error (discriminated props).
  - LinkButton renders `<a>` with the button look. TextLink offers `default`,
    `quiet` and `muted`. `external` adds an icon, `rel="noopener noreferrer"`
    and hidden translated text.
  - The JSDoc and README say `accent` is reserved for upsell, sumarse and the
    header «Publicar».
- **Tests.**
  - Every variant renders its class.
  - Enter and Space activate. `loading` blocks a click.
  - `type` defaults to `button`.
  - TextLink external attributes and hidden text.
  - A type-level test (`@ts-expect-error`) for `iconOnly` without a label.

### T-004 · Section with gradient top bar + nesting refusal

- **Child:** HOS-2458.
- **Depends on:** T-001, T-002.
- **Goal.** The flat surface of D5 «secciones planas con barra degradé».
- **Files.** `ui/Section.tsx` + `.module.css`, `ui/section-depth-context.ts`.
- **AC.**
  - The root is `<section aria-labelledby>` with an h2 title (`headingLevel`
    can be 3) and `data-kit-section`.
  - It is `core-card`, has a 1px `border`, uses `radius-surface` (12px), and
    has no `box-shadow` and no `:hover` rule.
  - Every variant gets a 3px top bar with
    `linear-gradient(brand-primary → brand-accent)` at .65.
  - The `danger` variant uses `status-danger-border` and `status-danger-fg`
    for the title.
  - `flush` removes the body padding. Padding is 24px, and 16px when the
    container is under 30rem.
  - `footer` actions align right and go full width under 30rem.
  - `helpId` is required.
  - Nested in another Section: throws `KitNestingError` when
    `import.meta.env.DEV` or in tests. In production it logs through
    `@repo/logger` and renders the children without the box.
- **Tests.**
  - The accessible name comes from the title.
  - `data-help` and `data-kit-section` are present.
  - The nested render throws (regression for the audit's «card dentro de card
    en 7+ páginas»).
  - Every variant renders its classes.
  - A CSS-module assertion: no `box-shadow` and no `:hover` in
    `Section.module.css`, read as text.

### T-005 · Field, TextInput, InputGroup, PhoneField

- **Child:** HOS-2459.
- **Depends on:** T-001, T-002.
- **Goal.** The form field wrapper and the single-line inputs.
- **Files.** `ui/Field.tsx`, `ui/TextInput.tsx`, `ui/InputGroup.tsx`,
  `ui/PhoneField.tsx`, each with its `.module.css`. Reuse
  `lib/forms/build-field-id.ts`.
- **AC.**
  - The label is always visible. A required field shows a
    `destructive-text` asterisk plus hidden «obligatorio»; an optional one
    shows «(opcional)».
  - `aria-describedby` lists the hint and error ids. An error shows an icon
    plus `status-danger-fg` text, and the control gets `aria-invalid`.
  - Inputs are 44px tall with 16px text, a `control-bg` background and a
    `control-border` edge. The invalid edge is `status-danger-solid`.
  - InputGroup takes a prefix or suffix («$», «ARS», «+54»). PhoneField is a
    TextInput with a country prefix, `inputMode="tel"` and
    `autoComplete="tel"`.
  - Native forms only: no form library.
- **Tests.**
  - The label is associated.
  - `describedBy` order is correct.
  - `aria-invalid` toggles.
  - Prefix and suffix are present.
  - PhoneField attributes.
  - Regression: a placeholder never replaces the label (the audit's carta
    finding).

### T-006 · Select, Textarea, Checkbox, Radio

- **Child:** HOS-2459.
- **Depends on:** T-005.
- **Goal.** The rest of the field family.
- **Files.** `ui/Select.tsx`, `ui/Textarea.tsx`, `ui/Checkbox.tsx` (+
  `CheckboxGroup`), `ui/Radio.tsx` (+ `RadioGroup`, `OptionCard` variant), each
  with its `.module.css`.
- **AC.**
  - Select is a native `<select>`, 44px tall with 16px text.
  - The Textarea counter is `aria-describedby`. It announces through
    `aria-live="polite"` only when crossing 90% and 100%, and turns
    `status-danger-fg` over the limit. `softLimit` lets the text go over and
    warns.
  - Checkbox is native with `accent-color` and supports `indeterminate`.
  - Groups use `<fieldset>/<legend>`.
  - Radio arrows move the selection natively. A selected OptionCard shows a
    double border AND the `nav-active-bg` background, never color alone.
- **Tests.**
  - The counter announces only at the two thresholds (fake typing).
  - `indeterminate` is set on the DOM node.
  - Arrow keys change the radio selection.
  - The legend is present.
  - Disabled states.

---

## PR-2 · status + overlays + navigation primitives

### T-007 · StatusPill, CountPill, `status-tone.ts`

- **Child:** HOS-2460.
- **Depends on:** T-001, T-002.
- **Goal.** One status vocabulary.
- **Files.** `ui/StatusPill.tsx`, `ui/CountPill.tsx` (+ CSS),
  `ui/status-tone.ts`.
- **AC.**
  - `status-tone.ts` maps each domain to its statuses: publication,
    moderation, subscription, promotion and benefit usage. The mapping is the
    catalog's table, and the labels come from i18n keys.
  - StatusPill takes `status` + `domain`, or `tone` + `children`. It always
    renders the word; `dot` is optional.
  - The `plan` tone uses the `upsell-*` tokens.
  - CountPill renders `max` (99+), requires a translated `label` for
    `aria-label`, and has `solid` and `muted` variants.
- **Tests.**
  - Every domain × status gives the expected tone and a label.
  - The text is always present.
  - CountPill caps at `max` and keeps the full count in its label.

### T-008 · Dialog

- **Child:** HOS-2461.
- **Depends on:** T-003.
- **Goal.** The kit's modal (OQ-3, recommended composition).
- **Files.** `ui/Dialog.tsx` + `.module.css`. It composes
  `shared/ui/Dialog.client.tsx` or its mechanisms (focus trap, scroll lock,
  `useDialogHistoryBack`, `dialog-panel`).
- **AC.**
  - Sizes `sm` 480 and `md` 640. Below 30rem it takes the full width minus
    16px.
  - Title in the `app-section` style; `popover` surface + `shadow-overlay` on
    the `overlay` scrim.
  - Focus is trapped, Escape closes, and focus returns to the trigger.
  - The back button closes it.
  - Max height with inner scroll.
  - `check:dialog-panel` and `check:no-native-dialogs` stay green.
- **Tests.**
  - Tab cycles inside.
  - Escape calls `onOpenChange(false)`.
  - Focus returns to the trigger.
  - The `initialFocus` prop is honoured.
  - Long content gets the scroll container.

### T-009 · Drawer

- **Child:** HOS-2461.
- **Depends on:** T-008.
- **Goal.** A bottom sheet for mobile and a side panel for desktop.
- **Files.** `ui/Drawer.tsx` + `.module.css`.
- **AC.**
  - `side: 'bottom'` has a 20px top radius, a grab handle and a maximum
    height of 82%. `side: 'right'` is 360px wide.
  - There is always a close button with a translated label; the handle is
    never the only way out.
  - Same focus, Escape, return and back-button behaviour as Dialog.
  - Uses `dialog-viewport` if it needs the full-viewport shape, which means
    the count-pinned entry in `check-dialog-panel.ts` gets updated in this
    task with a reason.
- **Tests.**
  - Close button, Escape and focus return.
  - The `side` class.
  - The handle has `aria-hidden`.

### T-010 · ConfirmDialog + `useConfirm()`

- **Child:** HOS-2461.
- **Depends on:** T-008, T-003.
- **Goal.** One confirmation for destructive or irreversible actions.
- **Files.** `ui/ConfirmDialog.tsx`, `ui/use-confirm.ts`. Decide in the task
  whether `useConfirm` wraps `lib/forms/show-confirmation-dialog.tsx` or
  supersedes it. Either way there must be ONE implementation; the other
  becomes a re-export.
- **AC.**
  - `role="alertdialog"`. Initial focus goes to Cancel, never to the
    destructive button. Escape cancels.
  - `destructive`: the icon sits on `status-danger-bg` and the confirm button
    uses `danger`. `neutral` uses `primary`.
  - An async `onConfirm` puts the button in `loading`. Errors keep the dialog
    open and show the translated message.
  - The confirm label is verb + object, supplied by the caller.
- **Tests.**
  - Focus starts on Cancel.
  - Escape resolves `false`.
  - Confirm resolves `true` after the async work.
  - A rejected `onConfirm` keeps the dialog open.

### T-011 · Pagination

- **Child:** HOS-2462.
- **Depends on:** T-003.
- **Goal.** One paginator replacing the seven implementations.
- **Files.** `ui/Pagination.tsx` + `.module.css`; a pure helper
  `ui/pagination-range.ts`.
- **AC.**
  - `numbered` (with an ellipsis range), `prevNext` and `loadMore`.
  - Either `hrefFor(page)` (links, works without JS) or `onPageChange`
    (client).
  - `<nav aria-label>` translated; `aria-current="page"`; the arrows have
    translated labels.
  - First and last pages are disabled at the bounds.
  - `loadMore` announces the new item count through a polite live region and
    moves focus to the first new item.
- **Tests.**
  - `pagination-range` boundary table: 1 page, 2 pages, the first, the last,
    the middle, large counts.
  - Links vs buttons.
  - Disabled bounds.
  - The loadMore announcement and focus move.

### T-012 · Tabs + NavTabs

- **Child:** HOS-2463.
- **Depends on:** T-007.
- **Goal.** Same-page tabs and URL tabs, with optional counts.
- **Files.** `ui/Tabs.tsx`, `ui/NavTabs.tsx` + `.module.css`.
- **AC.**
  - Tabs follow WAI-ARIA: `tablist`/`tab`/`tabpanel`, `aria-selected`,
    `aria-controls`, roving `tabIndex`, and Left/Right/Home/End.
  - NavTabs are links with `aria-current="page"`.
  - Variants `underline` and `segmented`. A CountPill is optional per item.
  - The bar scrolls horizontally inside its own container, so the page never
    overflows. Each tab is 44px tall.
- **Tests.**
  - The arrows move focus and selection.
  - Home and End.
  - NavTabs render `aria-current`.
  - The overflow container class.

### T-013 · Switch + SwitchRow

- **Child:** HOS-2464.
- **Depends on:** T-001, T-002.
- **Goal.** The single on/off control (D11 «ajustes en Preferencias»).
- **Files.** `ui/Switch.tsx`, `ui/SwitchRow.tsx` + `.module.css`.
- **AC.**
  - `role="switch"` + `aria-checked`; the name comes from `aria-labelledby`.
    It is 44×24 with a visible focus ring.
  - The off track uses `control-border` (≥ 3:1).
  - SwitchRow is a 64px row with a label and description. While `saving` the
    switch is disabled and `aria-busy`. `error` shows the translated text and
    reverts. `locked` shows a plan pill and a link to the LockedState.
  - `aria-describedby` points at ids that exist (regression for HOS-2435's
    broken reference).
- **Tests.**
  - Space toggles.
  - Disabled while saving.
  - The error reverts to the previous value.
  - Every `aria-describedby` id exists in the DOM.

---

## PR-3 · shell behind the switch + mobile bar + PageHeader

### T-014 · Extract `account-nav-model.ts`

- **Child:** HOS-2455.
- **Depends on:** nothing.
- **Goal.** Move the nav DATA logic out of the 810-line layout into a pure,
  tested module that both the sidebar and the drawer consume.
- **Files.**
  - New `apps/web/src/lib/account-nav-model.ts`. It covers the groups from
    `getNavForSurface({ surface: 'sidebar' })` + `isVisibleByRoles`,
    `placeProviderGroup`, discovery doors, the AI-assistants item and
    `ACTIVE_SECTION_OVERRIDES`.
  - `AccountLayout.astro` calls it; its output must stay identical.
- **AC.**
  - The input is `{ roles, ownsHostTradeListing, mcpEnabled, activeSection }`;
    the output is the groups, the doors and the active key.
  - Session reads stay in the layout frontmatter.
  - The legacy layout renders exactly what it rendered before.
- **Tests.**
  - The model per role set: HOST + VENUE_OWNER, provider, tourist only.
  - The provider group sits right before tourist.
  - The overrides for the two inboxes.
  - Snapshot parity of the legacy render for one role set.

### T-015 · `BaseLayout chrome`, AccountHeader, AccountFooter, no dock

- **Child:** HOS-2455.
- **Depends on:** T-002.
- **Goal.** D1 «marco compacto».
- **Files.**
  - `layouts/BaseLayout.astro`: `chrome?: 'site' | 'account'`, default
    `'site'`.
  - New `layouts/AccountHeader.astro`. It composes the existing logo, user
    menu and site-menu islands; `Header.astro` gets no new lines.
  - New `ui/AccountFooter.tsx` + CSS.
- **AC.**
  - With `chrome="account"` there is no `MobileDock`, the header is 56px and
    keeps access to the site menu (curated entries, D3), and the footer is
    one line (legal links and copyright, translated).
  - `chrome="site"` renders the same output as today.
  - BaseLayout stays at or below 500 lines.
- **Tests.** A render test that `MobileDock` is absent and AccountHeader and
  AccountFooter are present under `chrome="account"`, and that the site chrome
  is unchanged by default. Use whatever Astro component-render approach the
  repo already uses; if none exists, assert through the T-029 e2e sweep and
  note that in the PR.

### T-016 · AccountSidebar

- **Child:** HOS-2455.
- **Depends on:** T-007, T-014.
- **Goal.** The sidebar as a kit piece.
- **Files.** `ui/AccountSidebar.tsx` + `.module.css`.
- **AC.**
  - `<nav aria-label>`. Each group is `<details>/<summary>`, and the group
    holding the active item is open.
  - The active item has `aria-current="page"` + `nav-active-*`.
  - Count slots accept the existing count-pill islands.
  - A locked item shows a lock with alternative text and stays a link (D9).
  - Labels come from the nav config: «Mis locales» and «Mis experiencias»
    separate (D20 «nombres separados»), «Complementos» as its own item (D15
    «complementos con ítem propio») when the config has it.
  - No hydration is needed.
- **Tests.**
  - The active group is open.
  - `aria-current` is set.
  - The locked item is still a link with its alternative text.
  - The group order follows the model.

### T-017 · `AccountShell.astro` + templates + `AccountLayout` switch

- **Child:** HOS-2455.
- **Depends on:** T-015, T-016.
- **Goal.** The new shell, landed dormant (OQ-1 option C).
- **Files.** New `layouts/AccountShell.astro` + its CSS Module.
  `AccountLayout.astro` gets `shell?: 'legacy' | 'account'`, default
  `'legacy'`.
- **AC.**
  - From 64rem: a 240px sticky sidebar plus the content column.
  - `<main id="main-content">` with `container-type: inline-size;
    container-name: account-content`. The «Ir al contenido» skip link works.
  - Templates `list`, `form` (720 max, left-aligned), `dashboard`, `reading`
    (640) and `editor`.
  - It uses only the four breakpoints.
  - With the default (`legacy`) no page changes.
- **Tests.** The template class mapping, and that `shell='account'` renders
  the shell landmarks. If `.astro` cannot be rendered in Vitest, the e2e check
  runs on the kit gallery in T-027.

### T-018 · AccountBar + AccountDrawer

- **Child:** HOS-2456.
- **Depends on:** T-009, T-016, T-017.
- **Goal.** D3 «nav mobile única».
- **Files.** `ui/AccountBar.tsx` + CSS. The drawer content reuses
  `AccountSidebar` (the same groups).
- **AC.**
  - Below 64rem: a sticky 48px bar under the header reading «≡ Mi cuenta /
    <sección>».
  - The button has `aria-expanded` and `aria-controls`.
  - It opens a bottom Drawer: focus trapped, Escape closes, focus returns to
    the button.
  - `shadow-sticky` is applied while stuck (an `IntersectionObserver` sentinel
    inside the island, replacing the legacy script).
  - It hydrates only with `client:media="(max-width: 63.99rem)"`.
- **Tests.**
  - It opens and closes.
  - Escape and focus return.
  - The drawer lists the same groups as the sidebar for the same model.
  - The current label is shown.

### T-019 · PageHeader

- **Child:** HOS-2465.
- **Depends on:** T-003, T-007.
- **Goal.** One page anatomy.
- **Files.** `ui/PageHeader.tsx` + CSS.
- **AC.**
  - The title is the only `h1`. Optional: breadcrumbs (`<nav aria-label>`,
    `aria-current` on the last item), `back` (a real link with a translated
    label, never `history.back()`), `status` (StatusPill), `actions` and
    `tabs`.
  - At most one primary action. Below 30rem the actions stack and the primary
    goes full width.
- **Tests.**
  - Exactly one h1.
  - The back link's href and accessible name.
  - `aria-current` on the breadcrumbs.
  - The stacking class.

---

## PR-4 · async states + save models + locked state

### T-020 · Skeleton + EmptyState

- **Child:** HOS-2466.
- **Depends on:** T-002.
- **Goal.** Loading and empty states.
- **Files.** `ui/Skeleton.tsx`, `ui/EmptyState.tsx` + CSS.
- **AC.**
  - Skeleton offers `text`, `title`, `circle` and `block`, plus `Skeleton.Row`
    and `Skeleton.Stat`. The container sets `aria-busy` and a hidden
    translated «Cargando…», with no animation under reduced motion.
  - EmptyState offers `default` and `compact`, an h3 title, a decorative icon
    and an optional action.
  - `check:web-loading` stays green.
- **Tests.**
  - `aria-busy` and the hidden text.
  - The reduced-motion class.
  - The heading level of EmptyState.

### T-021 · ErrorState + Alert + AsyncRegion

- **Child:** HOS-2466.
- **Depends on:** T-003, T-020.
- **Goal.** Make it impossible to show a failure as empty or zero.
- **Files.** `ui/ErrorState.tsx`, `ui/Alert.tsx`, `ui/AsyncRegion.tsx`
  (+ the `AsyncResult<T>` type) + CSS.
- **AC.**
  - ErrorState `block` and `inline` (through `Alert tone="danger"`):
    `role="alert"`, a translated title, «Reintentar», a retrying state, and
    focus restored after the retry. It never renders `error.message` from the
    API.
  - Alert has the `info`, `success`, `warning` and `danger` tones and the
    `banner` variant. `danger` uses `role="alert"` and the others `status`.
  - AsyncRegion requires a render function for each of `loading`, `error`,
    `empty`, `locked` and `ready`, enforced by TS.
- **Tests.**
  - Each state renders its piece.
  - The retry callback runs and focus returns.
  - **Regression (HOS-2421/2422/2424 shape):** a rejected fetch turns into
    `{status:'error'}` and renders ErrorState, never the empty piece and never
    `0`.

### T-022 · StickySaveBar + `useSaveBar`

- **Child:** HOS-2467.
- **Depends on:** T-003, T-010.
- **Goal.** The explicit save model (D8 «dos modelos de guardado»).
- **Files.** `ui/StickySaveBar.tsx` + CSS, `ui/use-save-bar.ts`.
- **AC.**
  - Hidden while clean.
  - States: dirty, saving, saved and error. The error state has «Ir al primer
    error» through `focus-first-invalid-field`.
  - A named `region`; changes are announced (`status`, or `alert` for
    errors). Ctrl/Cmd+S saves.
  - The leave guard goes ONLY through `useUnsavedChangesGuard`: no new
    `beforeunload` or click listener.
  - The bar reserves its height, so the last field stays visible.
  - Desktop: sticky in the content column. Mobile: fixed, safe-area aware,
    44px buttons.
- **Tests.**
  - It appears only when dirty.
  - Discard calls `onDiscard`.
  - Save goes through saving, then saved or error.
  - Ctrl+S.
  - It registers exactly one leave warning, checked with a spy on
    `registerLeaveWarning`.
  - The spacer exists only while the bar is visible.

### T-023 · AutoSaveChip

- **Child:** HOS-2467.
- **Depends on:** T-003.
- **Goal.** The direct-action save signal.
- **Files.** `ui/AutoSaveChip.tsx` + CSS.
- **AC.**
  - `saved` shows the es-AR 24h time from `savedAt`. `saving` shows its own
    label. `error` shows «No se guardó · Reintentar».
  - `role="status"`, or `alert` on error.
- **Tests.**
  - Time formatting with a fixed date.
  - The retry callback.
  - The role switches on error.

### T-024 · LockedState

- **Child:** HOS-2468.
- **Depends on:** T-003, T-007.
- **Goal.** D9 «sin acceso único», with the D22 trial hook prepared.
- **Files.** `ui/LockedState.tsx` + CSS.
- **AC.**
  - Four parts: the lock (decorative), what the feature is, why it is locked
    (in text), and the next action.
  - The `plan` reason shows `plan`-tone pills with the names from `PlanRef`
    (read from the catalog by the caller), «Ver planes» as `accent`, and
    «Empezar prueba» only when supplied.
  - The `role` reason uses an `accent` join action. The `permission` reason
    has no button, only a link.
  - No enabled form control is rendered inside. No plan name, price or limit
    literal appears in the kit (`check:commercial-values` stays green).
- **Tests.**
  - One test per reason kind.
  - The pills show exactly the names of the fixture catalog.
  - No enabled control inside.
  - The trial button is absent unless passed.

---

## PR-5 · guards + kit gallery + visual regression + shell flip + docs

### T-025 · Account CSS scope + breakpoint guard

- **Child:** HOS-2469.
- **Depends on:** nothing (it may move into PR-1, OQ-8).
- **Goal.** D6 «breakpoints cerrados», enforced.
- **Files.**
  - `scripts/lib/account-css-scope.ts`: the scope list, with a header that
    documents how the import trace produced it.
  - `scripts/check-account-breakpoints.ts` and
    `scripts/__tests__/check-account-breakpoints.test.ts`.
  - The root `package.json`: `check:account-breakpoints`, added to
    `check:guards`.
  - `.github/workflows/ci.yml`: its own step in `guards`, with a
    `GUARD:` comment.
  - `apps/web` docs: a container-query example in the kit README.
- **AC.** The rule in spec §6.7, plus:
  - the strict zone refuses allowlist entries;
  - the legacy zone is count-pinned, and stale entries fail;
  - `--print-baseline` produces the initial allowlist;
  - the header lists what the guard does not see.
- **Tests (non-vacuity).**
  - Each synthetic violation is flagged: `max-width` in the kit, 768px,
    `min-width: 40rem`, `matchMedia('(min-width: 1024px)')`, and
    `client:media` off the list.
  - Allowed forms pass: the four values, range syntax, `prefers-*`, and
    `@container` in rem.
  - An allowlist entry under `components/account/ui/` is rejected.
  - A stale count fails.

### T-026 · CSS literals guard

- **Child:** HOS-2470.
- **Depends on:** T-025 (shared scope).
- **Goal.** No literal font-size, radius, shadow or color in account CSS.
- **Files.** `scripts/check-account-css-literals.ts` + test, the root script
  `check:account-css-literals` (added to `check:guards`) and its own CI step.
- **AC.**
  - The rule table in spec §6.7, with per-category, per-file count pinning in
    the legacy zone and zero in the strict zone.
  - Literal `var()` fallbacks count as literals.
  - The generated baseline is committed.
- **Tests.** One synthetic violation per category, a literal fallback, a
  component-local custom property with a hex value, the allowed keywords
  passing, the strict-zone refusal and a stale count.

### T-027 · Kit gallery page (gated)

- **Child:** HOS-2471.
- **Depends on:** T-003…T-024.
- **Goal.** One page rendering every kit component and state, for visual
  regression and review.
- **Files.** `apps/web/src/pages/[lang]/mi-cuenta/kit/index.astro`, rendered
  inside `AccountLayout shell="account"`. The gate follows OQ-6; with the
  recommended option, the env var goes through the 5-step registry workflow
  and the agent then stops for the owner.
- **AC.**
  - 404 when the gate is off.
  - Every component appears in all its states, each wrapped in an element
    carrying `data-visual="<Component>/<state>"`.
  - Interactive pieces appear in a static open state where a screenshot needs
    it (an open Dialog through a prop).
  - No session-dependent content. The page reads no `Astro.locals` beyond what
    the layout already reads.
- **Tests.** The gate (404 vs 200) in an e2e test. The component list is
  checked against `ui/index.ts` exports, so a new kit piece without a gallery
  entry fails.

### T-028 · Visual regression suite + CI step + approval docs

- **Child:** HOS-2471.
- **Depends on:** T-027.
- **Goal.** D18 «modo oscuro en alcance» protected.
- **Files.**
  - `apps/e2e/tests/visual/kit.visual.spec.ts` (`@visual`).
  - `apps/e2e/package.json` scripts: `e2e:test:visual` and
    `e2e:visual:update`.
  - The baselines under `apps/e2e/tests/visual/__screenshots__/`.
  - `.github/workflows/e2e-pr.yml`: its own «Visual regression» step after the
    P0 suite.
  - `apps/e2e/README.md`: «Approving a visual change».
  - Exclude `@visual` from the default `e2e:test`/`p0` runs.
- **AC.**
  - Every `data-visual` block is shot in light and dark, at 1280 and 375.
  - `maxDiffPixelRatio` stays at the repo's existing 0.001 unless measured
    noise demands otherwise, and the PR states the measurement.
  - Fonts are awaited and animations disabled.
  - CI fails on a diff. Baselines are generated in the pinned Playwright image
    (OQ-7).
- **Tests.** The suite itself. A deliberately changed token on a throwaway
  branch must turn the step red; the PR records that this was done.

### T-029 · Flip the shell, delete legacy, structural sweep, page baselines

- **Child:** HOS-2455, HOS-2471.
- **Depends on:** T-017, T-018, T-028.
- **Goal.** Every account page on the new shell, proven by CI.
- **Files.**
  - `AccountLayout.astro`: the default becomes `'account'`; then remove the
    prop, the legacy markup, the legacy `<script>` (the `IntersectionObserver`
    toggle) and the `<style>` block. The file is left as a thin wrapper under
    500 lines.
  - `apps/e2e/tests/visual/account-shell.visual.spec.ts`: baselines for the
    representative pages (spec §6.11).
  - `apps/e2e/tests/account/account-shell-structure.spec.ts`: the sweep over
    every account route, derived from the page files so a new page is covered
    automatically.
- **AC.**
  - The sweep passes on all routes:
    - no horizontal overflow at 375, 768 and 1280;
    - no MobileDock;
    - one `h1`;
    - no nested `[data-kit-section]`;
    - the bar below 64rem and the sidebar from 64rem.
  - The representative baselines exist in light and dark, desktop and mobile.
  - The flip is its own commit, so it can be reverted alone.
- **Tests.** The two specs above. Run the existing account-related P0 specs
  and report the result in the PR.

### T-030 · Docs

- **Child:** HOS-2413.
- **Depends on:** T-029.
- **Goal.** Leave the next phases a map.
- **Files.**
  - `ui/README.md` (final): the catalog link, the rules, the save models,
    nesting, `data-help`, the guards and how to add a component, including a
    gallery entry and baselines.
  - `apps/web/docs/loading-states.md`: the account-area Skeleton row.
  - `apps/web/CLAUDE.md`: a short pointer to the kit and its rules, committed
    separately from code per the repo convention.
- **AC.** Docs match the merged code. `validate-docs` passes.
- **Tests.** None (docs only).
