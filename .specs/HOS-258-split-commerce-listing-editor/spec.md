---
title: Split CommerceListingEditor.client.tsx into sections (host-editor parity)
linear: HOS-258
statusSource: linear
created: 2026-08-02
type: chore
areas:
  - web
---

# Split CommerceListingEditor.client.tsx into sections (host-editor parity)

## 1. Summary

`apps/web/src/components/commerce/CommerceListingEditor.client.tsx` is a single
1012-line component. The accommodation editor, with a comparable field surface,
is a 731-line orchestrator plus a directory of section components.

The visible difference is file size. The load-bearing difference is **state
architecture**: the accommodation editor owns one `formData` object and hands
every section the same generic `onFieldChange(field, value)`; the commerce editor
owns 18 independent `useState` slots and a manually-marked `Set<string> dirty`.
Sections cannot be extracted into the accommodation shape until that is
reconciled.

The work is therefore split into **two sequential PRs**:

- **PR 1 — state consolidation.** Collapse the 18 `useState` into one
  `CommerceEditData` object plus a `baseline` snapshot, replace the 6 ad-hoc
  handlers with a generic change API. **The JSX is not touched** and the 22
  existing orchestrator tests must pass unmodified.
- **PR 2 — section extraction.** Move the JSX into `commerce/editor/*.client.tsx`
  section components, each taking `data` / `errors` / `onFieldChange`. **The
  rendered DOM does not change**, so the same 22 tests must still pass
  unmodified, and each section gains its own test file.

Sticky section navigation is explicitly deferred (see OQ-2).

## 2. Problem

Verified against the code on 2026-08-02 (worktree cut from `origin/staging`):

|  | commerce | accommodation |
| --- | --- | --- |
| orchestrator | 1012 lines, single file | 731 lines + section directory |
| section components | 1 (`CommerceTranslationPanel`) | 10 |
| form state | 18 `useState` + `Set<string> dirty` | 1 `formData` + `baseline` diff |
| change handlers | 6 bespoke (`updateContact`, `updateSocial`, …) | 3 generic (`handleTextFieldChange`, …) |
| section navigation | none — one continuous scroll column | `EditorSectionNav` with `IntersectionObserver` scrollspy |
| tests | 68 across 6 files, all mounting the whole form | 274 across 23 files, one per section |

The 68-vs-274 test gap is a **consequence**, not an independent shortfall. Every
commerce test mounts the entire editor, so a test for one field pays the setup
cost of all eighteen. Sections that are separately mountable are separately
testable; that is the whole mechanism behind the accommodation editor's coverage.

Two secondary effects:

- The editor keeps growing. It was 931 lines when HOS-258 was filed
  (2026-07-23) and is 1012 today.
- Sticky section navigation — the single most noticeable usability gap versus the
  accommodation editor — is blocked. `EditorSectionNav.client.tsx` is already
  generic and needs no adaptation, but it needs `<section id=…>` anchors that do
  not exist yet.

### Corrections to the Linear issue description

Both were verified; the issue text is wrong on these points and should not be
followed literally:

1. The issue cites `AccommodationEditor.client.tsx:3-10` under
   `apps/web/src/components/host/editor/`. **That path does not exist.** The
   orchestrator is at `apps/web/src/components/host/AccommodationEditor.client.tsx`
   (731 lines), one level above `editor/`. The `editor/` directory holds only the
   sections and sub-widgets it imports.
2. The issue says the 500-line cap is not enforced in CI. Confirmed — and the
   reference implementation exceeds it too (731 lines). **"Orchestrator under 500
   lines" is not an acceptance criterion in this spec** (see NG-1).

The issue's test counts (68 commerce / 274 accommodation) were re-counted by hand
and are **correct**.

## 3. Goals

- **G-1** — Commerce editor state uses one `formData` object plus a `baseline`
  snapshot, matching the accommodation orchestrator's model.
- **G-2** — Field changes flow through a small generic change API instead of 6
  bespoke handlers, so section components share one prop contract.
- **G-3** — The editor JSX lives in `commerce/editor/*.client.tsx` section
  components taking `data` / `errors` / `onFieldChange`.
- **G-4** — Each section has its own test file that mounts that section alone.
- **G-5** — The PATCH payload contract is preserved **byte for byte** across both
  PRs, including the per-vertical `null`-vs-`undefined` distinction and the
  grouped-object shapes (see §7).
- **G-6** — Rendered DOM is unchanged by both PRs: the 22 existing orchestrator
  tests pass without modification at the end of each.
- **G-7** — Every section renders a stable `<section id="editor-…">` anchor, so
  `EditorSectionNav` can be wired in without further structural work.

## 4. Non-goals

- **NG-1** — Getting the orchestrator under 500 lines. Lines 1-499 are state and
  logic with no JSX; extracting every section does not by itself bring it under
  the cap, and the reference implementation does not meet it either.
- **NG-2** — Sticky section navigation. Anchors ship here (G-7), the nav does not
  (OQ-2).
- **NG-3** — Any visual or behavioral change to the editor. This is a structural
  refactor; a user must not be able to tell the difference.
- **NG-4** — `beforeunload` on unsaved changes and focus-to-first-invalid-field.
  That is HOS-373, transversal to both editors.
- **NG-5** — Card-per-section visual parity and rich fields. That is HOS-371,
  independent and mergeable before or after this work.
- **NG-6** — Fixing the media-association-on-save bug. That is HOS-372 and touches
  the backend.
- **NG-7** — `CommerceCreateForm.client.tsx` (a separate 20 KB component with its
  own state) is out of scope.
- **NG-8** — The apparently-orphaned `host/editor/LocationSection.client.tsx` is
  noted in §12 but not touched here.

## 5. Current baseline

### 5.1 Component under change

`apps/web/src/components/commerce/CommerceListingEditor.client.tsx` — 1012 lines.

Props (lines 54-82):

```ts
readonly vertical: CommerceVertical;          // 'gastronomy' | 'experience'
readonly listingId: string;
readonly locale: SupportedLocale;
readonly initialData: CommerceListingDetail;
readonly amenities?: readonly AmenityData[];
readonly features?: readonly AmenityData[];
readonly destinations?: readonly DestinationOption[];
readonly destinationsLoadFailed?: boolean;
```

State (18 `useState`, lines 193-266): `name`, `destinationId`, `description`,
`listingType`, `summary`, `richDescription`, `contact` (object),
`social` (object), `openingHours`, `priceRange`, `menuUrl`, `isPriceOnRequest`,
`priceFrom`, `priceUnit`, `featuredImage`, `gallery`, `preservedMedia`,
`amenityIds` (Set), `featureIds` (Set), `i18nValues`, plus `dirty` (Set) and
`status`. `fieldErrors` / `formError` come from the shared `useZodForm` primitive
(line 180), not from local state.

Handlers: `markDirty` (268-275), `updateContact` (277-283), `updateSocial`
(285-291), `updateMedia` (293-300), `toggleAmenity` (302-316), `toggleFeature`
(318-332), `handleI18nChange` (335-341), `buildPayload` (344-447, 19 deps),
`handleSubmit` (449-493).

JSX blocks, with the section component each becomes in PR 2:

| Lines | Block | Target component |
| --- | --- | --- |
| 509-532 | Name | `BasicInfoSection` |
| 538-603 | Destination (3 mutually exclusive branches) | `BasicInfoSection` |
| 605-632 | Type | `BasicInfoSection` |
| 634-671 | Summary | `BasicInfoSection` |
| 673-700 | Description | `BasicInfoSection` |
| 702-719 | Rich description | `BasicInfoSection` |
| 721-761 | Contact | `ContactSection` |
| 763-791 | Social networks | `SocialNetworksSection` |
| 793-809 | Opening hours | `OpeningHoursSection` |
| 811-824 | Media | `MediaSection` |
| 826-831 | Translations | `CommerceTranslationPanel` (already extracted) |
| 833-846 | Amenities / features | `AmenitiesSection` |
| 848-982 | Price (gastronomy ⟂ experience ternary) | `PriceSection` (OQ-1) |
| 984-991 | Form error banner | stays in orchestrator |
| 993-1009 | Actions (cancel / save) | stays in orchestrator |

### 5.2 Reference implementation

`apps/web/src/components/host/AccommodationEditor.client.tsx`, header comment
(lines 1-10):

> Manages form state with useState per field, renders section subcomponents,
> handles field changes, and implements submit with validation + API call.
> Follows the ProfileEditForm.client.tsx orchestrator pattern: one component
> owns all state + handlers, delegates rendering to section subcomponents.

Its state model (lines 235-249): `formData` plus a **mutable** `baseline`
resynced after every successful save. The inline comment on lines 236-241 records
why the baseline is mutable rather than the load-time prop — diffing against
`initialData` meant reverting a just-saved field produced an empty diff while the
DB still held the new value, so the change could not be undone without a reload
(HOS-190 F6). **PR 1 must reproduce this resync, not just the diff.**

Its change API (lines 254-276): `handleTextFieldChange`,
`handleNumberFieldChange`, `handleCurrencyFieldChange` — all
`(field, value) => setFormData(prev => ({...prev, [field]: value}))` plus
`clearError(...)`. One handler instance is shared across BasicInfo, ContactInfo
and SocialNetworks.

Representative section contract (`BasicInfoSection.client.tsx`, lines 17-29):

```ts
export interface BasicInfoSectionProps {
    readonly locale: SupportedLocale;
    readonly data: AccommodationEditData;
    readonly destinations: readonly DestinationData[];
    readonly errors: Readonly<{ name?: string; summary?: string; /* … */ }>;
    readonly onFieldChange: (field: keyof AccommodationEditData, value: string) => void;
}
```

Three properties of that contract to copy deliberately: the section receives the
**whole** `data` object (not per-field value/setter pairs); `errors` is a
**typed slice**, not the whole `Record<string, string>`; and the section imports
its own CSS module rather than receiving a `classes` prop.

### 5.3 Shared widgets

`AmenitiesFeaturesField.tsx`, `MediaField.tsx` and `OpeningHoursField.tsx` each
take a `classes: Readonly<Record<string, string>>` prop pointing at the parent's
CSS module. Verified: **`CommerceListingEditor.client.tsx` is the only consumer of
all three** — `CommerceCreateForm.client.tsx` does not import them. Their props
can be changed freely; the only other caller to update is
`apps/web/test/components/commerce/MediaField.test.tsx` (4 tests).

### 5.4 CSS

`CommerceListingEditor.module.css` — 240 lines, one module for the whole
component. Its header notes it "mirrors the visual language of the accommodation
host editor". Class groups:

- **shared across sections**: `.section`, `.label`, `.input`, `.textarea`,
  `.checkbox`, `.error`, `.hint`
- **`OpeningHoursField` only**: `.days`, `.day`, `.dayLabel`, `.shift`
- **`MediaField` only**: `.media`, `.mediaGroup`, `.mediaGallery`, `.mediaThumb`,
  `.mediaImage`, `.mediaRemove`, `.mediaAdd`, `.mediaHint`, `.mediaFileInput`
- **`AmenitiesFeaturesField` only**: `.catalog`, `.catalogGroup`, `.catalogGrid`
- **orchestrator only**: `.editor`, `.actions`, `.save`, `.cancel`, `.success`

The accommodation editor instead has one `.module.css` per section file, 1:1.

### 5.5 Tests

Commerce, counted by hand (`it(` / `it.<modifier>(`):

| File | tests |
| --- | --- |
| `test/components/commerce/CommerceListingEditor.test.tsx` | 22 |
| `test/components/commerce/CommerceCreateForm.test.tsx` | 11 |
| `test/components/commerce/CommerceFaqManager.test.tsx` | 11 |
| `test/components/commerce/CommerceListingActions.test.tsx` | 10 |
| `test/components/commerce/CommerceTranslationPanel.test.tsx` | 10 |
| `test/components/commerce/MediaField.test.tsx` | 4 |

`AmenitiesFeaturesField` and `OpeningHoursField` have **no dedicated test file**.
Every one of the 22 editor tests mounts the complete form.

The accommodation editor has 20 files under `test/components/host/editor/`
(238 tests, 2 to 35 each) plus 3 orchestrator files (36 tests). A section test
mocks its own CSS module via a `Proxy`, mocks `@/lib/i18n` to return the
fallback, shallow-mocks heavy children, and asserts that the section calls
`onFieldChange(field, value)` with the right arguments — it never asserts on
persisted state.

## 6. Proposed design

### 6.1 PR 1 — state consolidation (no JSX changes)

Introduce a single form-state type and collapse the 18 slots into it:

```ts
interface CommerceEditData {
    readonly name: string;
    readonly destinationId: string;
    readonly listingType: string;
    readonly summary: string;
    readonly description: string;
    readonly richDescription: string;
    readonly contact: ContactValues;
    readonly social: SocialValues;
    readonly openingHours: OpeningHours | null;
    readonly featuredImage: Image | null;
    readonly gallery: readonly Image[];
    readonly amenityIds: ReadonlySet<string>;
    readonly featureIds: ReadonlySet<string>;
    readonly i18nValues: CommerceI18nValues;
    readonly priceRange: string;      // gastronomy
    readonly menuUrl: string;         // gastronomy
    readonly isPriceOnRequest: boolean; // experience
    readonly priceFrom: number | null;  // experience
    readonly priceUnit: string;         // experience
}
```

```ts
const [formData, setFormData] = useState<CommerceEditData>(buildInitialEditData(initialData));
const [baseline, setBaseline] = useState<CommerceEditData>(buildInitialEditData(initialData));
```

`preservedMedia` stays a **separate** `useState` lazy-init outside `formData`. It
is never user-editable and never diffed — it is a passthrough of
`media.videos` / `media.archivedGallery` that exists solely so the JSONB `media`
replacement does not drop those sub-fields.

Change API replacing the 6 bespoke handlers:

```ts
onFieldChange:   (field: keyof CommerceEditData, value: string | number | boolean | null) => void
onGroupChange:   <K extends 'contact' | 'social'>(group: K, patch: Partial<CommerceEditData[K]>) => void
onMediaChange:   (next: { featuredImage: Image | null; gallery: readonly Image[] }) => void
onToggleAmenity: (id: string) => void
onToggleFeature: (id: string) => void
onI18nChange:    (next: CommerceI18nValues) => void
```

Each clears the corresponding `fieldErrors` key and resets `status` to idle,
exactly as `markDirty` does today.

`buildPayload` becomes `buildPatchPayload(current, baseline)`. **This is the
delicate part** — see §7 for the contract it must preserve. On successful save,
`setBaseline(formData)` (mirroring `AccommodationEditor`'s resync), replacing
today's `setDirty(new Set())`.

`handleSubmit`'s current early return `if (dirty.size === 0) return;` becomes
`if (Object.keys(payload).length === 0) return;` — computed from the diff.

**Acceptance gate for PR 1**: `CommerceListingEditor.test.tsx` passes with **zero
modifications**. If a test needs editing, the refactor changed observable
behavior and the change is wrong until proven otherwise.

### 6.2 PR 2 — section extraction (no state changes)

New directory `apps/web/src/components/commerce/editor/`:

| File | Anchor id | Absorbs |
| --- | --- | --- |
| `BasicInfoSection.client.tsx` | `editor-basicInfo` | name, destination, type, summary, description, richDescription |
| `ContactSection.client.tsx` | `editor-contact` | contact fieldset |
| `SocialNetworksSection.client.tsx` | `editor-socialNetworks` | social fieldset |
| `OpeningHoursSection.client.tsx` | `editor-openingHours` | today's `OpeningHoursField` + its section wrapper |
| `MediaSection.client.tsx` | `editor-media` | today's `MediaField` + its section wrapper |
| `AmenitiesSection.client.tsx` | `editor-amenities` | today's `AmenitiesFeaturesField` + its section wrapper |
| `PriceSection.client.tsx` | `editor-price` | the gastronomy ⟂ experience ternary (OQ-1) |

`CommerceTranslationPanel` already follows the pattern and stays where it is; it
only gains an `editor-translations` anchor.

The three `*Field` widgets are **folded into** their section components rather
than kept as wrapped children. They have exactly one consumer each, so the thin
wrapper buys nothing, and folding is what removes the `classes` prop.

Every section takes:

```ts
readonly locale: SupportedLocale;
readonly data: CommerceEditData;
readonly errors: Readonly<{ /* typed slice for this section only */ }>;
readonly onFieldChange: (field: keyof CommerceEditData, value: …) => void;
```

plus only what it genuinely needs beyond that (`destinations` +
`destinationsLoadFailed` for BasicInfo; `vertical` for Price; `amenities` +
`features` + the two toggles for Amenities; `vertical` + `listingId` +
`onMediaChange` for Media).

The orchestrator retains: all state, all handlers, `buildPatchPayload`,
`handleSubmit`, the `formError` banner and the actions row.

### 6.3 CSS

```
commerce/editor/
  editor-fields.module.css        # .section .label .input .textarea .checkbox .error .hint
  BasicInfoSection.client.tsx
  BasicInfoSection.module.css     # section-specific only
  OpeningHoursSection.module.css  # .days .day .dayLabel .shift
  MediaSection.module.css         # .media*
  AmenitiesSection.module.css     # .catalog*
  …
```

Sections import `editor-fields.module.css` for the shared primitives and their
own module for the rest. `CommerceListingEditor.module.css` shrinks to
orchestrator-only classes (`.editor`, `.actions`, `.save`, `.cancel`,
`.success`). The `classes` prop disappears from all three former widgets.

This is a **third** pattern — neither commerce's current single shared module nor
the accommodation editor's strict 1:1 — chosen because strict 1:1 would duplicate
`.label` / `.input` / `.textarea` / `.checkbox` / `.error` across seven modules
and make any field-level visual tweak a seven-file edit. Recorded here as a
deliberate deviation from the reference implementation.

## 7. Data model / contracts

No API, schema or DB change. The contract at risk is the **PATCH payload**, and it
is the single most likely place for this refactor to break something silently.

### 7.1 Payload semantics that must survive

Today's `buildPayload` (lines 344-447) is not a uniform diff. Per field group:

| Dirty key | Payload key(s) | Emitted when cleared |
| --- | --- | --- |
| `name` | `name` | raw value, no normalization |
| `destinationId` | `destinationId` | `\|\| undefined` |
| `type` | `type` | `\|\| undefined` |
| `summary` | `summary` | `\|\| undefined` |
| `description` | `description` | `\|\| undefined` |
| `richDescription` | `richDescription` | raw value |
| `i18n` | `nameI18n`, `summaryI18n`, `descriptionI18n`, `richDescriptionI18n` | **all four together** |
| `contactInfo` | `contactInfo` | whole object, fields via `nonEmpty()` |
| `socialNetworks` | `socialNetworks` | whole object, 6 fields via `nonEmpty()` |
| `openingHours` | `openingHours` | raw, may be `null` |
| `media` | `media` | `{...preservedMedia, ...(featuredImage ? {featuredImage} : {}), gallery}` |
| `amenityIds` | `amenityIds` | `[...set]` |
| `featureIds` | `featureIds` | `[...set]` |
| `priceRange` (gastronomy) | `priceRange` | `\|\| null` |
| `menuUrl` (gastronomy) | `menuUrl` | `\|\| null` |
| `isPriceOnRequest` (experience) | `isPriceOnRequest` | boolean |
| `priceFrom` (experience) | `priceFrom` | `?? undefined` |
| `priceUnit` (experience) | `priceUnit` | `\|\| undefined` |

The `null` / `undefined` split on the price fields is **not** an inconsistency to
tidy up. The T-021 comment on lines 412-417 records why: gastronomy's
`priceRange` / `menuUrl` are `.nullish()` on the domain schema and accept `null`,
while experience's `priceFrom` / `priceUnit` are
`z.number().int().nonnegative()` / a native-enum schema and **reject `null`** —
sending `null` there failed validation whenever the owner cleared the field.
Omitting the key is what "no change" means for those two.

Likewise, `contactInfo` / `socialNetworks` / `media` / the four i18n fields are
**grouped**: the whole object ships whenever any member changes. A naive
per-leaf diff would emit partial objects and silently drop the untouched members
server-side.

### 7.2 Behavioral change introduced by PR 1

Dirty-set tracking and baseline diffing are not equivalent. Editing a field and
then typing its original value back leaves it in the dirty set (so it ships in
the payload, as a no-op write) but produces an empty diff (so it does not ship).
Adopting the baseline model — which is the point of the exercise, and what makes
the accommodation editor's revert-after-save work — accepts that difference.

It must be covered by explicit tests rather than discovered in production:

- edit a field, revert it by hand → that field is absent from the payload
- edit field A, revert A, edit field B → payload contains only B
- save successfully, then revert a just-saved field → the revert **does** ship
  (this is the HOS-190 F6 baseline-resync behavior, and it is the reason the
  baseline must be mutable state rather than the `initialData` prop)

A second, user-visible consequence: the save button is now derived from the diff,
so reverting an edit by hand disables it again. The accommodation editor already
behaves this way. It is the reason the pre-existing `priceFrom` test needed a new
fixture (see the AC-4 amendment).

## 8. UX / UI behavior

None. Both PRs are structural.

The DOM tree, element order, ids, labels, ARIA attributes and computed classes
must be identical before and after. This is not a soft goal — it is the mechanism
by which the existing 22 tests act as the regression net for a 2500-line
refactor (G-6).

The only additive change is the `<section id="editor-…">` anchors (G-7), which
are inert until a nav consumes them.

## 9. Acceptance criteria

### PR 1

- **AC-1** — All form state lives in one `CommerceEditData` object plus a mutable
  `baseline`; the only surviving separate state is `preservedMedia`, `status` and
  `useZodForm`'s own.
- **AC-2** — `markDirty` and the `dirty` Set are gone; the payload is computed by
  diffing `formData` against `baseline`.
- **AC-3** — `baseline` is resynced to the saved values after every successful
  save.
- **AC-4** — `CommerceListingEditor.test.tsx` (22 tests) passes with **no change
  to any assertion**. Exactly one test's *fixture* may change, and only where the
  test's setup depended on the dirty-Set mechanism rather than on the behavior it
  claims to cover — see the amendment note below. Any test whose **assertion**
  has to change means the refactor altered observable behavior and is wrong until
  proven otherwise.

  > **Amended during implementation.** The original wording ("passes with zero
  > modifications") was too strong by exactly one test. `sends priceFrom as
  > undefined (not null) when cleared` typed `500` into an empty field and then
  > deleted it again — under baseline diffing that returns the field to its
  > original value and produces no change at all, so no PATCH fires. Its
  > *intent* (the T-021 null-vs-undefined contract) is untouched; only its
  > fixture moved to seeding `priceFrom` from `initialData`, which is what a
  > real owner clearing a persisted price actually does. 21 of 22 tests passed
  > byte-identical. The remaining 21 are the regression net the AC was written
  > for, and that net held.
- **AC-5** — Every row of the §7.1 table has a test asserting the exact payload
  shape for that field group, for both verticals where applicable. In particular:
  `priceFrom` / `priceUnit` cleared → key **omitted**; `priceRange` / `menuUrl`
  cleared → key present as **`null`**.
- **AC-6** — The three revert scenarios in §7.2 have tests.
- **AC-7** — `preservedMedia` still round-trips: saving after a gallery change on
  a listing with `media.videos` present does not drop them.

### PR 2

- **AC-8** — Seven section components exist under `commerce/editor/`, each
  exporting a `<section id="editor-…">` and taking `data` / `errors` /
  `onFieldChange`.
- **AC-9** — `AmenitiesFeaturesField.tsx`, `MediaField.tsx` and
  `OpeningHoursField.tsx` no longer exist as separate files; no component in
  `commerce/` receives a `classes` prop.
- **AC-10** — Each section has its own test file mounting that section alone,
  following the accommodation section-test pattern (CSS module `Proxy` mock,
  i18n fallback mock, assert on `onFieldChange` arguments).
- **AC-11** — `CommerceListingEditor.test.tsx` still passes with zero
  modifications, and `MediaField.test.tsx`'s 4 tests are carried over to
  `MediaSection.test.tsx` with no loss of coverage.
- **AC-12** — The destination block keeps all three branches
  (`destinationsLoadFailed` / populated / empty) with their exact messages. The
  HOS-260 comment on lines 587-591 documents these as a deliberate fix; they are
  not to be simplified.
- **AC-13** — `fieldErrors` dotted keys (`contactInfo.mobilePhone`,
  `socialNetworks.facebook`, …) still reach their fields, and every error slot
  that populates today still populates.

### Both PRs

- **AC-14** — `pnpm typecheck` and `pnpm lint` clean; no new `any`, no new
  `biome-ignore`.
- **AC-15** — The editor is exercised **in a browser** for both verticals: load,
  edit one field per section, save, reload, confirm persistence. Green jsdom
  tests do not establish that a CSS-module split rendered correctly.

## 10. Risks

- **R-1 — Payload contract drift.** The single highest risk. `buildPayload` is
  104 lines of per-field special-casing (§7.1) and a uniform diff silently
  flattens it. Mitigated by AC-5 as a precondition: **write the payload tests
  against the current implementation first**, watch them pass, then refactor.
- **R-2 — `null` vs `undefined` per vertical.** The exact bug T-021 already fixed
  once. A rewrite that "normalizes" the two branches reintroduces it, and it only
  surfaces when an owner *clears* a price field — a path no current test covers.
- **R-3 — `preservedMedia` passthrough.** Invisible to the UI and to every
  existing test; the `media` JSONB is replaced wholesale, so losing the spread
  silently deletes an owner's videos and archived gallery. AC-7 covers it.
- **R-4 — HOS-260 destination branches.** Three mutually exclusive renderings
  with inline business logic that were themselves a bug fix. Extraction is the
  classic moment to "clean up" two of them out of existence.
- **R-5 — CSS regression is invisible to the test suite.** jsdom does not compute
  styles and section tests mock the CSS modules away. Splitting one 240-line
  module into eight can drop or shadow a rule with a fully green suite. AC-15 is
  the only real gate here.
- **R-6 — PR size.** PR 2 moves ~500 lines of JSX and adds ~8 test files. If it
  outgrows reviewability, split it by section group (BasicInfo+Contact+Social /
  OpeningHours+Media+Amenities / Price) rather than degrading the review.
- **R-7 — Merge contention.** HOS-371 (cards and rich fields) touches the same
  file and the same CSS module, and is explicitly mergeable before this. Whichever
  lands second pays the rebase. Worth sequencing with the owner rather than
  discovering at merge time.

## 11. Open questions

- **OQ-1 — Price section shape.** Lines 848-982 are a single ternary rendering
  entirely different fields per vertical. One `PriceSection` taking `vertical`
  and branching internally, or two components (`GastronomyPriceSection` /
  `ExperiencePriceSection`) mounted conditionally? *Recommendation: one component
  with internal branching* — the two branches share the section chrome and anchor
  id, and a single `editor-price` nav entry is what the user should see either
  way. The accommodation editor has no analogue, so there is no precedent to
  follow.
- **OQ-2 — Sticky nav scope.** `EditorSectionNav.client.tsx` (153 lines) was
  verified genuinely generic: it takes `sections: {id,label}[]`, uses `locale`
  only for the nav's `aria-label`, and drives an `IntersectionObserver` scrollspy
  with `aria-current`. It has exactly one caller today. Wiring it into commerce is
  small once anchors exist. In this spec as PR 3, or a separate Linear issue?
  *Recommendation: PR 3 here* — the anchors ship in PR 2 and are dead weight until
  something consumes them, and the nav is the visible payoff that justifies the
  refactor to the owner.
- **OQ-3 — `editor-fields.module.css` naming and location.** It introduces a
  third CSS pattern (§6.3). Should it live in `commerce/editor/`, or be promoted
  to a shared location so the accommodation editor can eventually adopt it too
  and drop its own duplication? *Recommendation: keep it commerce-local for now.*
  Promoting it is a larger change that would touch the accommodation editor,
  which is out of scope here.

## 12. Implementation notes

- **Order is not negotiable.** PR 1 before PR 2. Consolidating state and moving
  JSX in one diff makes a bisect useless: a regression cannot be attributed to
  the state model or to the extraction.
- **Write the payload tests first.** AC-5's tests must be written and green
  against the *current* implementation before PR 1 touches anything. They are the
  specification of the contract, and they are worthless if authored after the
  refactor they exist to protect.
- `EditorSectionNav` picks the topmost visible section from a `Set` accumulated
  across `IntersectionObserver` callbacks (the observer only reports entries whose
  state changed, not the full set). `rootMargin: '-120px 0px -60% 0px'`,
  `aria-current="true"` on the active link and `undefined` — not `"false"` — on
  the others. Relevant only to OQ-2/PR 3.
- `typeOptions` is computed in the render body (lines 498-499) with no `useMemo`
  and no name of its own. It becomes a prop of `BasicInfoSection`.
- The accommodation editor maps schema error keys to UI keys via
  `mapSocialFieldErrors` / `SOCIAL_FIELD_TO_SCHEMA_KEY` (lines 178-194, 257).
  Commerce's dotted `fieldErrors` keys need the same treatment when sliced per
  section (AC-13).
- `host/editor/LocationSection.client.tsx` (117 lines) exists but the
  accommodation orchestrator imports `LocationPicker.client.tsx` for
  `id="editor-location"` instead. Possibly dead code. Out of scope; worth a
  separate cleanup issue if confirmed.
- Neither `AmenitiesFeaturesField` nor `OpeningHoursField` has a dedicated test
  today, so their extracted sections start from zero coverage rather than from a
  file to port. Budget accordingly.

## 13. Linear

Canonical tracking:
HOS-258
