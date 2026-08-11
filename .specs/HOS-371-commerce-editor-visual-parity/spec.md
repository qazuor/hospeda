---
title: Commerce editor — card sections and rich fields (visual parity with the accommodation editor)
linear: HOS-371
statusSource: linear
created: 2026-08-01
type: feature
areas:
  - web
---

# Commerce editor — card sections and rich fields (visual parity with the accommodation editor)

## 1. Summary

Bring the commerce owner listing editor (`CommerceListingEditor.client.tsx`, used for
both the gastronomy and experience verticals) closer to the visual and interaction
quality of the accommodation host editor, without touching business logic, entitlements,
or the 500-line-cap split tracked separately in HOS-258. Two concrete changes:

1. **Card sections** — wrap each of the 13 `<section>` blocks in the same elevated
   `.card` treatment the accommodation editor already uses (top gradient bar, tokenized
   background/border/radius/shadow).
2. **Richer field components** — reuse three components that already exist and are
   generic (`RichTextEditor`, `CountryCodeCombobox`, category-grouped `<details>`
   accordions) for `richDescription`, the phone field, and the amenities/features
   checklist, replacing today's plain `<textarea>`, static `+54...` `<input type="tel">`,
   and flat checkbox lists respectively.

## 2. Problem

The owner's explicit ask ("los forms de comercio deberían parecerse a los de
alojamiento"). Both editors already share the same validation/error infrastructure
(`useZodForm`, `zodIssuesToFieldErrors`, `addToast`, `apiClient`) and a prior pass
already aligned commerce's low-level visual language (spacing, borders, tokens — see
`CommerceListingEditor.module.css` header comment). What was never done is the
higher-level structural/component parity: sections read as plain stacked divs with a
bottom-bordered label instead of accommodation's elevated cards, and three fields use
generic HTML inputs where a purpose-built, reusable component already exists.

## 3. Goals

- G-1: Every `<section>` in `CommerceListingEditor.client.tsx` gets the same card
  elevation (background, border, radius, shadow, top gradient bar) as
  `AccommodationEditor.client.tsx`'s sections, via the same `composes: card from
  "../account/AccountSection.module.css"` mechanism.
- G-2: `richDescription` (gastronomy and experience) is edited through
  `RichTextEditor` (TipTap) instead of a plain `<textarea>`.
- G-3: The phone number field in the contact-info section is edited through
  `CountryCodeCombobox` (country picker + number) instead of a single `type="tel"`
  input with a static `"+54..."` placeholder, recomposing into the same string the
  backend expects.
- G-4: The amenities/features checklist in `AmenitiesFeaturesField.tsx` groups
  amenities into per-category `<details>` accordions (features stay a flat grid, same
  as the accommodation editor — features have no category field in either catalog).

## 4. Non-goals

- NG-1: **Do not** add a character counter to any accommodation field, and do not
  remove commerce's own counter. Commerce's `summary` field already has a live
  `aria-live="polite"` character counter (`CommerceListingEditor.client.tsx:658-666`,
  `commerce.owner.editor.validation.summaryHint`); the accommodation editor has none
  on any field (`BasicInfoSection.client.tsx` uses bare `maxLength` with no visible
  count). Commerce is ahead here — nothing to "fix down".
- NG-2: **Do not** replace commerce's `FieldError` usage with a hand-rolled pattern.
  Commerce already imports the shared `FieldError` / `fieldErrorId()` primitive
  (`apps/web/src/components/ui/FieldError.tsx`) throughout
  `CommerceListingEditor.client.tsx`. The accommodation editor mostly duplicates the
  `{errors.field && <p role="alert">...}` block by hand in each section file
  (`BasicInfoSection.client.tsx`, `LocationSection.client.tsx`,
  `ContactInfoSection.client.tsx`, `CapacitySection.client.tsx`, etc. — 27
  hand-rolled `role="alert"` blocks found); `CalendarProviderRow.client.tsx` is the
  one accommodation-editor file that already imports the shared `FieldError`. Commerce
  is ahead here too — do not backport the duplicated pattern.
- NG-3: No Leaflet/`LocationMap` integration for commerce. The commerce editor has no
  `lat`/`long`/coordinates fields and no map imports anywhere in
  `CommerceListingEditor.client.tsx` — gastronomy/experience listings do not carry
  their own coordinates in this editor (destination is picked from a list, not a
  point on a map). Nothing to add.
- NG-4: No `AiTextImprovePanel` wiring for commerce. Explicitly out of scope per the
  Linear issue — it needs an entitlement key scoped to the commerce verticals that
  does not exist yet (see Risks R-2).
- NG-5: No sticky section nav / scrollspy (`EditorSectionNav.client.tsx`). Blocked on
  HOS-258 (splitting the 1012-line monolith into per-section files, the same shape
  accommodation already has); tracked separately and explicitly deferred by the
  issue author.
- NG-6: No change to `AccommodationEditor.client.tsx`, `AccommodationEditor.module.css`,
  or `AccountSection.module.css` — those are the parity target, not a target of this
  work.
- NG-7: No entitlement/plan gating added around the commerce `RichTextEditor` usage.
  See Section 6 for why this is a deliberate design decision, not an oversight.

## 5. Current baseline

- `apps/web/src/components/commerce/CommerceListingEditor.client.tsx` (1012 lines,
  single file, both gastronomy and experience verticals) renders 13
  `<section className={styles.section}>` blocks directly as children of a `<form
  className={styles.editor}>` (name, destination, type, summary, description,
  richDescription, contactInfo, socialNetworks, openingHours, media, price fields,
  amenities/features).
- `apps/web/src/components/commerce/CommerceListingEditor.module.css` — `.editor` is a
  centered `max-width: 720px` column (`gap: var(--space-6)`), mirroring
  `AccommodationEditor.module.css`'s `.cardsColumn`. `.section` is bare
  (`border: none; margin: 0; padding: 0;` + flex/gap layout); `.label` has a
  `border-bottom: 1px solid var(--border)`. The file's header comment documents a
  prior deliberate low-level parity pass ("mirrors the visual language of the
  accommodation host editor... a centered reading column, section titles with a
  bottom divider, card-elevated inputs with a focus ring...") — but no `.card` class
  exists in this file today; nothing gives the `<section>` elements elevation.
- `apps/web/src/components/host/AccommodationEditor.module.css:54-56`:

  ```css
  .card {
      composes: card from "../account/AccountSection.module.css";
  }
  ```

  This is a **pure `composes`, no own declarations** — it re-exports
  `AccountSection.module.css`'s `.card` (and, via that, `.branded`) unchanged.
  `AccommodationEditor.client.tsx` applies `styles.card` directly on the outer
  `<section id="editor-X" className={styles.card} aria-label={...}>` that wraps each
  section sub-component (e.g. `<BasicInfoSection>`); the sub-component's own
  `.section` class (its own, separate CSS module) provides the internal
  flex/gap layout on a nested element — the two classes never collide because they
  live on different DOM nodes.
- `apps/web/src/components/account/AccountSection.module.css` — `.card` composes
  `.branded` (a `position: relative; overflow: hidden; isolation: isolate` with a
  `::before` 3px brand-gradient top bar) and adds
  `background-color: var(--core-card)`, `border: 1px solid var(--core-foreground-a08)`,
  `border-radius: var(--radius-card)`, `padding: var(--space-6, 24px)`,
  `box-shadow: 0 1px 2px var(--core-foreground-a05)`, plus a `:hover` shadow/border
  transition. `.cardTitle` is a separate class (heading + bottom-border + brand-dot
  bullet) — **not** composed by `AccommodationEditor.module.css`'s `.card`, and no
  host-editor section file uses it either; both editors keep their own label styling.
- `RichTextEditor.client.tsx` (TipTap v3 + `tiptap-markdown`, `client:only="react"`
  required — accesses `window` at init) persists content as a **Markdown string**.
  Props: `value: string`, `onChange: (value: string) => void`, `placeholder?`,
  `disabled?`, `hasError?`, `errorMessage?`. In the accommodation editor it is used
  for the **`description`** field (not a separate `richDescription` field) and is
  wrapped in `PlanEntitlementGate entitlementKey="can_use_rich_description"` with a
  plain `<textarea>` fallback for hosts without that entitlement
  (`BasicInfoSection.client.tsx:135-181`).
- `CountryCodeCombobox.client.tsx` props: `locale: SupportedLocale`, `id?`,
  `value: PhoneCountry`, `onChange: (country: PhoneCountry) => void`, `disabled?`. It
  only carries the **country**, not the number — `ContactInfoSection.client.tsx`
  (accommodation) pairs it with a separate number `<input>`, keeping
  `phoneCountry`/`phoneNumber` as two pieces of local state seeded via
  `parsePhoneValue(data.phone)` and recomposed into the single backend string via
  `composePhoneValue({ phoneCountry, number: value })` on every change
  (`@/lib/phone-countries` — `parsePhoneValue`/`composePhoneValue`).
- `AmenitiesSection.client.tsx` (accommodation) groups amenities into
  `AMENITY_CATEGORY_ORDER`-ordered `<details className={styles.categoryGroup}
  open={selectedCount > 0 || isFirstGroup}>` accordions, one per
  `AmenitiesTypeEnum` value plus an "Otros" catch-all, each with a `<summary>` showing
  the category label and a selected-count badge. Features render as a single flat
  `checkboxGrid` (no category field on features in either catalog).
- `AmenitiesFeaturesField.tsx` (commerce, shared by both verticals via
  `CommerceListingEditor.client.tsx:834-848`) renders two flat `<fieldset>` +
  `checkboxGrid` lists — amenities and features both ungrouped. It receives
  `amenities`, `features`, `selectedAmenityIds`/`selectedFeatureIds` (as `Set`s, not
  arrays like accommodation's `data.amenityIds`), toggle callbacks, `t`, and a
  `classes` prop (the parent's own CSS-module class map, reused rather than a private
  stylesheet).
- **`richDescription` data model** — `gastronomy.dbschema.ts:52` and
  `experiences.dbschema.ts:57` both declare `richDescription: text('rich_description')`
  (plain `text` column, same shape accommodation uses). Critically, **both verticals
  already render it as Markdown on the public pages**:
  `GastronomyDescription.astro` and `ExperienceInfo.astro` both call
  `renderContent({ raw: richDescription, siteOrigin: '' })` (the same Markdown→HTML
  renderer accommodation's `Description.astro` uses) whenever `richDescription` is
  present, falling back to the escaped plain-text `description` otherwise. This means
  swapping the commerce `richDescription` `<textarea>` for `RichTextEditor` (which
  also persists Markdown) is a **pure input-affordance change with no data migration**:
  existing plain-text values (no Markdown syntax) already round-trip through
  `renderContent` correctly today (plain text is valid Markdown), and newly-entered
  formatted content will render exactly as accommodation's does.
- **Entitlements do not currently apply to commerce.** `PlanEntitlementGate.client.tsx`
  gates on `useMyEntitlements()`, and per project convention (`loadEntitlements()`)
  entitlements are scoped to `product_domain = 'accommodation'` — commerce runs on a
  fully separate billing domain (`product_domain = 'commerce'`, isolated per
  `docs/decisions/ADR-035-commerce-core-gastronomy-separation.md`). A commerce-only
  owner has no accommodation subscription, so gating a commerce field behind
  `can_use_rich_description` (or any accommodation entitlement key) would show the
  fallback unconditionally, not a real gate. This is the same reason the issue defers
  `AiTextImprovePanel` (which needs "an entitlement key for the commerce verticals").
- **The `oklch(from` guard does exist**: `apps/web/scripts/check-css-relative-colors.cjs`,
  run as part of `pnpm --filter hospeda-web lint` (alongside `check-css-tokens.cjs`),
  not from `scripts/check-*.sh` at the repo root. Verified running green on
  2026-08-01: *"scanned 909 files, 29 allowlisted runtime-dynamic residual(s), 0 new
  `oklch(from` occurrences."*

  The allowlist is **count-pinned per file**, so it fails CI both on a NEW occurrence
  and on a removed one without updating the list. That is why the pattern still
  appears in production code (`lib/colors.ts`, `WaveHeader.astro`, …) while remaining
  closed to new uses. **This spec must not introduce any new `oklch(from`.**
- Existing tests: `apps/web/test/components/commerce/CommerceListingEditor.test.tsx`
  (22 `it()` blocks; already covers `richDescription` and `mobilePhone` field
  round-trips at the plain-input level) and
  `apps/web/test/components/host/editor/CountryCodeCombobox.test.tsx`. No existing
  test file for `AmenitiesFeaturesField.tsx`.

## 6. Proposed design

### 6.1 Card sections (G-1)

Add a `.card` class to `CommerceListingEditor.module.css`, mirroring
`AccommodationEditor.module.css:54-56` exactly:

```css
.card {
    composes: card from "../account/AccountSection.module.css";
}
```

Apply it alongside the existing `.section` class on each of the 13 `<section>`
elements. Because `.section` currently declares `margin: 0; padding: 0; border: none;`
— properties that also exist on the composed `.card` (`padding`, `border`) — combining
both classes on the *same* element is fragile: which rule wins for the overlapping
properties depends on final CSS bundle order, not on className order, unlike
`AccommodationEditor.client.tsx`'s pattern (which never combines them on one node —
`.card` lives on an outer wrapper, `.section` on an inner one, in two different CSS
Modules files).

Resolve this by **removing the now-redundant reset properties from `.section`**
(`margin: 0; padding: 0; border: none;`) rather than introducing an extra wrapper
element per section. A bare `<section>` tag has no default margin/padding/border in
the first place, so those three lines were only ever defensive/no-op resets — dropping
them leaves `.section` with just its layout properties (`display: flex;
flex-direction: column; gap: var(--space-3);`), which no longer overlaps with `.card`
at all. Then:

```tsx
<section className={cn(styles.section, styles.card)}>
```

(`cn` from `@/lib/cn`, not currently imported in this file — add the import.)

### 6.2 `richDescription` → `RichTextEditor` (G-2)

Replace the plain `<textarea id="ce-richDescription">`
(`CommerceListingEditor.client.tsx:702-719`) with `RichTextEditor`, wired the same way
`BasicInfoSection.client.tsx` wires it for `description` — controlled `value`/`onChange`
returning a Markdown string, `hasError`/`errorMessage` fed from `fieldErrors.richDescription`.

**Deliberately not** wrapped in `PlanEntitlementGate` (see Section 5 — entitlements
are accommodation-domain-only today; gating would either always lock commerce out or
require a commerce entitlement key that doesn't exist, which is explicitly the
`AiTextImprovePanel` follow-up the issue defers). `richDescription` becomes
unconditionally rich for every commerce owner. Because `RichTextEditor` requires
`client:only="react"` (it touches `window` on init) and `CommerceListingEditor.client.tsx`
already ships as a full React client component (not an Astro-hosted island with a
`client:*` directive per sub-field), no new SSR-safety wiring is needed beyond what the
page hosting `CommerceListingEditor` already does — verify the hosting `.astro` page
already mounts the whole editor with `client:only="react"` (or equivalent) before
implementation; if it does not, this needs the same directive `BasicInfoSection`'s
host page uses.

### 6.3 Phone field → `CountryCodeCombobox` (G-3)

Replace the single `<input type="tel" placeholder="+54...">`
(`CommerceListingEditor.client.tsx:726-739`) with the same
country-combobox + number-input pair `ContactInfoSection.client.tsx` uses:
`parsePhoneValue(contact.mobilePhone)` seeds local `phoneCountry`/`phoneNumber` state,
`CountryCodeCombobox` picks the country, a plain number `<input>` carries the rest, and
`composePhoneValue({ phoneCountry, number })` recomposes into the single string passed
to `updateContact({ mobilePhone: ... })` on every change — same shape the backend
already expects (no schema change).

### 6.4 Amenities/features accordions (G-4)

Extend `AmenitiesFeaturesField.tsx` to group its `amenities` prop by category using the
same `AMENITY_CATEGORY_ORDER` / `CATEGORY_LABELS` / "Otros" catch-all logic
`AmenitiesSection.client.tsx` implements (`groupAmenitiesByCategory`), rendered as
`<details>`/`<summary>` accordions with a selected-count badge, open when the group has
a selection or is the first group. `features` stays a flat grid (unchanged — neither
catalog gives features a category). Since `AmenitiesFeaturesField.tsx` takes selected
IDs as `ReadonlySet<string>` (not the array shape `AmenitiesSection` reads via
`data.amenityIds.includes(...)`), the grouping/selected-count helper needs to use
`.has()` against the sets rather than being copy-pasted verbatim — port the grouping
logic, not the component's array-shaped selection check.

## 7. Data model / contracts

No schema, API, or database changes. No new props on `RichTextEditor`,
`CountryCodeCombobox`, or the amenities catalog endpoints — all three are consumed
as-is. `AmenitiesFeaturesField.tsx`'s public prop contract is extended internally
(grouping happens inside the component from the existing `amenities` prop) rather than
requiring the parent to pass pre-grouped data — no change to
`CommerceListingEditor.client.tsx`'s call site props for `<AmenitiesFeaturesField>`.

## 8. UX / UI behavior

- Every commerce editor section gets the same elevated card look as accommodation:
  tokenized background/border/radius, subtle shadow, hover elevation, and the 3px
  brand-gradient top accent bar from `.branded`.
- `richDescription` gets the full TipTap toolbar (bold/italic/underline/H2/H3/lists/
  quote/link) instead of a bare textarea, unconditionally (no lock/upgrade nudge —
  see 6.2).
- The phone field shows a searchable country picker (flag + dial code) next to the
  number input instead of a single free-text field with a static placeholder.
- Amenities collapse into per-category accordions (open by default only for the first
  category or any category with an existing selection); features remain a flat list.
  Commerce's existing live character-counter and shared `FieldError` behavior are
  untouched (see Non-goals NG-1/NG-2).

## 9. Acceptance criteria

- AC-1: All 13 `<section>` elements in `CommerceListingEditor.client.tsx` render with
  the `.card` visual treatment (background, border, radius, shadow, top gradient bar)
  — verified visually in both light and dark theme, and by a test asserting the
  rendered section elements carry the composed card class.
- AC-2: `richDescription` is edited via `RichTextEditor` for both gastronomy and
  experience verticals; saving persists a Markdown string to the same
  `richDescription` field the API already accepts (no payload shape change).
  `fieldErrors.richDescription` (if the backend ever returns one) surfaces via
  `hasError`/`errorMessage`, matching the existing `FieldError`-driven pattern used
  elsewhere in this file.
- AC-3: The mobile-phone field is edited via `CountryCodeCombobox` + a number input;
  the value sent to `updateContact({ mobilePhone })` is the recomposed single string
  in the same format the backend already validates (verified by extending the
  existing `mobilePhone` round-trip test in `CommerceListingEditor.test.tsx`).
- AC-4: Amenities render as per-category `<details>` accordions with a selected-count
  badge, matching `AmenitiesSection.client.tsx`'s grouping/ordering; features remain a
  flat checkbox grid. Toggling a checkbox still calls the existing
  `onToggleAmenity`/`onToggleFeature` callbacks with the same `id` argument.
- AC-5: Commerce's live `aria-live` character counter on `summary` is unchanged and
  still present after the card-section refactor.
- AC-6: Commerce's `FieldError`/`fieldErrorId()` usage is unchanged — no field's error
  rendering is replaced by a hand-rolled `role="alert"` block.
- AC-7: No new `lat`/`long`/map-related code is introduced anywhere in the commerce
  editor or `AmenitiesFeaturesField.tsx`.
- AC-8: `pnpm --filter web typecheck`, `pnpm --filter web lint`, and
  `pnpm --filter web test` (scoped to the touched files) pass. No Tailwind classes, no
  hardcoded color/spacing literals, no new `oklch(...)`/`oklch(from ...)` value that
  isn't already a token reference.
- AC-9: `apps/web/test/components/commerce/CommerceListingEditor.test.tsx` is extended
  to cover the new `RichTextEditor`/`CountryCodeCombobox` wiring (at minimum: typing in
  the rich editor updates `richDescription`, picking a country + typing a number
  updates `mobilePhone` in the recomposed format), and a new test file is added for
  `AmenitiesFeaturesField.tsx`'s category grouping (none exists today).

## 10. Risks

- R-1: **CSS cascade fragility** when combining `.section` and `.card` on the same
  element (see 6.1). Mitigation: strip the redundant reset properties from `.section`
  so the two classes no longer set overlapping properties, rather than relying on
  bundle order.
- R-2: **No commerce entitlement key exists yet.** If a future spec ties
  `richDescription` (or any commerce field) to a paid tier, `RichTextEditor` will need
  re-gating once that key exists — tracked as a follow-up, not blocking this issue
  (see NG-4/NG-7 and OQ-1).
- R-3: `AmenitiesFeaturesField.tsx` takes `ReadonlySet<string>` selections while
  `AmenitiesSection.client.tsx`'s grouping helper assumes an array with `.includes()`
  — a naive copy-paste of `groupAmenitiesByCategory` would not compile / would
  silently always show `selectedCount: 0`. Mitigation: adapt the selected-count check
  to `.has()` explicitly (called out in 6.4), and cover it with a test.
- R-4: `RichTextEditor` needs `client:only="react"` (or to already run inside a
  fully-client component tree) because it touches `window` at init. If the page
  hosting `CommerceListingEditor` does not already satisfy this, TipTap will throw on
  SSR. Must be verified against the actual hosting `.astro` page before merging (see
  6.2 and OQ-3).

## 11. Open questions

- OQ-1: Should `richDescription` remain fully unconditional for every commerce owner
  regardless of plan, or does the owner want a placeholder gate now (e.g. behind a
  `commerce`-scoped entitlement key that doesn't exist yet, deferred until it does)?
  This spec assumes "unconditional for now" per Section 6.2's reasoning — confirm with
  the owner before implementation if that assumption is wrong.
- ~~OQ-2~~ **RESUELTA** (2026-08-01): el guard existe y corre —
  `apps/web/scripts/check-css-relative-colors.cjs`, invocado por el `lint` de
  `hospeda-web`, no desde `scripts/` en la raíz del repo. La allowlist está
  **fijada por conteo por archivo**, así que falla tanto ante una ocurrencia nueva
  como ante una eliminada sin actualizar la lista. Por eso el patrón sigue
  apareciendo en código de producción y a la vez está cerrado a usos nuevos. Ver
  §5. Esta spec no introduce ninguno.
- OQ-3: Which `.astro` page(s) mount `CommerceListingEditor`, and what `client:*`
  directive do they use today? Needed to confirm `RichTextEditor`'s `window`-at-init
  requirement (R-4) is already satisfied before implementation starts.

## 12. Implementation notes

- Read `apps/web/src/components/host/editor/ContactInfoSection.client.tsx` in full
  before touching the phone field — it's the exact recomposition pattern to replicate,
  including the lazy-initializer guard for an empty/undefined initial `data.phone`.
- Read `apps/web/src/components/host/editor/AmenitiesSection.client.tsx`'s
  `groupAmenitiesByCategory` function in full before touching
  `AmenitiesFeaturesField.tsx` — port the grouping/ordering logic, adapting only the
  selected-count check from `.includes()` to `.has()` per R-3.
- `AmenitiesFeaturesField.tsx` receives a `classes: Readonly<Record<string, string>>`
  prop (the parent's CSS-module map) rather than importing its own stylesheet —
  whatever new classes the accordion markup needs (`categoryGroup`, `categorySummary`,
  etc.) must be added to `CommerceListingEditor.module.css` and threaded through the
  same way, not introduced via a new/private module.
- Do not touch `AccommodationEditor.module.css`, `AccommodationEditor.client.tsx`, or
  `AccountSection.module.css` — read-only reference for this work.
- This issue is explicitly CSS/prop-wiring only per the Linear issue author ("cero
  lógica nueva, cero riesgo de regresión, mergeable solo") — do not fold in HOS-258's
  file-split or the sticky-nav follow-up.

## 13. Linear

Canonical tracking:
HOS-371
