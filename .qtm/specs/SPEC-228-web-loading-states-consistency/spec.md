---
spec-id: SPEC-228
title: Web loading-states consistency & coverage
type: feature
complexity: high
status: draft
created: 2026-06-13T12:00:00Z
---

# SPEC-228 — Web loading-states consistency & coverage

## Overview

**Goal.** Establish a single canonical loading-state API for the entire web app
(`apps/web`) and migrate every existing ad-hoc pattern to it. Today loading is
shown in at least five incompatible ways: hardcoded `'...'` strings (breaks i18n
and has no animation), emoji `⏳` (zero accessibility), per-component CSS
spinners with inconsistent styles, Astro skeleton components that are not usable
inside React islands, and some interactions that have no loading indicator at all.
Phase 1 creates the shared toolkit and codifies the convention. Phases 2-4 consume
that toolkit to migrate all known problem sites.

**Motivation.** Inconsistency erodes user trust and makes the codebase harder to
maintain: the same pattern is invented from scratch in each island. Beyond polish,
several high-impact flows have concrete functional gaps — the map sidebar shows
stale cards while a viewport fetch is in flight (A1), ContactHost's "Solicitar
acceso" CTA has no loading guard and risks double-submit (A6), and
ConversationReply renders a mute `'...'` string that ships broken i18n and no
`aria-busy` (A7). These are correctness issues, not just polish.

**Success criteria.**

1. A single reusable loading API exists (`Spinner`, `SkeletonCard`, `LoadingButton`
   or equivalent) under `apps/web/src/components/shared/feedback/` (or
   `loading/`), each with a CSS Module, a JSDoc, and full TypeScript types.
2. A short convention document (`apps/web/docs/loading-states.md`) captures when
   to use skeleton vs spinner vs disabled+changing-label vs optimistic UI, and
   the required `aria-busy` / `aria-live` rules.
3. Zero remaining `'...'` hardcoded spinner strings or emoji `⏳` spinners in
   React islands.
4. `aria-busy` / `aria-live` applied consistently on every async button and
   live region.
5. Skeleton-swap (`html[data-filters-loading]` CSS pattern) present in all three
   filter-driven listing pages: alojamientos (already has it), eventos, and
   publicaciones.
6. The map sidebar (`MapCardsSidebar.client.tsx`) shows a loading overlay or
   skeleton while `isFetching` is true from `useViewportSearch`.
7. The AI chat "thinking" indicator (`showThinking` + animated dots) is present
   in `AiChatWidget.tsx`, matching the reference implementation in
   `SearchChatPanel.client.tsx`.
8. Every migrated component uses the canonical toolkit, not a new ad-hoc pattern.

**Locked design decisions (user, 2026-06-13).**

1. Toolkit location: `apps/web/src/components/shared/feedback/` (extends the
   existing feedback folder that already holds `EmptyState.astro`,
   `ErrorBanner.astro`, `PaginationLoading.client.tsx`).
2. New components are React (`.tsx`) with CSS Modules (`.module.css`) — not
   Tailwind. Existing Astro skeletons are NOT replaced; the React toolkit runs
   parallel for islands.
3. `GradientButtonReact.tsx` is extended with a `loading` / `loadingLabel` prop
   where buttons use it; otherwise a standalone `LoadingButton` is acceptable for
   simpler cases. Decision deferred to implementer — record the choice in the
   convention doc.
4. Primary rule: each Phase 2-4 task MUST migrate the site to the canonical
   toolkit; patching ad-hoc is explicitly forbidden.

**Baseline.** File refs verified against `origin/staging` branch (worktree
`hospeda-specs-batch`) on 2026-06-13.

---

## User Stories & Acceptance Criteria

### US-1 — Shared toolkit exists and is documented

GIVEN the Phase 1 toolkit is merged,
WHEN a developer needs to add a loading state to any web island,
THEN they find one clear entry point (`Spinner`, `SkeletonCard`, `LoadingButton`
or their equivalents in `shared/feedback/`) with JSDoc, and a convention doc
that tells them which component to reach for in each scenario.

### US-2 — No text/emoji spinners remain

GIVEN any React island in `apps/web`,
WHEN an async action is in progress,
THEN there are no occurrences of the string `'...'` used as a loading label, and
no `⏳` emoji used as a loading indicator in island source code.

### US-3 — Consistent `aria-busy` and live regions

GIVEN any button that triggers an async action,
WHEN the action is in progress,
THEN the button carries `aria-busy={true}` and its visible label changes to
communicate the in-progress state, and any result region carries `aria-live="polite"`.

### US-4 — Map sidebar loading indicator (HIGH A1)

GIVEN a user panning or zooming the accommodation map,
WHEN `useViewportSearch` is fetching new results (`isFetching === true`),
THEN `MapCardsSidebar.client.tsx` shows a loading overlay or skeleton cards
instead of the previous (stale) card list, and the overlay disappears when
`isFetching` returns to false.

### US-5 — Filter skeleton-swap on eventos and publicaciones (HIGH A2 / A3)

GIVEN the eventos listing page (`pages/[lang]/eventos/index.astro`),
WHEN a filter navigation is in flight,
THEN the event card grid is replaced by `EventCardHorizontalSkeleton.astro`
cards via the `html[data-filters-loading]` CSS pattern (matching the alojamientos
reference implementation at `pages/[lang]/alojamientos/index.astro`).

GIVEN the publicaciones listing page (`pages/[lang]/publicaciones/index.astro`),
WHEN a filter navigation is in flight,
THEN the post card grid shows `PostGridSkeleton.astro` cards via the same
`html[data-filters-loading]` CSS pattern (the existing `ArticleCardSkeleton.astro`
usage in the error branch does not cover the filter-loading path — that gap is
what this task closes).

### US-6 — AiChatWidget "thinking" indicator (HIGH A4)

GIVEN a user submitting a message in `AiChatWidget.tsx`,
WHEN the message is sent and the AI has not yet returned the first token,
THEN a "thinking" indicator (animated dots, equivalent to `showThinking` in
`SearchChatPanel.client.tsx` L217 / L292) is displayed, and the `⏳` emoji
on the send button (L241) is replaced by a `Spinner` component.

### US-7 — ReviewsModal / DestinationReviewsModal consistent spinner (HIGH A5)

GIVEN `ReviewsModal.client.tsx` (L236: `{loading && <div className={styles.spinner}>...</div>}`)
or `DestinationReviewsModal.client.tsx`,
WHEN reviews are loading or "cargar más" is in progress,
THEN the canonical `Spinner` replaces the static `'...'` text, the "cargar más"
button is disabled with `aria-busy={true}` and changes label during loading
instead of disappearing.

### US-8 — ContactHost double-submit guard (HIGH A6)

GIVEN `ContactHost.client.tsx`,
WHEN a user clicks "Solicitar acceso" (`handleRequestAccess`, L280),
THEN the button is disabled with `aria-busy={true}` for the duration of the
async operation, preventing double-submit, and the form submit button also
carries `aria-busy` during `handleSubmit`.

### US-9 — ConversationReply send button (HIGH A7)

GIVEN `ConversationReply.client.tsx` (L174: `{sending ? '...' : t('conversations.thread.send')}`),
WHEN the send action is in progress,
THEN the button shows a `Spinner` or a i18n-keyed label (e.g.
`t('conversations.thread.sending')`), and carries `aria-busy={true}`, rather
than the hardcoded `'...'` string.

### US-10 — Medium-priority feedback improvements (MEDIUM)

GIVEN the modal for reviews in accommodation or destination pages,
WHEN the modal first opens and reviews are loading,
THEN a skeleton or spinner is shown for the initial load state (distinct from
"cargar más" pagination).

GIVEN `CommentThreadIsland.client.tsx` (has `aria-busy={isSubmitting}` at L307
but no visual spinner),
WHEN `isSubmitting` is true,
THEN a `Spinner` component is visible alongside the button, consistent with the
canonical pattern.

GIVEN `ImageGallery.client.tsx` lightbox,
WHEN the user navigates between images,
THEN there is a fade or placeholder between image loads (no jarring blank state).

GIVEN `pages/[lang]/alojamientos/mapa.astro` (imports
`AccommodationsListingMap.client.tsx` at L16/L410 but does not use the existing
`MapPlaceholder.astro` at `components/MapPlaceholder.astro`),
WHEN the map island is hydrating,
THEN `MapPlaceholder.astro` is rendered as the Astro-side placeholder until
the island mounts.

### US-11 — Low-priority polish pass (LOW)

GIVEN `host/editor/LocationPicker.client.tsx` (L230: `⏳` emoji),
THEN the emoji is replaced by the canonical `Spinner`.

GIVEN `FavoriteButton.client.tsx` (has `isHydrating` state but no visual spinner
during hydration),
THEN during hydration a subtle `Spinner` or skeleton is shown if the hydration
delay is perceptible.

GIVEN `newsletter/NewsletterPreferences.client.tsx` (L279: `aria-busy="true"` with
a text paragraph but no spinner) and `CollectionDetailActions.client.tsx` (has
`aria-busy={isDeleting}` at L138 but the label does not change during deletion),
THEN both are updated to show a visual spinner and change the button label during
the async action.

GIVEN `UserFavoritesList.client.tsx` (L723: text `t('common.loading', 'Cargando…')`)
and `UserReviewsList.client.tsx` (L282: same text pattern),
THEN the text loading state is replaced by `SkeletonCard` components for a more
polished initial-load experience.

---

## Technical Approach

### Part A — Foundation (Phase 1)

**Canonical toolkit location:**
`apps/web/src/components/shared/feedback/`

This folder already contains `EmptyState.astro`, `ErrorBanner.astro`,
`Pagination.astro`, `PaginationLoading.client.tsx`, and
`SearchContextBanner.astro`. The new React loading primitives live alongside
them.

**New components:**

- `apps/web/src/components/shared/feedback/Spinner.tsx` + `Spinner.module.css`
  — a pure CSS animated ring (no external dep), with props `size` (`sm` |
  `md` | `lg`) and `label` (forwarded to `aria-label`). Replaces all ad-hoc
  spinner CSS classes (`ReviewSidebarCard.client.tsx:487 styles.spinner`, etc.).

- `apps/web/src/components/shared/feedback/SkeletonCard.tsx` +
  `SkeletonCard.module.css` — a configurable shimmer block (`width`, `height`,
  `borderRadius`) for use inside React islands. Separate from the existing Astro
  skeleton components (which remain for SSR pages). Composed into
  `SkeletonCardList.tsx` for list patterns (e.g. UserFavoritesList,
  UserReviewsList).

- `apps/web/src/components/shared/feedback/LoadingButton.tsx` +
  `LoadingButton.module.css` — a `<button>` wrapper that accepts `loading:
  boolean`, `loadingLabel: string` (i18n key already resolved), and renders
  `aria-busy={loading}` + `disabled={loading}` + shows `<Spinner size="sm" />`
  inline when loading. Can be used as a drop-in replacement for async buttons
  throughout islands.

  Alternative path: extend `apps/web/src/components/ui/GradientButtonReact.tsx`
  with a `loading` / `loadingLabel` prop. `GradientButtonReact` currently has no
  loading support. Decision: the implementer must pick ONE of these approaches and
  document it in the convention doc — mixing both is forbidden. Prefer extending
  `GradientButtonReact` if the CTA uses that component; prefer `LoadingButton` for
  plain `<button>` elements. Record the decision in the convention doc.

**Convention document:**
`apps/web/docs/loading-states.md`

Contents: decision table (skeleton vs spinner vs disabled-label vs optimistic);
required accessibility attributes (`aria-busy`, `aria-live`, `role="status"`);
when to use `html[data-filters-loading]` CSS pattern vs island state; links to
each reference implementation; forbidden patterns (`'...'` strings, `⏳` emoji,
per-component inline spinner CSS).

**Optional lint guard:** A Biome custom lint rule or a simple grep-based CI
check that fails if `'...'` or `⏳` appear inside `*.client.tsx` / `*.tsx`
files in `apps/web/src/components/`. Implementation optional in Phase 1 but
listed as a task.

**Touched files (Phase 1):**

- `apps/web/src/components/shared/feedback/Spinner.tsx` — new
- `apps/web/src/components/shared/feedback/Spinner.module.css` — new
- `apps/web/src/components/shared/feedback/SkeletonCard.tsx` — new
- `apps/web/src/components/shared/feedback/SkeletonCard.module.css` — new
- `apps/web/src/components/shared/feedback/LoadingButton.tsx` — new
- `apps/web/src/components/shared/feedback/LoadingButton.module.css` — new
- `apps/web/docs/loading-states.md` — new convention doc
- `apps/web/src/components/ui/GradientButtonReact.tsx` — possibly extend with
  `loading` / `loadingLabel` props (decision: implementer)
- Optional: `.github/workflows/ci.yml` or `scripts/` — grep guard for
  forbidden patterns

### Part B — HIGH priority migration (Phase 2)

**A1 — Map sidebar loading (A1).**
`apps/web/src/components/maps/AccommodationsListingMap.client.tsx:146` — the
`useViewportSearch` destructure already returns `isFetching` (hook source:
`apps/web/src/hooks/useViewportSearch.ts:94`) but it is ignored. Wire it:
destructure `isFetching` and pass it as a prop to `MapCardsSidebar.client.tsx`
(currently used at L364 of `AccommodationsListingMap.client.tsx`).
In `MapCardsSidebar.client.tsx`, show a loading overlay (semi-transparent,
`<Spinner size="lg" />` centered) or skeleton cards when the new `isFetching`
prop is true.

Touched: `AccommodationsListingMap.client.tsx`, `MapCardsSidebar.client.tsx`.

**A2 — Eventos skeleton-swap.**
`apps/web/src/pages/[lang]/eventos/index.astro` — no skeleton-swap exists. Port
the pattern from `pages/[lang]/alojamientos/index.astro` (L848-L910): add a
hidden `<EventCardHorizontalSkeleton />` block (from
`components/skeletons/EventCardHorizontalSkeleton.astro`) alongside the event
grid, then show/hide via the `html[data-filters-loading]` CSS attribute toggle.

Touched: `pages/[lang]/eventos/index.astro`.

**A3 — Publicaciones skeleton-swap.**
`apps/web/src/pages/[lang]/publicaciones/index.astro` — the file already imports
`ArticleCardSkeleton.astro` (L36) but only uses it in the error branch (L365),
not the filter-loading path. Add `PostGridSkeleton.astro` (already exists at
`components/skeletons/PostGridSkeleton.astro`) alongside the post grid with the
`html[data-filters-loading]` CSS pattern. The error-branch
`ArticleCardSkeleton` usage stays.

Touched: `pages/[lang]/publicaciones/index.astro`.

**A4 — AiChatWidget thinking indicator + ⏳ replacement.**
`apps/web/src/components/accommodation/AiChatWidget.tsx:241` — replace `⏳`
emoji on the send button with `<Spinner size="sm" />` when streaming. Add a
`showThinking` state (mirrors `SearchChatPanel.client.tsx:217`) that is true
when `chat.state.status === 'streaming'` and no reply token has been received
yet; render the animated dots pattern from `SearchChatPanel.client.tsx:292`.

Touched: `apps/web/src/components/accommodation/AiChatWidget.tsx`.

**A5 — ReviewsModal + DestinationReviewsModal.**
`apps/web/src/components/accommodation/ReviewsModal.client.tsx:236` — replace
`<div className={styles.spinner}>...</div>` with `<Spinner />`. Make "cargar
más" button use `LoadingButton` or add `aria-busy` + label change during loading;
the button must NOT disappear while loading (L251 condition).
Apply the same treatment to
`apps/web/src/components/destination/DestinationReviewsModal.client.tsx`.

Touched: `ReviewsModal.client.tsx`, `DestinationReviewsModal.client.tsx`.

**A6 — ContactHost double-submit guard.**
`apps/web/src/components/accommodation/ContactHost.client.tsx:280`
(`handleRequestAccess`) — wrap the CTA button with `LoadingButton` or add
`disabled + aria-busy` during the async call. Same for `handleSubmit` — verify
and add `aria-busy` if missing.

Touched: `apps/web/src/components/accommodation/ContactHost.client.tsx`.

**A7 — ConversationReply send button.**
`apps/web/src/components/account/ConversationReply.client.tsx:174` — replace
`{sending ? '...' : t('conversations.thread.send')}` with a `<Spinner size="sm"
/>` or an i18n-keyed label (add `conversations.thread.sending` translation key).
Add `aria-busy={sending}` to the submit button.

Touched: `apps/web/src/components/account/ConversationReply.client.tsx`.
i18n keys: `packages/i18n/src/locales/{es,en,pt}/conversations.json` (or
equivalent namespace).

### Part C — MEDIUM priority (Phase 3)

- **Modal initial-load skeleton.** `ReviewsModal.client.tsx` and
  `DestinationReviewsModal.client.tsx`: show a `SkeletonCard` stack during the
  first fetch (before any reviews are returned), distinct from the "cargar más"
  spinner.
- **CommentThreadIsland visual spinner.**
  `apps/web/src/components/comments/CommentThreadIsland.client.tsx:307` — has
  `aria-busy={isSubmitting}` but no visual. Add inline `<Spinner size="sm" />`
  next to the submit button when `isSubmitting` is true.
- **ImageGallery lightbox fade.**
  `apps/web/src/components/ImageGallery.client.tsx` — add CSS fade transition
  (opacity 0 → 1 via CSS Module) or a brief shimmer between lightbox image
  changes to avoid jarring blank states.
- **MapPlaceholder hydration.**
  `apps/web/src/pages/[lang]/alojamientos/mapa.astro` (L16, L410) — render
  `apps/web/src/components/MapPlaceholder.astro` as Astro-side slot content
  until `AccommodationsListingMap.client.tsx` hydrates (Astro `client:*`
  fallback slot pattern).

### Part D — LOW priority + final sweep (Phase 4)

- `host/editor/LocationPicker.client.tsx:230`: replace `⏳` with `<Spinner
  size="sm" />`.
- `apps/web/src/components/shared/favorite/FavoriteButton.client.tsx` — add a
  subtle spinner during `isHydrating` if the delay is perceptible (measure first;
  skip if it is <100 ms in practice).
- `apps/web/src/components/newsletter/NewsletterPreferences.client.tsx` (L279):
  add `<Spinner />` alongside the `aria-busy="true"` paragraph; the loading
  text stays but should not be the only indicator.
- `apps/web/src/components/account/CollectionDetailActions.client.tsx` (L117-L138):
  `deleteLabel` does not change during deletion; add a `loadingLabel` variant so
  the button text reflects the in-progress state.
- `apps/web/src/components/account/UserFavoritesList.client.tsx` (L723-L729):
  replace the `t('common.loading', 'Cargando…')` text block with `<SkeletonCard
  />` list.
- `apps/web/src/components/account/UserReviewsList.client.tsx` (L282): same
  migration from loading text to `<SkeletonCard />`.
- `apps/web/src/components/ai-search/SearchChatPanel.client.tsx:442`: same `⏳`
  on send button — replace with `<Spinner size="sm" />`.
- Final consistency sweep: audit all `*.client.tsx` files in `apps/web/src/` for
  any remaining `'...'` / `⏳` patterns not covered above.

### Patterns / constraints

- No `any`; `import type`; named exports; RO-RO; Zod not required for UI-only
  components but props interfaces must be fully typed.
- Web styling = CSS Modules (`.module.css`) — not Tailwind utility classes.
- Accessibility: `aria-busy`, `aria-live="polite"`, `role="status"` per the
  convention doc.
- All migrated components must import from the canonical toolkit location — no
  new local spinner CSS classes.
- i18n: all visible loading labels must use `createTranslations(locale)` — no
  hardcoded strings (including "Enviando...", "Cargando…").

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Per-component CSS `spinner` class already referenced in module files | Low | Rename as part of each migration task; CSS Modules are scoped so no global collision |
| `MapCardsSidebar` prop interface changes break callers | Low | Only `AccommodationsListingMap` passes to it; update both in one PR |
| Extending `GradientButtonReact` with `loading` prop changes its signature | Medium | Add the prop as optional with a default of `false`; existing callers unaffected |
| Skeleton shimmer animation adds paint cost on low-end devices | Low | CSS `@media (prefers-reduced-motion)` shortcut; disable animation, keep skeleton shape |
| Lint guard false-positives on legitimate `'...'` in non-loading contexts | Low | Scope the guard to specific patterns (e.g. `{sending ? '...'`) or limit to button label contexts |
| Phase 4 sweep discovers more sites than estimated | Medium | Phase 4 explicitly allows scope to expand; document newly found sites as extra tasks |

## Out of Scope

- Admin app (`apps/admin`) — it uses Shadcn UI which has its own loading patterns.
- Astro skeleton components (`apps/web/src/components/skeletons/*.astro`,
  `shared/cards/ArticleCardSkeleton.astro`) — not replaced; they remain for
  SSR page rendering and are not superseded by the React toolkit.
- Global page-transition loading bar (e.g. NProgress) — not in scope for this
  spec.
- Optimistic UI mutations (e.g. toggling favorites before the server responds) —
  mentioned in the convention doc as a pattern but implementation is per-feature.
- Loading states in the `apps/api` or `packages/*` layer.

---

## Suggested Tasks (phased)

### Phase 1 — Foundation

- **T-01** (setup): Create `Spinner.tsx` + `Spinner.module.css` in
  `shared/feedback/` — size prop (`sm` | `md` | `lg`), CSS ring animation,
  `aria-label` forwarded, `role="status"`. Tests: render + size classes.
- **T-02** (setup): Create `SkeletonCard.tsx` + `SkeletonCard.module.css` in
  `shared/feedback/` — shimmer animation, configurable dimensions,
  `prefers-reduced-motion` guard. Compose `SkeletonCardList.tsx` for list use.
  Tests: render, motion-off fallback.
- **T-03** (setup): Create `LoadingButton.tsx` + `LoadingButton.module.css` in
  `shared/feedback/` — wraps a `<button>`, props: `loading`, `loadingLabel`,
  `disabled`, `onClick`, `type`, `className`. Renders inline `<Spinner size="sm"
  />` when loading. Tests: disabled when loading, aria-busy, label change.
  Alternatively extend `GradientButtonReact.tsx` — pick ONE approach and
  document it.
- **T-04** (docs): Write `apps/web/docs/loading-states.md` — decision table,
  aria rules, forbidden patterns, links to each component and each reference
  implementation.
- **T-05** (optional lint): Add CI grep guard that fails if `'...'` or `⏳`
  appear as button children in `apps/web/src/**/*.tsx`. Script in `scripts/` or
  inline in `.github/workflows/ci.yml`.

### Phase 2 — HIGH priority migrations

- **T-06** (A1 map): Wire `isFetching` from `useViewportSearch` into
  `AccommodationsListingMap.client.tsx` and pass it to
  `MapCardsSidebar.client.tsx`; add loading overlay with `<Spinner size="lg"
  />`. Tests: prop threading.
- **T-07** (A2 eventos): Port `html[data-filters-loading]` skeleton-swap to
  `pages/[lang]/eventos/index.astro` using `EventCardHorizontalSkeleton.astro`.
- **T-08** (A3 publicaciones): Add `html[data-filters-loading]` skeleton-swap to
  `pages/[lang]/publicaciones/index.astro` using `PostGridSkeleton.astro`. Ensure
  existing error-branch `ArticleCardSkeleton` usage is preserved.
- **T-09** (A4 AiChatWidget): Replace `⏳` emoji on send button with `<Spinner
  size="sm" />`; add `showThinking` state + animated dots.
- **T-10** (A5 ReviewsModal): Migrate `ReviewsModal.client.tsx` spinner from
  `<div className={styles.spinner}>...</div>` to `<Spinner />`; fix "cargar más"
  button to use `LoadingButton` with label change instead of disappearing.
- **T-11** (A5 DestinationReviewsModal): Same treatment as T-10 for
  `DestinationReviewsModal.client.tsx`.
- **T-12** (A6 ContactHost): Add `disabled + aria-busy` guard to
  `handleRequestAccess` CTA in `ContactHost.client.tsx`; verify `handleSubmit`
  also has it.
- **T-13** (A7 ConversationReply): Replace `'...'` with `<Spinner size="sm" />`
  or i18n label; add `aria-busy={sending}`; add `conversations.thread.sending`
  i18n key to es/en/pt.

### Phase 3 — MEDIUM priority

- **T-14**: Add initial-load skeleton to `ReviewsModal` + `DestinationReviewsModal`
  (first fetch, before any reviews arrive).
- **T-15**: Add visual `<Spinner size="sm" />` to `CommentThreadIsland.client.tsx`
  submit button when `isSubmitting` is true.
- **T-16**: Add CSS fade/shimmer transition between lightbox image changes in
  `ImageGallery.client.tsx`.
- **T-17**: Wire `MapPlaceholder.astro` as Astro-side fallback slot in
  `pages/[lang]/alojamientos/mapa.astro`.

### Phase 4 — LOW priority + sweep

- **T-18**: Replace `⏳` in `LocationPicker.client.tsx:230` with `<Spinner size="sm" />`.
- **T-19**: Evaluate and optionally add hydration spinner to
  `FavoriteButton.client.tsx` for `isHydrating` phase.
- **T-20**: Add `<Spinner />` + visual indicator to `NewsletterPreferences.client.tsx`
  loading state.
- **T-21**: Add loading label change to `CollectionDetailActions.client.tsx` delete
  button.
- **T-22**: Migrate `UserFavoritesList.client.tsx` loading text → `<SkeletonCard />`
  list.
- **T-23**: Migrate `UserReviewsList.client.tsx` loading text → `<SkeletonCard />`
  list.
- **T-24**: Replace `⏳` in `SearchChatPanel.client.tsx:442` send button.
- **T-25**: Final sweep — audit all `*.client.tsx` in `apps/web/src/` for any
  remaining forbidden patterns; create follow-up tickets or fix inline.

---

## Internal Review Notes

- **Verified on staging branch (2026-06-13):**
  - Existing Astro skeletons: `AccommodationGridSkeleton.astro`,
    `DestinationGridSkeleton.astro`, `EventCardHorizontalSkeleton.astro`,
    `EventCardFeaturedSkeleton.astro`, `NextEventsSectionSkeleton.astro`,
    `PostGridSkeleton.astro` (all in `components/skeletons/`);
    `ArticleCardSkeleton.astro` in `components/shared/cards/`.
  - No existing React spinner/skeleton primitives. `PaginationLoading.client.tsx`
    is the only React loading component in `shared/feedback/` and it builds an
    overlay imperatively via `useEffect` + DOM manipulation — NOT a reusable
    primitive.
  - `useViewportSearch.ts` returns `{ items, isFetching, onBoundsChange }` (L94)
    but `AccommodationsListingMap.client.tsx:146` only destructures `{ items,
    onBoundsChange }` — confirmed `isFetching` is actively discarded.
  - `ConversationReply.client.tsx:174`: `{sending ? '...' : t('conversations.thread.send')}`
    confirmed; no `aria-busy` on the submit button.
  - `AiChatWidget.tsx:241`: `{chat.state.status === 'streaming' ? '⏳' : '↑'}`
    confirmed. `SearchChatPanel.client.tsx:217/292` has the `showThinking` + dots
    reference pattern.
  - `ReviewsModal.client.tsx:236`: `<div className={styles.spinner}>...</div>`
    with inner text `...`; button at L251 has condition `!loading && !error &&
    hasMore` — disappears while loading.
  - `ContactHost.client.tsx:280/337`: no `loading` state guard on
    `handleRequestAccess`; no `aria-busy` on button.
  - Skeleton-swap pattern confirmed at `alojamientos/index.astro:848-910`;
    absent in `eventos/index.astro` (zero matches); partially present in
    `publicaciones/index.astro` but only in error branch, not filter-loading.
  - `MapPlaceholder.astro` exists at
    `apps/web/src/components/MapPlaceholder.astro` but is not imported by
    `mapa.astro` (confirmed via grep).
- **Open questions for impl:**
  1. Extend `GradientButtonReact.tsx` vs create standalone `LoadingButton.tsx` —
     implementer picks ONE and documents in convention doc.
  2. Map loading: full sidebar overlay vs skeleton cards — overlay is simpler;
     skeleton cards match the desktop feel better but require a SkeletonCard list.
  3. Lint guard: in-workflow grep vs Biome custom rule — grep is faster to ship
     in Phase 1.
  4. `FavoriteButton` hydration spinner: measure the hydration delay before
     adding; if it's imperceptible skip T-19.
- **Reference implementations to mirror:**
  - Best-in-class button: `FavoriteButton.client.tsx` (`isPending`, `isHydrating`,
    `aria-busy`, `aria-label`, `data-*`) — use as the gold standard.
  - Best-in-class form submit: `ContactForm.client.tsx` (`aria-busy={isSubmitting}`,
    label `t('contact.form.sending', 'Enviando...')`).
  - Best-in-class thinking indicator: `SearchChatPanel.client.tsx:217/292`
    (`showThinking` + animated dots).
  - Best-in-class skeleton-swap: `pages/[lang]/alojamientos/index.astro:848-910`.
