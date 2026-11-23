# Mi Cuenta component kit

One React component per piece of the account UI (HOS-2413, epic HOS-2409),
styled with CSS Modules over `@repo/design-tokens`.

- **Visual source of truth:** the approved component catalog (v5, owner
  2026-11-20): <https://claude.ai/artifact/26HuDrHSqJJ7jtDwbnfFzq>. Where this
  kit and the catalog disagree on something visual, the catalog wins.
- **Spec:** `.specs/HOS-2413-mi-cuenta-ui-fase-2-fundaciones/spec.md`. Per-task
  detail is in its `docs/tasks.md`.

No account page adopts the kit in phase 2. Pages migrate in phases 3-5
(HOS-2414…2416).

## Rules

- **One piece, one component.** Each lives in this folder as
  `Name.tsx` + `Name.module.css` and is exported by name from `index.ts`.
  Import from `index.ts`, never from a component file.
- **TypeScript.** Named exports only. Props are one RO-RO object with
  `readonly` fields. JSDoc on every export, strict mode, no `any`,
  `import type` for types. Max 500 lines per file.
- **Text.** Every string goes through `@repo/i18n`, in the `account.ui.*`
  namespace (es, en, pt). That includes `aria-label` values and hidden text. No
  inline fallback strings.
- **Styling.** CSS Modules with design tokens only (`var(--…)`). No Tailwind,
  no literal font size, radius, shadow or color, and no inline SVG or
  `phosphor-react`. `check:account-css-literals` enforces the literals rule.
- **Icons.** Only from `@repo/icons`, with `aria-hidden` when decorative.
- **Focus.** Every focusable element shows the `--focus-ring` outline: 2px
  solid with a 2px offset.
- **Motion.** Respect `prefers-reduced-motion` wherever there is motion.
- **Hydration.** Non-interactive pieces render from Astro with no `client:*`.
  Interactive ones live inside an existing island, or use the least eager
  directive that works.

## Layout: container queries first

A component adapts to its CONTAINER, not to the viewport. Media queries are
for page layout only, and only at the four closed breakpoints (D6
«breakpoints cerrados»): `min-width` 30rem, 48rem, 64rem or 80rem.
`check:account-breakpoints` enforces both rules, and `@container` conditions
must use `rem`.

```css
/* Section.module.css — padding shrinks when its own container is narrow. */
.root {
    container-type: inline-size;
    padding: var(--space-6);
}

@container (width < 30rem) {
    .root {
        padding: var(--space-4);
    }
}

/* Page layout: one of the four breakpoints, min-width only. */
@media (min-width: 64rem) {
    .shell {
        grid-template-columns: var(--sidebar-w) 1fr;
    }
}
```

The same numbers are exported from TS as `ACCOUNT_BREAKPOINTS_REM` and
`CQ_EDITOR_NAV_REM` in `@repo/design-tokens`, for tests and `matchMedia`
callers.

## Two save models (D8 «dos modelos de guardado»)

- **Explicit save:** a form with several fields that is saved as a whole uses
  `StickySaveBar`. It appears only when something changed and guards against
  leaving with unsaved changes.
- **Direct action:** a control that saves on its own (a switch, a reorder)
  shows `AutoSaveChip` with the saved, saving or failed state.

Never mix the two models in one form.

## Never a box inside a box (D5 «nunca una caja dentro de otra»)

`Section` is the only surface. A `Section` nested inside another throws
`KitNestingError` in development and tests. In production it logs and renders
its children without the box. Every `Section` root also carries
`data-kit-section`, so the e2e sweep can catch nesting across separate Astro
islands, where React context does not reach.

## `data-help`

Every kit component accepts an optional `helpId` and renders it as `data-help`
on its root through `helpAttr()`. `Section` requires one: a `Section` without
`helpId` does not compile. The anchor grammar is
`section:<vertical>.<slug>` (vertical letters only, slug lowercase kebab, no
`#element`), the same as `parseHelpAnchor` in `@repo/help` (`isHelpAnchor()`
checks the shape). Whether the
anchor resolves to a help article is HOS-2410's guard.

## Listing and billing pieces (HOS-2414 PR-5)

- **`Menu`** — overflow «more actions» menu button (WAI-ARIA pattern). Props:
  `label` (required trigger name, name the object: «Más acciones para X»),
  `items: MenuItem[]`, `locale`, optional `triggerText`, `align`. An item is a
  link (`href`, `external?`) or an action (`onSelect`); both take `tone:
  'danger'` and `disabled`. `onSelect` runs after the menu closed and focus
  went back to the trigger, so it can open a `ConfirmDialog`. Interactive:
  render it inside an island.
- **`ListingCard` / `ListingCardGrid`** — one listing an owner manages,
  shared by every vertical (`vertical` prop picks the no-photo icon tile).
  Slots: `status` (StatusPill), `meta` lines, `children` (notices, checklist),
  ONE `primaryAction`, a `menu` (the `Menu` above) and a `footer`. The card
  knows nothing about publishing: the caller builds the actions.
- **`PlanSummary`** — a subscription: `name` and `price` already resolved
  from the catalog (never a literal, G7), `status`, `scope`, `renewal`, and a
  body for the details and actions of that state.
- **`Stepper`** — display-only progress of a short flow (`steps`, `current`,
  `label`); the flow owns moving between steps and the back step.
- **`OptionCard` / `OptionCardGrid`** — one choice as a single native button
  (`title`, `description`, `meta`, `badge`); `data-*` pass through.

## Guards

Both guards scope the account area and give this folder zero tolerance: no
exceptions-list entry may point inside it.

- `pnpm check:account-breakpoints` (HOS-2469)
- `pnpm check:account-css-literals` (HOS-2470)
