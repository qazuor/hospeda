---
specId: SPEC-190
title: Admin Bundle Perf — Icon Tree-Shaking & Entity-Chunk Code-Split
slug: admin-bundle-perf-icons-and-codesplit
type: refactor
status: draft
complexity: medium-high
owner: qazuor
created: 2026-06-02
base: staging
branch: spec/SPEC-190-admin-bundle-perf-icons-and-codesplit
worktree: /home/qazuor/projects/WEBS/hospeda-spec-190-admin-bundle-perf-icons-and-codesplit
linearIssues:
  - BETA-74
tags:
  - admin
  - performance
  - bundle
  - icons
  - tree-shaking
  - code-split
  - refactor
---

# SPEC-190 — Admin Bundle Perf: Icon Tree-Shaking & Entity-Chunk Code-Split

> Skeleton note: this is the formalized functional spec. Tasks and `index.json`
> updates are produced by the caller after this file lands — do not generate them here.

## 1. Origin & problem statement

Linear **BETA-74** ("review @repo/icons icon maps + tree-shaking") asked us to look at
the `@repo/icons` package: it ships a ~230-entry static icon map (`ICON_MAP`) and a
barrel (`packages/icons/src/index.ts`) that re-exports both the named icon components
**and** that map. The concern: every admin consumer that imports a named icon from
`@repo/icons` may be dragging the whole resolver map (and therefore ~230 icon modules)
into its chunk.

The owner expanded the scope to the broader symptom BETA-74 is a proxy for: the admin
app's `components-entity` Rollup chunk is large. **Two fronts, one goal: shrink the
admin client bundle, evidence-driven.**

### Honest framing (read this before estimating any win)

Earlier informal notes claimed the entity chunk was "~4MB". A later revision corrected
this to "~401 KB pre-gzip" based on SSR chunk measurement. **Phase 1 baseline (2026-06-10)
revealed the actual CLIENT-side `components-entity` chunk is 4044 KB raw / 1129 KB gzip**
— the 4 MB concern is validated. The 401 KB number was an SSR artifact. Every claim in
this document is anchored to a measurement, and Phase 1 exists precisely to replace
folklore with real before/after numbers.

Equally important: **icons are a SECONDARY contributor**, not the headline. The real
weight in `components-entity` is:

- **tiptap** (`@tiptap/react`, `@tiptap/starter-kit`, `tiptap-markdown`, plus
  `@tiptap/extension-*`) pulled in by `RichTextField.tsx` (~13.6 KB source, but a
  heavy dependency tree).
- **leaflet** pulled in by `CoordinatesField.tsx` (~29.5 KB source) +
  `CoordinatesMapView.tsx` (~11.1 KB source), via `leaflet` + `react-leaflet`.
- **image / video upload** field components: `ImageField.tsx` (~28.6 KB),
  `GalleryField.tsx` (~20.4 KB), `VideoGalleryField.tsx` (~16.5 KB), plus their upload
  hooks/types (Cloudinary wiring, `SortableGalleryItem`, etc.).
- **Over-grouping caused by the chunk rule + cross-directory imports.** The
  `manualChunks` rule `id.includes('/components/entity-')` collapses **three** sibling
  trees — `entity-list`, `entity-form`, `entity-pages` — into one `components-entity`
  chunk. Combined with cross-imports between them (see §2), Rollup has no seam to split
  on.

So the spec sets the expectation explicitly: **the icon front is the low-risk,
highest-leverage hygiene fix; the bigger byte win comes from code-splitting the heavy
field components.** We will not over-promise icon savings.

## 2. Current architecture (verified facts)

| Concern | Location | State today (verified) |
|---------|----------|------------------------|
| Icons barrel | `packages/icons/src/index.ts` | Re-exports named icons **and** `ICON_MAP` + `resolveIcon` at line 13 |
| Icon resolver map | `packages/icons/src/icon-resolver.ts` | `ICON_MAP` (~230 static `import` lines → component map) + `resolveIcon({ iconName })` lookup (lines 546-550) |
| Icons package config | `packages/icons/package.json` | **No `"sideEffects"` field** (absent — verified); single `"exports"` entry `"."` only |
| Admin resolver consumer | `apps/admin/src/components/entity-list/IconNameCell.tsx` | `import { resolveIcon } from '@repo/icons'` then `resolveIcon({ iconName })` at render — the ONLY real admin `resolveIcon` call site |
| Other admin `resolveIcon` mentions | `lib/nav-icon-map.ts`, `dashboards/dashboard-accents.ts`, `dashboards/widgets/widget-states.tsx` | **Comments only** — `nav-icon-map.ts` has its own `NAV_ICON_MAP` (app-local), it does NOT call the shared `resolveIcon` |
| Web resolver consumers (SSR) | `apps/web/.../AmenitiesGrid.astro`, `FeaturesGrid.astro`, `Badge.tsx`/`Badge.astro`, `filters/.../FilterGroupContent.tsx`, `IconChipsFilter.tsx`, `SectionHeader.tsx` | Astro SSR + React islands; rendered server-side. No admin-bundle impact |
| Dead lucide chunk branch | `apps/admin/vite.config.ts` ~line 276 | `if (id.includes('lucide')) return 'vendor-icons'` — **dead**: no `lucide` in `apps/admin/package.json`; the only `lucide` string in admin src is a *comment* in `newsletter/RichTextEditor.tsx:111` ("lucide-react is not installed") |
| Entity chunk rule | `apps/admin/vite.config.ts` ~lines 292-295 | `if (id.includes('/components/entity-')) return 'components-entity'` — captures `entity-list`, `entity-form`, AND `entity-pages` |
| Field render switch | `apps/admin/src/components/entity-form/EntityFormSection.tsx` lines 1-33, 218-549 | Static `import` of every field at top of file; `renderFieldComponent()` switches on `FieldTypeEnum` to mount each one. This is the natural lazy boundary |
| Heavy fields | `entity-form/fields/{RichTextField,CoordinatesField,CoordinatesMapView,ImageField,GalleryField,VideoGalleryField}.tsx` | tiptap / leaflet / upload — all eagerly imported via `fields/index.ts` barrel |
| Measurement tooling | `apps/admin/package.json` | **None** — no `rollup-plugin-visualizer`, no `build:analyze` script (verified absent) |
| Optimization doc | `packages/icons/docs/guides/optimization.md` line 17 | Claims `sideEffects: false` is set — **FALSE** (the field is absent from `package.json`). Doc must be corrected |

### Verified import graph (why Rollup over-groups)

The three `entity-*` directories are not independent; the chunk rule glues them and the
cross-imports give Rollup no clean seam:

- `entity-list/InlineStateSelectCell.tsx` and `entity-list/DeleteRowButton.tsx`
  → `import { DeleteConfirmDialog } from '@/components/entity-form/fields/DeleteConfirmDialog'`
  (**entity-list → entity-form**).
- `entity-pages/EntityCreatePageBase.tsx`, `EntityCreateContent.tsx`, `EntityEditContent.tsx`
  → `import { EntityFormProvider, EntityFormSection, ... } from '@/components/entity-form'`
  and many `entity-form/*` subpaths (**entity-pages → entity-form**).
- `entity-form/EntityFormSection.tsx` → `@/features/billing/*`
  (`LimitProgressIndicator`, `PremiumBlock`, `use-my-entitlements`) — pulls a feature
  tree into the form section.

No direct `entity-form → entity-list` / `entity-form → entity-pages` import was found in
production source (only a test file references enums). The over-grouping is driven by
**(a)** the single greedy `/components/entity-` chunk match and **(b)** the
`entity-list → entity-form/fields` edge that drags the field tree into the list. Step 2
of the implementation MUST re-confirm with the visualizer before any de-cycling — the
"circular dep" framing in the build record is, on static inspection, more accurately a
**greedy-chunk + one-way-edge over-grouping** problem than a true import cycle. The spec
treats "de-cycle / de-couple" as: break the edge that forces the field tree into the
list chunk, and split the greedy `manualChunks` match.

### Project rules that constrain this work

- Admin styling is Tailwind v4 (no CSS modules). No new UI deps without approval.
- Named exports only; `import type` for type-only imports; RO-RO for new functions.
- TanStack Start drives SSR + hydration for admin routes — any `React.lazy` boundary
  MUST preserve hydration correctness and form behavior (no SSR/client mismatch).
- `@repo/icons` is the single source of truth for icons; web and admin both consume it.
- Tests are mandatory (Vitest, AAA, ≥90% target). No tests = not done.

## 3. Goals & non-goals

### Goals

1. **Measure first.** Add bundle analysis to `apps/admin` and capture a hard baseline of
   chunk sizes (raw + gzip) before any change. Re-measure after each front so every
   claimed win has a before/after number.
2. **Icon tree-shaking (BETA-74 core).** Make `@repo/icons` tree-shakeable
   (`sideEffects: false`), isolate the dynamic resolver map behind a subpath so named
   icon imports never pull the ~230-icon map, lazify the admin resolver usage, and
   remove the dead lucide chunk branch.
3. **Code-split the heavy fields.** Lazy-load tiptap / leaflet / upload field components
   at the `EntityFormSection` `FieldTypeEnum` switch boundary so each lands in its own
   async chunk loaded only when a form actually renders that field type.
4. **De-couple the entity chunk.** Break the edge(s) and adjust `manualChunks` so the
   lazy chunks land sensibly and `components-entity` no longer greedily absorbs the
   field tree.
5. **Prove it.** A final before/after table backed by the visualizer is the acceptance
   evidence; correct the false `sideEffects` claim in the icons optimization doc.

### Non-goals (explicitly out of scope)

1. **The `apps/web` client bundle.** Web uses `resolveIcon` from Astro SSR / React
   islands rendered server-side; we will **verify it does not leak `ICON_MAP` to the
   web client**, but we will NOT restructure web's icon usage or chunks here.
2. **Replacing `@phosphor-icons/react`.** The underlying icon library stays.
3. **The `lib-utils` chunk (~554 KB).** Separate concern; out of scope unless a fix here
   trivially and obviously also helps it (must be noted, not pursued).
4. **Over-claiming icon savings.** No target is set for "icons will save X MB". Icons are
   a hygiene fix; their measured delta is whatever the visualizer reports.
5. **New runtime features, new field types, or UX redesigns.** This is a perf refactor;
   field behavior must be byte-for-byte equivalent to today after lazy-loading.
6. **Virtualized list changes** (`VirtualizedEntityList*`).

## 4. Functional requirements & acceptance criteria

### FR-1 — Measurement setup + baseline (MUST be done first)

Add `rollup-plugin-visualizer` (devDependency) and a `build:analyze` script to
`apps/admin/package.json`. The script produces a treemap/sunburst HTML report and emits
per-chunk raw + gzip sizes. Capture a committed BASELINE snapshot (a small
machine-readable table or the report metadata) of at least: `components-entity`,
`vendor*`, `lib-utils`, and any icon-related chunk, recording raw and gzip bytes.

```
Given apps/admin has no bundle analyzer today
  When build:analyze is added and run on the unchanged baseline
  Then a visualizer report is produced
  And the components-entity chunk size (raw + gzip) is recorded as the baseline number
  And the recorded baseline reflects ~4044 KB raw / ~1129 KB gzip for components-entity

Given the baseline is captured
  When any later front changes a chunk
  Then build:analyze can be re-run to produce a comparable after-number for the same chunk
```

### FR-2 — `sideEffects: false` on `@repo/icons`

Add `"sideEffects": false` to `packages/icons/package.json` after verifying icon
modules are pure (SVG/React components with no CSS or global side-effects — verified:
they are pure component factories). This is the highest-leverage, lowest-risk change.

```
Given packages/icons/package.json has no sideEffects field
  When "sideEffects": false is added
  And the icons package and admin app are rebuilt
  Then a consumer importing a single named icon no longer retains unused icon modules
  And build:analyze shows the icon footprint in admin chunks unchanged-or-smaller (never larger)
  And all existing icon-rendering tests (admin + web) still pass

Given an icon module had a real side-effect (hypothetical)
  When sideEffects: false is applied
  Then that module would be wrongly dropped
  And the mitigation (verified no side-effectful icon module exists; if found, list it in sideEffects) prevents it
```

### FR-3 — Isolate the resolver behind `@repo/icons/resolver`

Move `ICON_MAP` / `resolveIcon` out of the main barrel (`src/index.ts` line 13) into a
dedicated subpath export so importing named icons from `@repo/icons` never transitively
pulls the ~230-icon map. Add an `exports` entry `"./resolver"` to `packages/icons/package.json`
(with matching tsup/build output and types), and migrate every `resolveIcon`/`ICON_MAP`
call site to import from `@repo/icons/resolver`.

```
Given ICON_MAP and resolveIcon are re-exported from the main @repo/icons barrel
  When they are moved to a @repo/icons/resolver subpath export
  Then importing { SearchIcon } from '@repo/icons' no longer pulls ICON_MAP into that chunk
  And @repo/icons/resolver resolves to the map + resolveIcon

Given the resolver moved to a subpath
  When all call sites are migrated
  Then a grep for resolveIcon/ICON_MAP imported from '@repo/icons' (the bare barrel) returns zero production matches
  And IconNameCell.tsx, plus any web SSR caller, imports from @repo/icons/resolver
  And typecheck + tests pass with no unresolved import
```

### FR-4 — Lazify the admin `IconNameCell` resolver usage

The admin's only real resolver call site (`IconNameCell.tsx`) eagerly imports the
resolver at module load, which lands the full `ICON_MAP` in `components-entity`. Defer
it via dynamic `import()` / `React.lazy` so the map lands in an **async** chunk loaded
only when a list row actually renders a stored icon name.

```
Given IconNameCell statically imports resolveIcon (ICON_MAP in components-entity)
  When IconNameCell is refactored to load the resolver lazily
  Then the ICON_MAP lands in a separate async chunk (not components-entity)
  And build:analyze shows components-entity shrink by the icon-map footprint
  And a row with an icon name still renders the icon (after the async chunk resolves)
  And a row with no/unknown icon name still shows the em-dash / mono slug fallback

Given a catalog list (amenities/features) renders many IconNameCell rows
  When the list loads
  Then the resolver chunk is fetched once and reused (no per-row network thrash)
```

### FR-5 — Remove the dead lucide `manualChunks` branch

Delete the `if (id.includes('lucide')) return 'vendor-icons'` branch in
`apps/admin/vite.config.ts` after confirming (verified) no `lucide-react` import exists
in admin source — only a stale comment.

```
Given vite.config.ts has a lucide → vendor-icons manualChunks branch
  And no lucide-react dependency or import exists in apps/admin
  When the dead branch is removed
  Then the admin build still succeeds
  And no vendor-icons chunk is emitted (it was never populated)
  And build:analyze chunk list is unchanged except the absent empty branch
```

### FR-6 — `React.lazy` the heavy fields at the `FieldTypeEnum` boundary

In `EntityFormSection.tsx`, replace the static top-of-file imports of the heavy field
components with `React.lazy` + `Suspense`, lazy-loading at the field-type switch:

- `RichTextField` (tiptap) → `FieldTypeEnum.RICH_TEXT`
- `CoordinatesField` (+ `CoordinatesMapView`, leaflet) → `FieldTypeEnum.COORDINATES`
- `ImageField` → `FieldTypeEnum.IMAGE`
- `GalleryField` → `FieldTypeEnum.GALLERY`
- `VideoGalleryField` → `FieldTypeEnum.VIDEO_GALLERY`

Light fields (`TextField`, `SelectField`, `SwitchField`, etc.) stay static. Each heavy
field becomes its own async chunk loaded only when a rendered form contains that field
type. SSR/hydration correctness (TanStack Start) and form value/error behavior MUST be
preserved; each lazy field gets a `Suspense` fallback.

```
Given a form section contains no rich-text/coordinates/image/gallery/video fields
  When the section renders
  Then none of the tiptap/leaflet/upload chunks are loaded

Given a form section contains a RICH_TEXT field
  When the section renders
  Then the tiptap chunk is fetched lazily
  And a Suspense fallback is shown until it resolves
  And the rich-text editor then behaves exactly as before (edit, markdown, value/onChange/onBlur)

Given a form section contains a COORDINATES field
  When the section renders
  Then the leaflet chunk loads lazily
  And the map + Nominatim search behave exactly as before
  And no "Map already initialized" or hydration-mismatch error occurs

Given each heavy field type (rich-text, coordinates, image, gallery, video) in CREATE and in EDIT
  When a manual smoke is run after lazy-loading
  Then every field renders, accepts input, persists its value, and submits correctly in both modes

Given build:analyze is re-run after FR-6
  Then tiptap, leaflet, and upload no longer sit inside components-entity
  And components-entity is measurably smaller than the FR-1 baseline
```

### FR-7 — De-couple / de-cycle `entity-form` / `entity-list` / `entity-pages`

Resolve the over-grouping that forces the field tree into the list chunk. Concretely:
break the `entity-list → entity-form/fields/DeleteConfirmDialog` edge that pulls the
form-field tree into `entity-list` (e.g. relocate the shared `DeleteConfirmDialog` to a
neutral location, or split it so the list does not transitively import the heavy fields).
Re-confirm with the visualizer whether any true cycle exists; if found, document and
break it. The fix must not change runtime behavior.

```
Given entity-list imports DeleteConfirmDialog from entity-form/fields
  And that edge drags the form-field tree into the list chunk
  When the shared dialog is relocated to a neutral module (or the edge is otherwise broken)
  Then entity-list no longer transitively imports the heavy field components
  And the delete-confirm flow in lists still works identically

Given the de-coupling is applied
  When the admin build runs
  Then no new circular-dependency warning is emitted by Rollup
  And typecheck + all affected component tests pass
```

### FR-8 — Adjust `manualChunks`

Replace the single greedy `id.includes('/components/entity-')` match so the three
sibling trees split sensibly and the new lazy chunks land in their own files (not folded
back into `components-entity`). The strategy must be deterministic and documented inline.

```
Given the manualChunks rule collapses entity-list/form/pages into components-entity
  When the rule is refined to split them (and to leave lazy field chunks standalone)
  Then build:analyze shows distinct, smaller chunks instead of one large components-entity
  And no chunk regresses larger than the FR-1 baseline for the same concern
  And the admin app loads and routes correctly (no missing-chunk runtime errors)
```

### FR-9 — After-measurement proving each win

Produce a final before/after table (from `build:analyze`) covering each front:
sideEffects, resolver subpath + lazify, heavy-field lazy split, de-couple + manualChunks.
Each row shows baseline raw/gzip vs. after raw/gzip and the delta. This table is the
acceptance evidence for the whole spec. Correct the false `sideEffects: false` claim in
`packages/icons/docs/guides/optimization.md`.

```
Given all fronts are implemented
  When build:analyze is run for the final state
  Then a before/after table records the measured delta for components-entity and icon chunks
  And every claimed reduction in this spec maps to a real number in that table
  And no claim asserts a saving the table does not support

Given the icons optimization doc claims sideEffects: false is already set
  When the doc is corrected
  Then it accurately reflects the package.json state after FR-2
```

## 5. Phased implementation plan

Ordered so measurement lands first (everything else is judged against it), then the
low-risk icon hygiene, then the higher-risk lazy-loading + de-coupling, then closeout.
**Measurement MUST be Phase 1.**

### Phase 1 — Measurement + baseline (foundational, MUST be first)

1. Add `rollup-plugin-visualizer` devDep + `build:analyze` script to `apps/admin`.
2. Run it on the untouched baseline; commit a small machine-readable size snapshot
   (components-entity, vendor*, lib-utils, icon chunks — raw + gzip).
3. (Optional, only if cheap) sketch a bundle-size CI guard idea for the closeout.

**Pause point:** a hard baseline exists; every later change is measurable against it.

### Phase 2 — Icon front (BETA-74) + re-measure

4. Add `"sideEffects": false` to `packages/icons/package.json` (FR-2).
5. Move `ICON_MAP`/`resolveIcon` to a `@repo/icons/resolver` subpath export + build
   wiring; migrate all call sites (FR-3).
6. Lazify `IconNameCell.tsx` resolver usage (FR-4).
7. Remove the dead lucide `manualChunks` branch (FR-5).
8. Re-run `build:analyze`; record the icon-front delta. Verify web SSR still works and
   does not leak `ICON_MAP` to the web client.

**Pause point:** icons are tree-shakeable, the resolver is isolated and lazy, the dead
branch is gone, and the measured icon delta is recorded (no over-claim).

### Phase 3 — Heavy-field code-split + de-couple + re-measure

9. `React.lazy` + `Suspense` the heavy fields at the `FieldTypeEnum` boundary in
   `EntityFormSection.tsx` (FR-6).
10. Break the `entity-list → entity-form/fields` edge (relocate `DeleteConfirmDialog`
    or equivalent); confirm/break any true cycle (FR-7).
11. Adjust `manualChunks` so lazy chunks land standalone and the three entity trees
    split (FR-8).
12. Re-run `build:analyze`; record the field-split delta.

**Pause point:** the heavy field deps are async chunks, the chunk is de-coupled, and the
measured win is recorded.

### Phase 4 — Closeout

13. Final before/after table (FR-9); correct the false `sideEffects` claim in the icons
    optimization doc.
14. Manual admin smoke of every field type (rich-text, coordinates/map, image, gallery,
    video) in CREATE + EDIT; flip spec + task index to completed.

## 6. Risk and rollback

| Risk | Mitigation |
|------|------------|
| **Lazy-loading a field breaks form render or SSR hydration** (FR-6) — TanStack Start SSR + `React.lazy` mismatch, or value/error wiring lost | `Suspense` fallback per lazy field; preserve the exact `fieldProps` contract; per-field component test; **mandatory manual smoke of each field type in create AND edit** before closeout; rollback = revert the single field to a static import |
| **De-coupling introduces a behavior regression** (FR-7) — relocating `DeleteConfirmDialog` or splitting an edge changes the delete-confirm flow | Pure move (no logic change); keep the same exported API; component test for the list delete flow; rollback = revert the relocation commit |
| **Subpath export breaks an unmigrated `resolveIcon` call site** (FR-3) | Grep ALL `resolveIcon`/`ICON_MAP` imports (admin + web) before and after; zero bare-`@repo/icons` resolver imports must remain; typecheck gates the migration |
| **`sideEffects: false` wrongly drops a needed module** (FR-2) | Verified icon modules are pure components (no CSS/global side-effects); if any side-effectful module is found, enumerate it in the `sideEffects` array instead of `false`; full icon-render test suite must pass |
| **`manualChunks` change causes a missing-chunk runtime error** (FR-8) | Deterministic, documented rule; smoke the admin app routes after the change; `build:analyze` confirms chunk topology; rollback = revert the vite.config edit |
| **Over-claiming a win not backed by numbers** | FR-9 forces every claim to map to a `build:analyze` row; the honest-framing §1 caps icon expectations |
| **Web client icon leak goes unnoticed** | Phase 2 step 8 explicitly verifies the web client bundle does not gain `ICON_MAP` (web `resolveIcon` is SSR-only) |

## 7. Testing strategy

Per the project's Test-Informed Development rules (Vitest, AAA, ≥90% target):

- **Components — tests alongside:** `IconNameCell` lazy path (renders icon after async
  resolve; fallback for empty/unknown); each lazily-loaded heavy field still renders and
  wires `value`/`onChange`/`onBlur` (RichText, Coordinates, Image, Gallery, Video);
  the relocated `DeleteConfirmDialog` flow in lists.
- **Regression:** any bug found during lazy-loading or de-coupling gets a reproducing
  test before the fix.
- **Build/measurement evidence (the primary acceptance gate):** `build:analyze`
  before/after numbers for `components-entity` and icon chunks. A claimed reduction with
  no supporting number is a failed acceptance criterion.
- **Manual admin smoke (Phase 4, mandatory):** every field type exercised in CREATE and
  EDIT in the browser (superadmin), since lazy-loading + SSR hydration correctness is not
  fully captured by unit tests. Specifically: rich-text editing + markdown, coordinates
  map + Nominatim search, image upload/replace/delete, gallery add/reorder/delete, video
  gallery add/remove.

## 8. Out-of-scope / future work

- `apps/web` client-bundle icon restructuring (only the no-leak verification is in scope).
- Replacing `@phosphor-icons/react`.
- The `lib-utils` ~554 KB chunk (separate spec unless trivially helped here).
- A bundle-size CI guard (sketched optionally in Phase 1; full implementation deferred).
- Any new field type, UX redesign, or runtime feature.

## 9. Key file pointers

| File | Relevance |
|------|-----------|
| `packages/icons/package.json` | Add `"sideEffects": false` (FR-2) + `"./resolver"` exports entry (FR-3) |
| `packages/icons/src/index.ts` | Remove `ICON_MAP`/`resolveIcon` re-export at line 13 (moves to subpath) |
| `packages/icons/src/icon-resolver.ts` | Source of `ICON_MAP` + `resolveIcon`; becomes the `@repo/icons/resolver` entry |
| `packages/icons/docs/guides/optimization.md` | Correct the FALSE `sideEffects: false` claim (line 17) — FR-9 |
| `apps/admin/package.json` | Add `rollup-plugin-visualizer` + `build:analyze` (FR-1) |
| `apps/admin/vite.config.ts` | Remove dead lucide branch (~276, FR-5); refine `manualChunks` (~292-295, FR-8) |
| `apps/admin/src/components/entity-form/EntityFormSection.tsx` | `React.lazy` heavy fields at the `FieldTypeEnum` switch (FR-6) |
| `apps/admin/src/components/entity-form/fields/{RichTextField,CoordinatesField,CoordinatesMapView,ImageField,GalleryField,VideoGalleryField}.tsx` | The heavy field components to lazy-load |
| `apps/admin/src/components/entity-form/fields/index.ts` | Barrel that currently eagerly re-exports heavy fields |
| `apps/admin/src/components/entity-list/IconNameCell.tsx` | Lazify the resolver usage (FR-4) |
| `apps/admin/src/components/entity-list/{InlineStateSelectCell,DeleteRowButton}.tsx` + `entity-form/fields/DeleteConfirmDialog.tsx` | The `entity-list → entity-form` edge to break (FR-7) |
| `apps/web/.../{AmenitiesGrid.astro,FeaturesGrid.astro,Badge.tsx,Badge.astro,filters/*}` | Web SSR `resolveIcon` consumers — migrate import to subpath, verify no client leak |

## 10. Design decisions (locked)

1. **Measurement is Phase 1, non-negotiable.** Every win in this spec is anchored to a
   `build:analyze` before/after number. No measurement → no acceptance.
2. **Honest framing baked in.** The chunk is ~401 KB raw, not 4 MB. Icons are a
   secondary contributor; the headline win is code-splitting tiptap/leaflet/upload.
3. **`sideEffects: false`** is added to `@repo/icons` (icon modules verified pure). If a
   side-effectful module is ever found, it is enumerated in the array, not blanket-false.
4. **Resolver moves to `@repo/icons/resolver` subpath**; named-icon imports from the
   bare barrel must never pull `ICON_MAP`. All call sites migrate; zero bare-barrel
   resolver imports remain.
5. **Heavy fields lazy-load at the `FieldTypeEnum` switch** in `EntityFormSection`, with
   `Suspense` fallbacks; light fields stay static. SSR/hydration + form behavior
   preserved.
6. **De-coupling = break the `entity-list → entity-form/fields` edge + split the greedy
   `manualChunks` match.** On static inspection this is over-grouping, not a true cycle;
   the visualizer re-confirms before any restructure. No runtime behavior change.
7. **The dead lucide chunk branch is removed** (no `lucide-react` in admin; only a stale
   comment references it).
8. **Web is verify-only.** We confirm no `ICON_MAP` leaks to the web client; we do not
   restructure web chunks.
