---
title: Split CommerceListingEditor.client.tsx into section components
linear: HOS-258
statusSource: linear
created: 2026-08-01
type: chore
areas:
  - web
---

# Split CommerceListingEditor.client.tsx into section components

## 1. Summary

`apps/web/src/components/commerce/CommerceListingEditor.client.tsx` is a single
1012-line file (verified 2026-08-01; the issue was opened at 931 lines and has
kept growing) that owns all state, all handlers, and all field JSX for the
commerce owner's operational editor (gastronomy/experience). Split the JSX into
~7 section components under a new `apps/web/src/components/commerce/editor/`
directory, mirroring the established orchestrator/section pattern already used
by `apps/web/src/components/host/AccommodationEditor.client.tsx` +
`apps/web/src/components/host/editor/*`. This also unlocks reusing the
already-generic `EditorSectionNav.client.tsx` (sticky scrollspy nav), which is
impossible to wire onto a single monolithic form with no per-section anchors.

## 2. Problem

- `CommerceListingEditor.client.tsx` is over double the repo's documented
  500-line-per-file convention (`CLAUDE.md` → Coding Standards) and still
  growing (931 → 1012 lines across three prior specs that all added fields to
  the same file).
- All 7 field groups (identity/basic info, contact, social, opening hours,
  media, price, amenities) live in one component with one flat 18-entry
  `useState` block, one 100-line `buildPayload`, and no reusable per-section
  test seam — verified: `apps/web/test/components/commerce/CommerceListingEditor.test.tsx`
  is a single 22-`it()` file (628 lines) that has to stand up the entire form
  to test any one field group.
- The accommodation editor already solved this exact problem
  (`AccommodationEditor.client.tsx`, 731 lines, orchestrates 13 `<section>`
  cards backed by 26 `.client.tsx` files under `host/editor/`, with 201
  `it()` blocks across 19 dedicated section test files — see §5 for the exact
  counts). The commerce editor has no equivalent decomposition, so it cannot
  reuse `EditorSectionNav.client.tsx` (a sticky-nav UX improvement the owner
  has asked for — "que los forms de comercio se parezcan a los de
  alojamiento") without first having per-section DOM anchors (`id="editor-*"`)
  to scroll-spy against.
- Every future field addition (HOS-371 cards/rich-fields parity, any new
  commerce field) currently has nowhere to land except more lines in the same
  file.

## 3. Goals

- G-1: Extract the 7 field groups identified in the issue (BasicInfo, Contact,
  Social, Opening hours, Media, Price, Amenities) into standalone
  `.client.tsx` components under `apps/web/src/components/commerce/editor/`,
  each receiving `data`/`errors`/`onFieldChange`-shaped props (mirroring
  `BasicInfoSection.client.tsx`'s prop shape where the field semantics line
  up; grouped-value props where the orchestrator's existing per-group state
  already groups them — see §6).
- G-2: Reduce `CommerceListingEditor.client.tsx` to an orchestrator that owns
  state + handlers + payload building, and delegates all field rendering to
  the extracted sections — matching the documented pattern in
  `AccommodationEditor.client.tsx:3-10`.
- G-3: Reuse `EditorSectionNav.client.tsx` as-is (it is already generic — see
  §5) to add sticky scrollspy navigation to the commerce editor.
- G-4: Give every extracted section its own test file, preserving 100% of the
  existing payload-shape assertions in `CommerceListingEditor.test.tsx` (the
  guardrail against the `markDirty` risk in §10).
- G-5: Sequence the work as reviewable, independently-mergeable PRs (§12).

## 4. Non-goals

- NG-1: Rewriting the commerce CSS to give each section its own
  `.module.css` (the `host/editor/*` pattern). This split keeps every
  section consuming the single shared `CommerceListingEditor.module.css` via
  the existing `classes` prop convention (see §6 "CSS modules" and §11
  OQ-1 for why this is a recommendation, not a foregone conclusion).
- NG-2: Any visual/behavioral change to the commerce editor. This is a pure
  structural refactor — no new fields, no new validation, no copy changes.
- NG-3: HOS-371 (cards/rich fields visual parity with the accommodation
  editor) and HOS-372 (photo-loss bug) are explicitly out of scope — the
  issue lists both as independent and unblocked by this split.
- NG-4: HOS-373 (`beforeunload` guard, focus-first-invalid-field) — cross-
  cutting to both editors, tracked separately.
- NG-5: Refactoring the 18 individual `useState` calls into one consolidated
  `formData` object (the shape `AccommodationEditor.client.tsx` uses). See
  §6 for why this split keeps per-field/per-group `useState` as-is.
- NG-6: Making `CommerceListingEditor.client.tsx` (the orchestrator) fit
  under 500 lines. See §9 AC-2 and §10 R-3 for why that target is not
  realistic while preserving "one component owns all state" — the reference
  implementation itself (`AccommodationEditor.client.tsx`) is 731 lines.

## 5. Current baseline

### `CommerceListingEditor.client.tsx` — verified line ranges (2026-08-01, 1012 lines total)

| Lines | Content |
|---|---|
| 1–53 | File JSDoc + imports |
| 54–82 | `CommerceListingEditorProps` |
| 84–108 | `SaveStatus`, `ContactValues`, `SocialValues` types |
| 110–126 | `SOCIAL_KEYS`, `GASTRONOMY_TYPE_OPTIONS`, `EXPERIENCE_TYPE_OPTIONS`, `PRICE_UNIT_OPTIONS` |
| 128–150 | `patchPathFor`, `strField`, `nonEmpty` module-level helpers |
| 156–265 | Component body: schema pick, 18 `useState` calls (identity fields, contact, social, openingHours, price fields, media, amenity/feature id sets, i18n, dirty set, save status) |
| 268–341 | `markDirty`, `updateContact`, `updateSocial`, `updateMedia`, `toggleAmenity`, `toggleFeature`, `handleI18nChange` — all `useCallback` |
| 344–447 | `buildPayload` — reads `dirty.has('<group>')` per field group, builds the PATCH body |
| 449–493 | `handleSubmit` |
| 495–499 | `isSaving`, `canSave`, `typeOptions` derived values |
| **501–1012** | **JSX return — the 7 field groups, in this exact order and range:** |
| 508–532 | `name` input (identity) |
| 534–603 | `destinationId` select, with two error-state branches (`destinationsLoadFailed`, empty catalog) |
| 605–632 | `type` select |
| 634–671 | `summary` textarea + live char-count hint |
| 673–700 | `description` textarea |
| 702–719 | `richDescription` textarea |
| **721–761** | **Contact `<fieldset>`** — mobilePhone + workEmail |
| **763–791** | **Social `<fieldset>`** — 6 URL inputs looped over `SOCIAL_KEYS` |
| **793–809** | **Opening hours `<section>`** — wraps `OpeningHoursField` |
| **811–824** | **Media `<section>`** — wraps `MediaField` |
| 826–831 | `CommerceTranslationPanel` (i18n) — **already extracted, not part of this split** |
| **833–846** | **Amenities/features `<section>`** — conditionally-rendered wrapper around `AmenitiesFeaturesField` |
| **848–982** | **Price `<section>`** — vertical-branched: gastronomy (`priceRange` + `menuUrl`, 849–899) vs experience (`isPriceOnRequest` + `priceFrom` + `priceUnit`, 900–981) |
| 984–1009 | Form-level error banner + cancel/save actions |

The 508–719 range (name/destinationId/type/summary/description/richDescription)
is one contiguous "BasicInfo" block — matching the issue's field-group list —
even though the file's own header comment (lines 11–22) breaks it into finer
T-0xx sub-groups from prior specs; those sub-groups do not need separate
components.

**Lines 1–499 are pure state/logic, not JSX** — this is the reason the
orchestrator cannot realistically end up under 500 lines post-split (§10 R-3).

### The target pattern: `AccommodationEditor.client.tsx` + `host/editor/`

- `AccommodationEditor.client.tsx` is **731 lines** (verified — itself over
  the 500-line convention). Its JSDoc (lines 3–10) states the pattern this
  split follows: *"one component owns all state + handlers, delegates
  rendering to section subcomponents"*.
- It renders 13 `<section id="editor-*">` cards (`basicInfo`, `capacity`,
  `pricing`, `location`, `contact`, `socialNetworks`, `amenities`, `photos`,
  `calendar`, optionally `translations`, `externalReputation`, plus
  `FeaturedToggleSection` unwrapped and `ActionBar`), each wrapped exactly
  like:

  ```tsx
  <section id="editor-basicInfo" className={styles.card} aria-label={sectionLabels.basicInfo}>
      <BasicInfoSection locale={locale} data={formData} destinations={destinations} errors={fieldErrors} onFieldChange={handleTextFieldChange} />
  </section>
  ```

- `apps/web/src/components/host/editor/` contains **26 `.tsx`/`.client.tsx`
  files** (verified via `ls`), not all of them top-level sections — several
  are sub-widgets a section composes internally (`CalendarDayCell`,
  `CalendarProviderRow`, `CalendarSyncLauncher/Message/Panel`,
  `CountryCodeCombobox`, `LocationPickerMap`, `OccupancyEventEditDialog`,
  `RichTextEditor`, `AiTextImprovePanel`, `PlanEntitlementGate`). The
  top-level sections `AccommodationEditor` actually mounts are 13, matching
  the table above.
- `BasicInfoSection.client.tsx` (299 lines) is the reference prop shape:

  ```ts
  export interface BasicInfoSectionProps {
      readonly locale: SupportedLocale;
      readonly data: AccommodationEditData;
      readonly destinations: readonly DestinationData[];
      readonly errors: Readonly<{ name?: string; summary?: string; description?: string; type?: string; destinationId?: string }>;
      readonly onFieldChange: (field: keyof AccommodationEditData, value: string) => void;
  }
  ```

  One `data` object (a slice of the orchestrator's single `formData` state),
  one `errors` object, one **generic** `onFieldChange(field, value)` callback
  the section calls per input's `onChange` — the orchestrator owns a single
  `setFormData(prev => ({ ...prev, [field]: value }))` dispatcher
  (`handleTextFieldChange` in `AccommodationEditor.client.tsx:254-260`).
- `EditorSectionNav.client.tsx` (153 lines) is confirmed generic: its props
  are exactly
  `{ locale: SupportedLocale; sections: readonly { id: string; label: string }[] }`
  — no accommodation-specific types, data, or imports anywhere in the file.
  It IntersectionObserver-scrollspies the DOM elements matching each
  `section.id` and renders an `<a href="#{id}">` per entry with
  `aria-current` on the active one. It can be mounted for commerce with zero
  changes, given a `sections` array built the same way
  `AccommodationEditor.client.tsx:502-522` builds `navSections`.

### The three existing commerce field widgets (NOT sections — do not re-extract)

`AmenitiesFeaturesField.tsx`, `MediaField.tsx`, and `OpeningHoursField.tsx`
already exist in `commerce/` (not `commerce/editor/`) and are genuine
leaf-level controlled widgets, not page sections. All three take a
`classes: Readonly<Record<string, string>>` prop and use it as
`classes.section` / `classes.label` / `classes.input` / etc. — verified in
each file. Today the orchestrator passes its own `styles` object
(`import styles from './CommerceListingEditor.module.css'`) as `classes`.
`CommerceListingEditor.module.css` (326 lines, verified) already defines
every class these three widgets reference (`.section`, `.label`, `.input`,
`.textarea`, `.checkbox`, `.days`/`.day`/`.dayLabel`/`.shift`, `.media*`,
`.catalog*`, `.actions`, `.save`, `.cancel`, `.success`, `.error`, `.hint`).

### Test baseline (verified counts, 2026-08-01)

| Directory | Files | `it()` blocks |
|---|---|---|
| `apps/web/test/components/commerce/` | 6 | **68** (matches the issue's figure) — `CommerceListingEditor.test.tsx` alone: 22, in 628 lines |
| `apps/web/test/components/host/editor/` | 19 | **201** (counted with `grep -E '^\s*it\('`) |
| `apps/web/test/components/host/AccommodationEditor.test.tsx` (orchestrator, sits outside `editor/`) | 1 | 22, in 703 lines |

Note: the issue's description cites "287" tests for the accommodation editor.
The verified count restricted to `host/editor/` + the orchestrator test is
201 + 22 = 223; the full `host/` test directory (including non-editor
dashboard/promotion components unrelated to this split) sums to 453 `it()`
blocks. The exact provenance of "287" could not be reconstructed from the
current tree — flagged as OQ-4, not load-bearing for this spec (the
directional point — many small per-section test files beat one 628-line
file — holds regardless of the exact figure).

`CommerceListingEditor.test.tsx` already asserts the **exact PATCH body**
per field group for most groups (e.g. `expect(mockPatch).toHaveBeenCalledWith({ path: ..., body: { richDescription: 'new text' } })`) — this is the existing regression net for the `markDirty`/`buildPayload` contract (see §10 R-3).

## 6. Proposed design

### 6.1 New files

All new files live in `apps/web/src/components/commerce/editor/` (new
directory, mirroring `host/editor/`). Recommended name, source line range
extracted, and prop shape:

1. **`BasicInfoSection.client.tsx`** — name (508–532), destinationId incl.
   both error branches (534–603), type (605–632), summary incl. hint
   (634–671), description (673–700), richDescription (702–719).
   Props:

   ```ts
   interface CommerceBasicInfoSectionProps {
       readonly t: Translate;
       readonly typeOptions: readonly string[]; // orchestrator resolves gastronomy vs experience once, passes the resolved list down
       readonly typeOptionLabelPrefix: 'commerce.owner.editor.typeOption'; // or hardcode the key inside the section — orchestrator no longer needs to know it
       readonly destinations: readonly DestinationOption[];
       readonly destinationsLoadFailed: boolean;
       readonly values: { name: string; destinationId: string; type: string; summary: string; description: string; richDescription: string };
       readonly errors: Readonly<{ name?: string; destinationId?: string; summary?: string; description?: string }>;
       readonly onFieldChange: (field: 'name' | 'destinationId' | 'type' | 'summary' | 'description' | 'richDescription', value: string) => void;
   }
   ```

2. **`ContactSection.client.tsx`** — 721–761. Props: `values: ContactValues`,
   `errors` (the two `contactInfo.*` keys), `onChange: (patch: Partial<ContactValues>) => void` (reuses the orchestrator's existing `updateContact` signature verbatim — no new dispatcher needed), `t`.
3. **`SocialSection.client.tsx`** — 763–791, owns the `SOCIAL_KEYS` constant
   (moved from the orchestrator, it is only ever consumed here). Props:
   `values: SocialValues`, `errors`, `onChange: (key: keyof SocialValues, val: string) => void` (reuses `updateSocial` verbatim), `t`.
4. **`OpeningHoursSection.client.tsx`** — 793–809, thin wrapper around the
   existing `OpeningHoursField` widget. Props: `value: OpeningHours | null`,
   `error: string | undefined`, `onChange: (next: OpeningHours) => void`
   (reuses the inline handler verbatim), `classes`, `t`.
5. **`MediaSection.client.tsx`** — 811–824, thin wrapper around `MediaField`.
   Props: `vertical`, `listingId`, `featuredImage`, `gallery`,
   `onChange: (next) => void` (reuses `updateMedia` verbatim), `classes`, `t`.
6. **`AmenitiesFeaturesSection.client.tsx`** — 833–846, thin wrapper around
   `AmenitiesFeaturesField`, keeping the self-hiding guard
   (`amenities.length > 0 || features.length > 0`) inside this component
   (mirrors `FeaturedToggleSection.client.tsx`'s self-hide pattern on the
   host side). Props: `amenities`, `features`, `selectedAmenityIds`,
   `selectedFeatureIds`, `onToggleAmenity`, `onToggleFeature` (reuse
   `toggleAmenity`/`toggleFeature` verbatim), `classes`, `t`.
7. **`PricingSection.client.tsx`** — 848–982, the vertical-branched block.
   Props:

   ```ts
   interface CommercePricingSectionProps {
       readonly vertical: CommerceVertical;
       readonly values: { priceRange: string; menuUrl: string; isPriceOnRequest: boolean; priceFrom: number | null; priceUnit: string };
       readonly errors: Readonly<{ menuUrl?: string; priceFrom?: string; priceUnit?: string }>;
       readonly onFieldChange: (field: 'priceRange' | 'menuUrl' | 'isPriceOnRequest' | 'priceFrom' | 'priceUnit', value: string | boolean | number | null) => void;
       readonly t: Translate;
   }
   ```

None of these 7 are net-new logic — every `onChange` body already exists in
the orchestrator today (either as a named `useCallback` like `updateContact`,
or as an inline closure around `setX` + `markDirty(...)`). The only new code
is: (a) the 6 tiny prop interfaces above, (b) two small generic dispatchers
in the orchestrator (`handleBasicInfoFieldChange`,
`handlePricingFieldChange`) that `switch`/`if` on the field name and call the
matching existing setter + `markDirty`, replacing the inline closures that
currently live directly in the JSX being removed.

### 6.2 What stays in the orchestrator

`CommerceListingEditor.client.tsx` keeps, unchanged: all 18 `useState`
calls, `markDirty`, `buildPayload`, `handleSubmit`, the `schema` pick, and
`patchPathFor`/`strField`/`nonEmpty`. It gains: the two small dispatcher
functions from §6.1, a `sectionLabels`/`navSections` `useMemo` pair (mirrors
`AccommodationEditor.client.tsx:482-522`), and a JSX shell that renders
`EditorSectionNav` + one `<section id="editor-*">` per group + the
already-extracted `CommerceTranslationPanel` + the form-error banner +
actions (actions block, 984–1009, is 26 lines — left inline; extracting an
`ActionBar` clone is optional polish, not required for any AC).

### 6.3 CSS modules — recommendation (see OQ-1)

**Recommended: keep the single shared `CommerceListingEditor.module.css`**,
imported once in the orchestrator and threaded down as a `classes` prop to
every new section — the exact convention `AmenitiesFeaturesField`/
`MediaField`/`OpeningHoursField` already use today. Rationale: the module
already contains every class every section needs (verified in §5); splitting
it into 7 per-section `.module.css` files is a second, independent refactor
(class renames, import updates, risk of visual drift) that the issue frames
as *"hay que decidir"*, not *"hay que hacer"* — doing it here would conflate
two unrelated risks in one PR. `host/editor/`'s per-section CSS modules are
the more isolated long-term shape, but adopting it is better scoped to
HOS-371 (which is already about visual parity with the accommodation
editor's card styling) than bundled into a line-count-driven split.

### 6.4 Section nav wiring

```tsx
const navSections = useMemo<EditorSectionNavItem[]>(() => [
    { id: 'editor-basicInfo', label: sectionLabels.basicInfo },
    { id: 'editor-contact', label: sectionLabels.contact },
    { id: 'editor-social', label: sectionLabels.social },
    { id: 'editor-openingHours', label: sectionLabels.openingHours },
    { id: 'editor-media', label: sectionLabels.media },
    { id: 'editor-amenities', label: sectionLabels.amenities },
    { id: 'editor-pricing', label: sectionLabels.pricing }
], [sectionLabels]);
```

`CommerceTranslationPanel` is intentionally left out of `navSections` in this
draft ordering — it renders inline between Media and Amenities today (line
826) and is not one of the 7 groups the issue lists; whether it gets its own
nav entry is a small follow-up decision, not blocking (note as OQ-3).

## 7. Data model / contracts

No backend/schema changes. No new API calls, no new payload shape. The PATCH
endpoint (`patchPathFor`), the request schema
(`GastronomyOwnerUpdateInputSchema` / `ExperienceOwnerUpdateInputSchema`),
and `buildPayload`'s output are byte-for-byte unchanged — this is a pure
presentation-layer refactor.

## 8. UX / UI behavior

No visible change except the addition of the sticky scrollspy nav
(`EditorSectionNav`) on the two-column breakpoint, matching the
accommodation editor's existing UX. Field order, labels, validation
messages, and error placement are unchanged.

## 9. Acceptance criteria

- AC-1: `apps/web/src/components/commerce/editor/` exists with the 7 section
  files listed in §6.1, each ≤500 lines (verifiable: `wc -l` on each file).
- AC-2: `CommerceListingEditor.client.tsx` shrinks from 1012 lines to
  something in the same order of magnitude as `AccommodationEditor.client.tsx`
  (731 lines) — NOT a hard <500 target (see NG-6/R-3). The PR description
  must state the final line count.
- AC-3: Every extracted section has its own test file under
  `apps/web/test/components/commerce/editor/`, and the existing 22 `it()`
  blocks in `CommerceListingEditor.test.tsx` are preserved — either kept
  as orchestrator-level integration tests (submit flow, dirty-tracking,
  cross-field payload assembly) or ported into the relevant section's test
  file, with no net loss of payload-shape assertions.
- AC-4: `pnpm test --filter web -- commerce` (or the equivalent scoped
  vitest run) is green after each PR in the sequence (§12) — this is a
  behavior-preserving refactor, not a rewrite.
- AC-5: The editor still performs exactly one `PATCH` per submit, to the
  same `patchPathFor` endpoint, with the same dirty-diff payload shape —
  verified by the existing `toHaveBeenCalledWith({ path, body })`
  assertions continuing to pass unmodified in intent (they may move files).
- AC-6: `EditorSectionNav` renders on the commerce editor with one entry per
  section in §6.4, using the component **unmodified** (no commerce-specific
  fork or prop added to `EditorSectionNav.client.tsx`).
- AC-7: `pnpm typecheck` and `pnpm lint` are clean on every new/changed file.
- AC-8: No behavior, copy, or validation-message change — a manual smoke of
  the commerce owner editor (`/mi-cuenta/comercio`) after the final PR
  confirms every field group still loads its seeded value and saves
  correctly for both `gastronomy` and `experience` verticals.

## 10. Risks

- R-1: **`markDirty`'s `Set<string>` is stringly-typed and split across two
  call sites that must agree by hand.** `dirty` (line 265) is a
  `ReadonlySet<string>` of field-*group* names (`'name'`, `'contactInfo'`,
  `'socialNetworks'`, `'openingHours'`, `'media'`, `'amenityIds'`,
  `'featureIds'`, `'priceRange'`, `'menuUrl'`, `'isPriceOnRequest'`,
  `'priceFrom'`, `'priceUnit'`, `'type'`, `'summary'`, `'description'`,
  `'destinationId'`, `'richDescription'`, `'i18n'`). Every one of these
  string literals is written twice today: once at a `markDirty('X')` call
  site (currently inline inside the JSX being extracted) and once inside
  `buildPayload`'s `dirty.has('X')` check (staying in the orchestrator).
  Nothing ties the two together — they are plain string literals, not a
  shared `const`/enum, so TypeScript cannot catch a mismatch. **Concrete
  failure mode when moving fields into section components**: if a section's
  `onFieldChange` dispatcher (or a copy-pasted `markDirty(...)` call) uses a
  different string than what `buildPayload` checks for — a typo, a
  copy-paste from the wrong field, or a forgotten call entirely — the field
  edit updates local state and the input visibly changes, but the field
  silently never enters the PATCH payload. No compile error, no runtime
  error, no thrown exception. The owner sees "Cambios guardados" and the
  edit is lost. This is exactly the shape of bug the existing
  `toHaveBeenCalledWith({ body: {...} })` assertions in
  `CommerceListingEditor.test.tsx` are built to catch — AC-3/AC-5 require
  preserving every one of them through the split.
  **Mitigation recommended for the implementation** (not required by any AC,
  but strongly suggested): factor the field-group name literals into one
  shared `const` object/union (e.g. `DIRTY_GROUPS.name`,
  `DIRTY_GROUPS.contactInfo`, ...) imported by both the orchestrator's
  dispatchers and `buildPayload`, so a typo becomes a compile error instead
  of a silent payload gap.
- R-2: Splitting a 22-`it()` file that already runs the full form (seeding
  20+ `initialData` fields per test) into 7 section-scoped files risks
  duplicated or drifted test setup/fixtures if each new file re-derives its
  own `initialData` shape independently. Recommend extracting one shared
  fixture builder (mirrors how `host/editor/*.test.tsx` files likely share
  fixtures — verify during implementation) rather than copy-pasting the
  orchestrator test's setup into all 7 new files.
- R-3: The orchestrator will NOT end up under the repo's 500-line
  convention even after a clean split — §5 shows lines 1–499 are pure
  state/logic with zero JSX, and the reference pattern
  (`AccommodationEditor.client.tsx`) itself sits at 731 lines. Framing AC-2
  as a hard <500 target would set the PR up to either fail the AC or force
  an unwanted second refactor (splitting state itself, which is NG-5,
  explicitly out of scope). AC-2 is worded as "same order of magnitude as
  the reference file" to avoid this trap.
- R-4: `AmenitiesFeaturesField`/`MediaField`/`OpeningHoursField` all
  currently receive `classes={styles}` where `styles` is the orchestrator's
  full CSS module object. If the new wrapper sections (OpeningHoursSection,
  MediaSection, AmenitiesFeaturesSection) receive a *different* `classes`
  object (e.g. their own, per §6.3's non-recommended alternative) while
  still forwarding it into these three widgets, the widgets would break
  silently at runtime (missing classNames render unstyled, not a crash) —
  another reason §6.3 recommends keeping one shared CSS module for now.

## 11. Open questions

- OQ-1: **CSS modules — confirm §6.3's recommendation** (keep one shared
  `CommerceListingEditor.module.css`, threaded via `classes` prop, matching
  today's convention for the 3 existing field widgets) versus giving each
  new section its own `.module.css` like `host/editor/`. The issue
  explicitly flags this as undecided ("hay que decidir"). Needs an explicit
  owner/reviewer confirmation before implementation starts, even though this
  spec has a recommendation.
- OQ-2: Should `EditorSectionNav`'s addition (G-3) ship in the same PR as
  the final section extraction, or as an immediate follow-up PR? The issue
  says "va como parte de este issue o como follow-up inmediato" — leaving
  the choice open. §12's phasing puts it last, as its own small PR, so it
  can be dropped without blocking the core split if reviewers want the nav
  addition scoped to its own review.
- OQ-3: Should `CommerceTranslationPanel` (i18n) get a `navSections` entry
  once the nav exists? Not one of the issue's 7 groups; low-stakes, can be
  decided at PR-6 (nav) review time.
- OQ-4: The issue's description cites 287 tests for the accommodation
  editor; the verified count for `host/editor/` + its orchestrator test is
  223 (201 + 22), and the full `host/` test directory (including unrelated
  dashboard/promotion components) is 453. Not load-bearing for this spec,
  but flagging the discrepancy in case "287" was meant to scope something
  more specific that should inform the commerce split's target test count.

## 12. Implementation notes

Suggested PR sequence — each is independently reviewable and leaves the app
in a working, fully-tested state:

1. **PR 1 — scaffolding + first section (BasicInfo).** Create
   `commerce/editor/`, extract `BasicInfoSection.client.tsx` (the largest,
   riskiest group — doing it first surfaces any pattern mismatch early),
   wire its `onFieldChange` dispatcher, port/write its test file. Orchestrator
   still renders the other 6 groups inline.
2. **PR 2 — Contact + Social.** Both are simple `Partial<T>`-patch sections
   reusing `updateContact`/`updateSocial` verbatim; low risk, bundle together.
3. **PR 3 — Opening hours + Media.** Both are thin wrappers around existing
   field widgets; mechanical.
4. **PR 4 — Amenities/features.** Thin wrapper, self-hiding guard preserved.
5. **PR 5 — Pricing.** Last because it is the only section with vertical
   branching (gastronomy vs experience) — reviewers can compare it directly
   against the fully-settled pattern from PRs 1–4.
6. **PR 6 — `EditorSectionNav` wiring.** Only after all 7 sections exist and
   have their `id="editor-*"` anchors; adds `navSections`/`sectionLabels`
   and mounts the nav. Can be dropped/deferred per OQ-2 without blocking
   PRs 1–5.

Each PR should end with `CommerceListingEditor.client.tsx`'s line count and
the new section's line count stated in the PR description (AC-1/AC-2 are
directly verifiable that way). Per repo convention, every PR targets
`staging`, titled `[HOS-258] refactor(web): extract <section> from
CommerceListingEditor` (or similar), and only the final PR (PR 6, or PR 5 if
OQ-2 defers the nav) should carry `Closes HOS-258` in its body.

## 13. Linear

Canonical tracking:
HOS-258
