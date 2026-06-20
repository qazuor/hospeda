# Loading states — web convention (SPEC-228)

This is the single source of truth for how `apps/web` shows "something is
happening". Before adding any loading indicator, pick the right pattern from the
table below and reach for the canonical toolkit in
`src/components/shared/feedback/`. Do **not** invent a new per-component spinner,
a `'...'` text label, or an `⏳` emoji — those are forbidden (see
[Forbidden patterns](#forbidden-patterns)).

## The toolkit

All primitives live in `apps/web/src/components/shared/feedback/`:

| Component | File | Use for |
| --- | --- | --- |
| `Spinner` | `Spinner.tsx` | Any inline/centered "in progress" indicator. Pure CSS ring, `role="status"` when given a `label`. Sizes `sm` \| `md` \| `lg`. |
| `SkeletonCard` / `SkeletonCardList` | `SkeletonCard.tsx` | Initial-load placeholders inside React islands when the content shape is known (lists, cards). |
| `LoadingButton` | `LoadingButton.tsx` | Plain `<button>` async actions. Enforces the [button loading contract](#async-button-contract). |
| `GradientButton` (`loading` prop) | `ui/GradientButtonReact.tsx` | CTAs already built on the gradient button. Same contract, gradient styling. |

The Astro skeleton components in `src/components/skeletons/*.astro` are **not**
part of this toolkit and are not replaced by it — they remain for SSR page
rendering (the `html[data-filters-loading]` pattern, see below). Reach for the
React toolkit inside hydrated islands only.

## Decision table

| Situation | Pattern | Component |
| --- | --- | --- |
| Async button / form submit | Disabled + `aria-busy` + changing label + inline spinner | `LoadingButton` or `GradientButton loading` |
| Initial load of a list/grid whose shape is known | Skeleton placeholders | `SkeletonCardList` (islands) / Astro skeletons (SSR) |
| Filter navigation on an SSR listing page | Skeleton swap via CSS attribute | `html[data-filters-loading]` + Astro skeletons |
| Indeterminate in-flight fetch with no known shape (e.g. map viewport refetch) | Overlay or spinner over the stale content | `Spinner size="lg"` in an overlay |
| Streaming AI response before first token | "Thinking" animated dots | dots pattern (see `SearchChatPanel.client.tsx`) + `Spinner` on send |
| Action whose result is near-instant and reversible | Optimistic UI (apply immediately, reconcile on response) | per-feature (e.g. `FavoriteButton`) |

Rule of thumb: **skeleton** when you know the shape and it's an initial load;
**spinner** when you don't, or it's an inline action; **disabled + changing
label** always on buttons; **optimistic** only when the action is cheap and
safely reversible.

## Async button contract

Every button that triggers an async action MUST, while in flight:

1. be `disabled` (prevents double-submit),
2. carry `aria-busy={true}`,
3. change its visible label to communicate progress (i18n-resolved, e.g.
   `t('conversations.thread.sending', 'Enviando…')`),
4. show an inline `<Spinner size="sm" />`.

`LoadingButton` and `GradientButton`'s `loading` prop both implement this
contract and share the `Spinner` primitive — that's why having two host
components is **not** "two ad-hoc patterns". Pick by host element:

- Plain `<button>` → `LoadingButton`.
- A CTA already rendered as `GradientButton` → pass `loading` / `loadingLabel`
  (rebuilding it as `LoadingButton` would lose the gradient styling).

> **Decision (SPEC-228 T-003, recorded here per locked design decision 3):**
> `LoadingButton` is the canonical primitive for plain async buttons;
> `GradientButton` is extended with an optional `loading` prop for existing
> gradient CTAs. Both delegate to the same a11y contract above. Do **not**
> create a third standalone async-button component.

## Accessibility rules

- **Spinner with a label** renders `role="status"` + `aria-label`, an implicit
  polite live region — screen readers announce it. Pass a `label` whenever the
  spinner is the *only* progress signal.
- **Decorative spinner / skeleton** (when an adjacent live region already
  announces progress) is marked `aria-hidden` — `Spinner` without `label` and all
  `SkeletonCard`s are decorative by default.
- **Result regions** that update after an async action carry
  `aria-live="polite"`.
- **Buttons** follow the [contract](#async-button-contract) (`aria-busy`).
- Respect `prefers-reduced-motion`: every animated module
  (`Spinner.module.css`, `SkeletonCard.module.css`) stops its animation under
  the reduce query while staying visible. `global.css` also applies a blanket
  reduce rule, but keep the local block when you add new animations.

## `html[data-filters-loading]` CSS pattern (SSR listing pages)

Filter-driven SSR listing pages swap their card grid for Astro skeletons while a
filter navigation is in flight, via a `data-filters-loading` attribute toggled on
`<html>`. Reference implementation:
`src/pages/[lang]/alojamientos/index.astro`. Use this — not island state — on
`eventos` and `publicaciones` listing pages. The skeletons come from
`src/components/skeletons/*.astro`, never the React toolkit.

## Forbidden patterns

These fail review (and the CI guard, see below):

- `'...'` used as a loading label (breaks i18n, no animation, no a11y).
- `⏳` (or any emoji) used as a loading indicator.
- A new per-component spinner CSS class. Use `Spinner` instead.
- A button that disappears while loading instead of staying mounted as disabled
  - busy.
- Hardcoded loading strings (`"Enviando..."`, `"Cargando…"`) — route them
  through `t()`.

## CI guard

A grep-based CI check fails the build if a forbidden `'...'` loading label or an
`⏳` emoji appears in `apps/web/src/components/**/*.tsx`. See
`scripts/check-web-loading-patterns.sh`. If you hit a false positive on a
legitimate ellipsis (e.g. truncation copy), prefer the `…` (U+2026) character or
adjust the allowlist in the script with a comment explaining why.

## Reference implementations

- Async button (gold standard): `shared/favorite/FavoriteButton.client.tsx`
  (`isPending`, `aria-busy`, `aria-label`).
- Form submit: `ContactForm.client.tsx` (`aria-busy={isSubmitting}` + sending
  label).
- Thinking indicator: `ai-search/SearchChatPanel.client.tsx` (animated dots).
- Skeleton swap: `pages/[lang]/alojamientos/index.astro`.
