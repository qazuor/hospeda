---
title: Mi Cuenta UI · Phase 4 · Editors (section nav by container query, save bar everywhere, field kit, photos, repeaters, hours, translations, in-epic sibling fusions)
linear: HOS-2415
statusSource: linear
created: 2026-11-22
type: feature
parent: HOS-2409   # epic «rediseño visual de Mi Cuenta»
children:
  - HOS-2486   # section nav by container query + sticky switcher
  - HOS-2487   # save bar on every section; carta, menú and eventos move to the bar
  - HOS-2488   # field kit applied to both editors
  - HOS-2489   # photos UI (MediaManager) in both editors, visual layer only
  - HOS-2490   # Repeater for FAQ, carta, menú del día and eventos
  - HOS-2491   # HoursEditor with translated texts
  - HOS-2492   # translations: same look in both editors
  - HOS-2493   # visual unification umbrella (hub, width, headers, states)
  - HOS-2496   # fusion: location, with map for venue and meeting point (IN, D12)
  - HOS-2497   # fusion: contact (IN, owner 20/11)
  - HOS-2499   # fusion: editor hub + completeness meter (IN, owner 20/11)
  - HOS-2515   # host reputation section to the kit (moved out of HOS-2503)
related:
  - HOS-2413   # phase 2 kit (StickySaveBar, AutoSaveChip, fields, Tabs)
  - HOS-2414   # phase 3 (ListingCard, Menu, DataList used here)
  - HOS-2416   # phase 5: remaining editor sections (HOS-2503, HOS-2504)
  - HOS-318    # editor: one section, one page (D-1)
  - HOS-2410   # help center: section slugs must not change silently
  - HOS-2494   # fusion FAQ — OUT, post_v1
  - HOS-2495   # fusion photos — OUT, post_v1
  - HOS-2498   # fusion data/price/services/practical — OUT, post_v1
  - HOS-2500   # fusion AI questions + translations — OUT, post_v1
  - HOS-2428   # phase-1 fix: saving a FAQ fails
  - HOS-2429   # phase-1 fix: remove dish/photo without confirmation
  - HOS-2438   # phase-1 fix: reputation busy/idle key
  - HOS-2442   # phase-1 fix: photos without plan never stop loading
  - HOS-2042   # optional landline phone (kept by the contact fusion)
areas:
  - web
  - i18n
umbrellaBranch: epic/HOS-2409-mi-cuenta-ui
smokeLabels:
  # Both editors are production surfaces of two verticals with real data and
  # plan-gated sections (photos limit, premium fields, calendar). Only staging
  # with real accounts shows every gate and save path.
  - status-needs-smoke-staging
---

# Mi Cuenta UI · Phase 4 · Editors

> Spec language is English (repo rule, as in HOS-2413). Owner decisions are
> quoted by their epic id with a short title.

## 1. Summary

Phase 4 unifies the accommodation editor and the listing (venue / experience)
editor VISUALLY, following option A of the audit («unify the field and visual
layer») plus the three sibling fusions the owner pulled into the epic
(location, contact, hub). It does not unify the form engines (D7: a single form
engine is a post-epic issue).

- **Shell, for all 32 editor pages:** section nav by container query with a
  sticky switcher below 60rem (D2 «nav del editor por container query»), a
  shared hub with a completeness meter, one width, `PageHeader`, and the save
  signal on every section (D8 «dos modelos de guardado»).
- **Section content, for 24 pages:** field kit, MediaManager (visual), Repeater,
  HoursEditor, translations look, reputation, and the location / contact / hub
  fusions. The remaining 8 sections (accommodation calendar, capacity-price,
  policies, SEO, AI questions; listing night info, promotions, AI questions)
  get the new shell here and their content in phase 5 (HOS-2503, HOS-2504).

## 2. Problem

From the audit and `origin/staging` `60a5ac14ca`:

- **Cramped desktop, no mobile nav.** `EditorShellLayout.astro` (146 lines)
  renders `EditorRouteNav` beside the account sidebar; at 1100px the form is
  ~508px wide; below 1100px (`@media (min-width: 1100px)`, line 134) the section
  nav disappears and mobile users must return to the hub for each section.
- **No fixed save bar, three save models with no signal.** Accommodation uses
  `ActionBar.client` (59 lines) at the bottom; seven sections save the page,
  photos/FAQ/calendar/reputation/video save per action; listing has a diff +
  guard form, carta/menú/eventos with their own Guardar and no guard
  (`VenueMenuManager.client.tsx` 1,589 lines, bug #20), and per-action photos,
  FAQ and promotions.
- **Two form engines, ~9 sibling pairs.** `use-accommodation-section-form.ts`
  (346) + `forms/*` against `ListingEditor.client.tsx` (1,201) +
  `section-renderers.tsx` (300). Siblings: FAQ 987 vs 1,004, photos 488 vs 902,
  contact (`ContactInfoSection` 323 / `forms/ContactForm` 127 vs
  `listing/editor/ContactSection` 127), location (`forms/LocationForm` 101 vs
  `VenueLocationSection` 155, lat/long as text), translations 451 vs 365, basic
  info 459 vs 359, social networks 278 vs 85.
- **Fields below standard.** Placeholder-only labels, controls of 32-35px,
  hand-written `*`, legends that repeat the h1, hardcoded Spanish (days in
  `OpeningHoursSection` 435, accommodation types in `BasicInfoSection:381-393`).
- **Worst CSS in the account.** `host/editor/PhotoSection.module.css` (49 hex);
  28 entries of `components/host/editor` and 8 of `components/listing/editor`
  in the literals exception list.
- **Reputation is P0.** `ExternalReputationSection.client.tsx` is 1,101 lines,
  no media queries, truncated URLs on mobile, one key for busy and idle
  (HOS-2438).

## 3. Goals

- **G-1.** Both editors share one shell: hub, section nav, switcher, width
  (`form-max`), `PageHeader`, flat `Section`s and async states.
- **G-2.** Section nav column only when the content area is ≥ 60rem (container
  query, not viewport); otherwise a sticky switcher «‹ · Listing · Section (n/N)
  ▾ · ›». The account sidebar is never transformed (HOS-318 D-1).
- **G-3.** Every section declares its save model in the editor registry
  (`'bar' | 'auto'`) and renders exactly one signal: `StickySaveBar` for `bar`,
  `AutoSaveChip` for `auto`. Never both in one form.
- **G-4.** Carta, menú del día and eventos move to the bar model with the
  unsaved-changes guard (D8).
- **G-5.** Every editor field uses the kit (visible label, hint, per-field error,
  44px control, 16px text); no placeholder-as-label, no hand-written `*`.
- **G-6.** One location component with a map for accommodation, venue location
  and meeting point (D12 «mapa en ubicación y punto de encuentro»); one contact
  component; one hub with a completeness meter.
- **G-7.** Every touched file ≤ 500 lines; the editor folders reach ZERO
  entries in both guard exception lists by the end of the phase (except files
  owned by HOS-2503/2504 sections, listed explicitly in the PR).
- **G-8.** Section `data-help` slugs are preserved; any change is announced on
  the issue and to HOS-2410 (owner AC).

## 4. Non-goals

- **NG-1.** A single form engine (D7: post-epic issue). The two engines stay;
  the fusions below are component-level.
- **NG-2.** Fusions the owner left post-MVP: FAQ (HOS-2494), photos (HOS-2495),
  data/price/services/practical (HOS-2498), AI questions + translations
  (HOS-2500). Here they get the shared visual layer only (MediaManager skin,
  Repeater, field kit, translation look).
- **NG-3.** Unifying the translation MODEL (listing to «generate with AI +
  edit»): separate spec (D10 «traducciones: mismo aspecto»).
- **NG-4.** Content of accommodation calendar, capacity-price, policies, SEO, AI
  questions, and listing night info, promotions, AI questions (phase 5). They
  DO get the shell, nav and save signal here.
- **NG-5.** Event and post editors under `eventos/[id]/editar` and
  `publicaciones/[id]/editar` (HOS-2505, phase 5).
- **NG-6.** Data model changes. The map stores the same `lat`/`long` fields the
  text inputs write today.
- **NG-7.** New runtime dependencies. The map reuses the existing
  `LocationPicker` (525 lines) and its map library.

## 5. Current baseline (`origin/staging` `60a5ac14ca`)

### 5.1 Shell and shared pieces

| File | Lines | Role |
|---|---|---|
| `layouts/EditorShellLayout.astro` | 146 | wraps `AccountLayout`; `AccountPageHeader`, `Breadcrumbs`, `EditorRouteNav`; one `@media (min-width: 1100px)` |
| `layouts/EditorSectionLayout.astro` | 68 | accommodation section wrapper |
| `layouts/ListingEditorSectionLayout.astro` | 64 | listing section wrapper |
| `components/host/editor/EditorHub.astro` | 196 | hub, already shared by both editors |
| `components/host/editor/EditorRouteNav.astro` | 158 | route nav column |
| `components/host/editor/EditorSectionNav.client.tsx` | 153 | section nav island |
| `components/host/editor/ActionBar.client.tsx` | 59 | bottom save bar (accommodation) |
| `lib/editor/editor-registry` | — | section registry + visibility |
| `components/listing/HiddenByBusinessLinesSummary.client.tsx` | 229 | listing hub notice |

No completeness meter exists as a component; completeness logic lives in
`use-publish-ready-prompt.ts` (accommodation) and inside `ListingEditor.client.tsx`
and `listing/editor/BasicInfoSection.client.tsx` (listing).

### 5.2 Section inventory and phase assignment

Accommodation (`propiedades/[id]/editar/*`, `EditorSectionLayout`):

| Page | Component today (lines) | Phase-4 work | Child |
|---|---|---|---|
| `index` (hub) | `EditorHub` 196 | shared hub + CompletenessMeter | 2499, 2493 |
| `datos` | `forms/BasicsForm` 156 (+ `BasicInfoSection` 459, `SocialNetworksSection` 278) | field kit, translated types, bar | 2488, 2487 |
| `contacto` | `forms/ContactForm` 127 + `ContactInfoSection` 323 | contact fusion | 2497 |
| `ubicacion` | `forms/LocationForm` 101 + `LocationPicker` 525 + `LocationExceptionPanel` 166 | location fusion, touch overlay | 2496 |
| `servicios` | `forms/ServicesForm` 148 | field kit, bar (no more Guardar at the bottom) | 2488, 2487 |
| `fotos` | `PhotoSection` 488 (+ `use-photo-section.ts` 649 …), `VideoSection` 50 | MediaManager skin, auto chip | 2489 |
| `preguntas` | `FaqSection` 987 | Repeater skin, split ≤ 500 | 2490 |
| `traducciones` | `TranslationPanel` 451 | Tabs + StatusPill + Alert | 2492 |
| `reputacion` | `ExternalReputationSection` 1,101 | kit, split, distinct busy/idle | 2515 |
| `calendario`, `capacidad-precio`, `politicas`, `seo`, `preguntas-ia` | 826 / 200 / 132 / 73 / `AiQuestionsPanel` 536 | shell + save signal only | 2486, 2487 (content: HOS-2503) |

Listing (`comercio/[vertical]/[id]/editar/*`, `ListingEditorSectionLayout`,
most pages mount `ListingEditor.client.tsx`):

| Page | Component today (lines) | Phase-4 work | Child |
|---|---|---|---|
| `index` (hub) | `EditorHub` + `HiddenByBusinessLinesSummary` 229 | shared hub + CompletenessMeter | 2499 |
| `datos` | `BasicInfoSection` 359, `BusinessLinesField` 251, `AccommodationPolicyFields` 375 | field kit, bar | 2488 |
| `contacto` | `ContactSection` 127, `ListingPhoneField` 166, `WhatsappControls` 111 | contact fusion, WhatsApp default | 2497 |
| `datos-practicos` | `PracticalInfoSection` 305 | field kit | 2488 |
| `precio` | `PriceSection` 192 | field kit, InputGroup «ARS» | 2488 |
| `servicios` | `BasicInfoSection` (services part) | field kit, bar | 2488, 2487 |
| `ubicacion` | `ListingEditor` + `LocationExceptionPanel` | location fusion with map | 2496 |
| `punto-de-encuentro` | `VenueLocationSection` 155 | location fusion with map | 2496 |
| `horarios` | `OpeningHoursSection` 435 | HoursEditor | 2491 |
| `fotos` | `MediaSection` 902, `ListingVideoWidget` 58 | MediaManager skin | 2489 |
| `preguntas` | `ListingFaqManager` 1,004 | Repeater skin, split | 2490 |
| `traducciones` | `ListingTranslationPanel` 365 | Tabs + StatusPill + Alert | 2492 |
| `carta` | `VenueMenuManager` 1,589 | Repeater + bar + guard, split | 2490, 2487 |
| `menu-del-dia` | `VenueDailySpecialsManager` 603 | Repeater + bar + guard | 2490, 2487 |
| `eventos` | `VenueEventsManager` 512 | Repeater + bar + guard | 2490, 2487 |
| `de-noche`, `promociones`, `preguntas-ia` | 419 / `VenuePromotionsManager` 489 / `AiQuestionsPanel` | shell + save signal only | 2486, 2487 (content: HOS-2504, HOS-2503) |

Totals: 32 editor pages get the shell; 24 get their content migrated here
(9 accommodation including the hub, 15 listing including the hub); 8 move to
phase 5.

### 5.3 Mechanisms to reuse

`lib/forms/use-unsaved-changes-guard.ts` + `leave-warning-registry.ts` (one
capture listener; handles `ClientRouter` soft navigation), `focus-first-invalid-field.ts`,
`useListingPlanGate.ts`, `show-confirmation-dialog.tsx`/`useConfirm`,
the editor registry, `sectionHelpAnchor` (`lib/help/help-entry`).

## 6. Proposed design

### 6.1 Editor shell (HOS-2486, HOS-2493, HOS-2499)

- `EditorShellLayout` keeps routing per section (HOS-318 D-1) and composes:
  `PageHeader` (listing name, back to list, status pill, preview link),
  `EditorSectionNav` (column) and `EditorSwitcher` (sticky bar), both fed by
  the registry, and the section slot inside the `form-max` column.
- The container is the shell content area (`container-type: inline-size`).
  `@container (min-width: 60rem)` shows the column and hides the switcher;
  below, the switcher shows. No viewport media query (D6 «breakpoints
  cerrados»); the `1100px` query is deleted.
- Switcher: previous / next links (real `<a>`, so the unsaved-changes guard
  intercepts them), a `Menu` listing sections with their status
  (`complete | incomplete | locked | hidden`), and «n/N». Locked sections show
  a lock and stay navigable (the section renders LockedState).
- **Hub (fusion IN).** One `EditorHub` for both editors, same width, rows of
  56px (the audit's good pattern), each row with a `StatusPill`; the listing
  badge CSS copy is deleted. `CompletenessMeter` reads the completeness the
  editors already compute (accommodation `use-publish-ready-prompt`, listing
  the `ListingEditor` checklist); a shared pure function maps both to
  `{ done, total, missing: SectionId[] }`, and each missing item links to its
  section.
- New kit pieces: `EditorSectionNav`, `EditorSwitcher`, `CompletenessMeter`
  (catalog names), in `components/account/ui/` with tests and gallery entries.
- ✗ `AccountPageHeader` and `Breadcrumbs` in the editor shell,
  `EditorRouteNav.astro` (replaced), `ActionBar.client.tsx` (replaced by
  StickySaveBar), `EditorShellLayout` breakpoint exception.

### 6.2 Save models (HOS-2487)

- The registry gains `saveModel: 'bar' | 'auto'` per section, required by type.
- `bar`: datos, contacto, ubicacion, servicios, capacidad-precio, politicas,
  seo, datos-practicos, precio, horarios, punto-de-encuentro, de-noche, carta,
  menu-del-dia, eventos. `auto`: fotos, preguntas, calendario, reputacion,
  traducciones (per row), preguntas-ia, promociones.
- `StickySaveBar` + `useSaveBar` wire into `use-unsaved-changes-guard`; the
  switcher and hub links are intercepted by the same guard (no second listener).
- Carta / menú / eventos: the managers keep their data shape, but edits become
  a local draft committed by the bar; leaving with a dirty draft warns. «Volver»
  appears through `PageHeader`.
- A test enumerates the registry and asserts every section has a model and that
  its page renders exactly the matching signal.

### 6.3 Field kit (HOS-2488)

- Every field in the 24 content pages uses `Field` + kit controls; `FormSection`
  becomes a kit `Section` with a 1-3 column grid by container query; legends
  no longer repeat the h1.
- Accommodation types and every hardcoded Spanish label move to `@repo/i18n`
  (es/en/pt).
- Currency inputs use `InputGroup` with «ARS» and `inputMode="decimal"`.
- Phones use the kit `PhoneField`; `CountryCodeCombobox` (391) is reused inside
  it if the kit piece lacks a country picker.
- Premium fields: the locked field shows which field triggers the plan gate
  (fixes «Función premium» without context) through `LockedState size="inline"`.

### 6.4 Photos UI (HOS-2489)

- One visual layer (`MediaManager` skin + `PhotoGrid` tile) applied to
  `PhotoSection` and `MediaSection`, each keeping its own logic hooks.
- Upload states, `useConfirm` before delete (HOS-2429), `AutoSaveChip`, alt-text
  warning visible in both. Reorder and alt for listing are NOT added here (that
  is HOS-2495, post_v1).
- Plan-limit loading never hangs (HOS-2442 behaviour pinned) and an
  entitlement error renders LockedState.
- ✗ 49 hex in `PhotoSection.module.css`, inline styles, ✕/📷 glyphs.

### 6.5 Repeater (HOS-2490)

- Kit `Repeater`: add, remove with `useConfirm`, move up/down (buttons with
  labels; drag optional only if the existing code has it), visible labels, row
  layout by container query, empty state.
- Adopted by FAQ (both), carta, menú del día and eventos. Files split ≤ 500
  lines (FAQ 987/1,004, carta 1,589, specials 603, events 512).
- FAQ save failure (HOS-2428) stays fixed; its regression test kept.

### 6.6 Hours (HOS-2491)

- Kit `HoursEditor`: day rows with `Switch` «Abierto», slots with time inputs
  ≥ 44px, «copiar a…», add/remove slot. Opening a closed day creates one slot.
- Day names from `Intl.DateTimeFormat` via `@repo/i18n` locale; no hardcoded
  Spanish; aria-labels translated.

### 6.7 Translations look (HOS-2492)

- Both panels render `Tabs` per language, `StatusPill` per field state, `Alert`
  for missing translations, tokens only (the oklch error chip goes). Models and
  data untouched (NG-3).

### 6.8 Location fusion with map (HOS-2496, IN)

- One `ListingLocationSection` with vertical parameters (accommodation,
  venue location, experience meeting point). It composes `LocationPicker`
  (moved into the kit area or wrapped) with a touch-activation overlay so the
  map never captures page scroll on mobile.
- Venue `ubicacion` and `punto-de-encuentro` gain the map; lat/long text
  inputs go behind a «Coordenadas» `Disclosure` for manual correction.
- Address duplicate / exception panels (`LocationExceptionPanel`,
  `LocationDuplicateNotice`) reused.
- ✗ `VenueLocationSection` (replaced), `forms/LocationForm` (replaced).

### 6.9 Contact fusion (HOS-2497, IN)

- One `ListingContactSection` with vertical parameters; `PhoneField`, optional
  landline kept (HOS-2042), WhatsApp visibility radios with a default value,
  no duplicate `name`.
- ✗ `forms/ContactForm`, `ContactInfoSection`, `listing/editor/ContactSection`,
  `ListingPhoneField`, `WhatsappControls` (folded in).

### 6.10 Reputation (HOS-2515)

- Split into list (`DataList` of connected sources with `StatusPill`), source
  form (`Field`s), toggles (`SwitchRow`), each ≤ 500 lines. Save model `auto`
  with chip; busy and idle labels distinct in es/en/pt (HOS-2438); URLs wrap,
  never truncate to «https:/…».

## 7. Data model / contracts

- No DB, API or schema change. The editor registry type gains `saveModel`.
- New i18n keys (es/en/pt): switcher, completeness, hours, accommodation types,
  location overlay, repeater actions.
- `data-help` slugs unchanged; the fusions keep both editors' existing slugs.

## 8. UX / UI behaviour

- Catalog v5 is the visual source of truth. Desktop at 1280px: content area
  960px → column + 720px form. Tablet and phone: switcher sticky under the
  account bar; save bar fixed at the bottom with safe-area on mobile, sticky in
  the 720 column on desktop.
- Save bar states: clean (hidden), dirty «Cambios sin guardar · Descartar ·
  Guardar», saving, saved, error with «Ir al primer error».

## 9. Acceptance criteria

- **AC-1.** In both editors, the section column is visible iff the content area
  is ≥ 60rem; otherwise the switcher is visible (Playwright at 1440, 1280, 1024,
  768 and 390px, with the sidebar open).
- **AC-2.** Switching section with unsaved changes (column, switcher prev/next,
  switcher menu, hub link) prompts the guard; confirming discards, cancelling
  stays (e2e in both editors).
- **AC-3.** Every registry section declares `saveModel`; each page renders only
  the matching signal (unit test over the registry + render test per page).
- **AC-4.** Carta, menú del día and eventos save through the bar and warn on
  leave with a dirty draft (e2e).
- **AC-5.** No field in the 24 content pages uses a placeholder as label, a
  hand-written `*`, or a control under 44px (axe + a test that scans rendered
  sections for `input:not([id])`, missing labels and computed height).
- **AC-6.** Accommodation types, weekday names and editor aria-labels render in
  es, en and pt (snapshot per locale).
- **AC-7.** Venue location and meeting point show a draggable pin; moving it
  updates the saved lat/long; the map does not capture a one-finger scroll on a
  390px viewport until activated.
- **AC-8.** One contact component and one location component serve both
  editors (no remaining import of the retired files); WhatsApp visibility has a
  default.
- **AC-9.** One hub serves both editors and shows a completeness meter whose
  missing items link to their sections.
- **AC-10.** Removing a dish, FAQ, special, event or photo asks for
  confirmation.
- **AC-11.** Reputation: distinct busy/idle copy in three locales, no truncated
  URL at 390px, files ≤ 500 lines.
- **AC-12.** Every file touched ≤ 500 lines (`VenueMenuManager`, both FAQs,
  `ExternalReputationSection`, `ListingEditor` if touched). `components/host/editor`
  and `components/listing/editor` have no entries left in either exception list,
  except files of phase-5 sections named in the PR.
- **AC-13.** Section `data-help` values are identical before and after (a test
  snapshots the list per editor).
- **AC-14.** Visual baselines for the 32 editor pages (light + dark, desktop +
  mobile) and the nesting sweep pass.
- **AC-15.** Staging smoke signed (§10).

## 10. Smoke plan

Accounts: host in trial with one published accommodation; host without plan;
`venue-owner` (restaurant with carta, menú, eventos); `experience-owner` (meeting
point); `host-venue`.

| Step | Check |
|---|---|
| 1 | At 1440px the column shows; at 1024px and on a phone the switcher shows; prev/next walk every section in registry order |
| 2 | Dirty a bar section, switch via the switcher → guard prompts; discard and save paths both work |
| 3 | Accommodation datos/servicios/contacto/ubicacion save through the bar; first-error link focuses the invalid field |
| 4 | Photos: upload, set alt, delete with confirmation, chip shows time; host without plan sees LockedState, not an endless spinner |
| 5 | FAQ add/edit/remove in both editors |
| 6 | Carta: add section + dish, leave without saving → warning; save → persisted after reload |
| 7 | Menú del día and eventos: same as step 6 |
| 8 | Hours: open a closed day → one slot; copy to other days; labels in en/pt |
| 9 | Venue location and experience meeting point: drag pin, save, reload, coordinates kept; scroll the page on a phone over the map |
| 10 | Contact: WhatsApp default, landline optional, saves in both editors |
| 11 | Translations look identical in both editors |
| 12 | Reputation: connect a source, busy/idle labels, long URL on a phone |
| 13 | Hub completeness: missing items link to sections; light and dark |

## 11. Risks

- **R-1.** Production editors of two verticals: a regression blocks owners from
  editing. Mitigation: per-section PRs, existing e2e (`listing-editor-helpers`,
  billing-*) kept green, staging smoke per PR.
- **R-2.** Moving carta/menú/eventos from per-action to draft-and-bar can lose
  edits if the draft logic is wrong. Mitigation: e2e for add/edit/remove/reorder
  then reload; guard on leave.
- **R-3.** Container query thresholds interact with the sidebar collapsed state
  (HOS-2549 remembered nav state). Mitigation: AC-1 runs with sidebar open and
  collapsed.
- **R-4.** Map on two new surfaces adds bundle weight. Mitigation: `client:visible`
  and the existing lazy chunk; no new library (NG-7).
- **R-5.** Help slugs drift during fusions. Mitigation: AC-13.
- **R-6.** `ListingEditor.client.tsx` (1,201) dispatches all listing sections;
  touching it for the save model risks conflicts with every other phase-4 PR.
  Mitigation: PR-1 lands the registry `saveModel` and the shell first; later
  PRs only touch their section renderer.

## 12. Decisions relied on

- **D2 · Nav del editor por container query** (column ≥ 60rem, switcher below;
  respects HOS-318 D-1 «una sección, una página»).
- **D5 · Secciones planas, barra degradé**.
- **D6 · Breakpoints cerrados** (30/48/64/80rem + container queries).
- **D7 · Unificación visual total; fusiones por issue** (owner 20/11: contact,
  hub and location IN; FAQ, photos, data/price/services, AI + translations OUT).
- **D8 · Dos modelos de guardado** (carta, menú y eventos pasan a la barra).
- **D9 · Sin acceso único**.
- **D10 · Traducciones: mismo aspecto** (model unification out).
- **D12 · Mapa en ubicación y punto de encuentro**.
- **D18 · Modo oscuro en alcance**.
- **D23 · Fallbacks inline fuera de la épica**.
- **Q1 · Names (HOS-2479), owner 2026-11-22.** Product-updates notes are
  «Novedades de Hospeda»; the mail subscription is «Newsletter por mail» (en/pt
  translated accordingly). No editor surface is renamed by it.
- **Q2 · Dashboard data for venue and experience owners (HOS-2475, HOS-2476),
  owner 2026-11-22.** A new protected aggregated endpoint per vertical, decided
  in phase 3 (HOS-2414). No editor work depends on it.

Assumptions:
- **A-1.** Menú del día and eventos (listing) are fully done here (HOS-2487 +
  HOS-2490 already cover them); HOS-2504 drops them and keeps night info,
  promotions and the `comercio/nuevo` 404.
- **A-2.** Reputation lives in HOS-2515 only; HOS-2503 drops it.
- **A-3.** The kit minimum is 44px (kit rule); HOS-2488 is corrected in Linear
  from «32px or more» to 44px.
- **A-4.** The 8 phase-5 sections get the shell and save signal here so no
  editor page keeps two looks of chrome between phases.

No open owner question blocks this spec.

## 13. Implementation plan

All PRs target `epic/HOS-2409-mi-cuenta-ui`, at most 2 open, titles
`[HOS-2415] <type>(web): …`, no magic word.

| PR | Scope | Children |
|---|---|---|
| PR-1 | Shell: EditorSectionNav, EditorSwitcher, shared hub + CompletenessMeter, PageHeader, registry `saveModel`, StickySaveBar/AutoSaveChip wiring for all 32 pages | 2486, 2493, 2499, 2487 (wiring) |
| PR-2 | Field kit on accommodation + listing form sections; contact fusion; reputation | 2488, 2497, 2515 |
| PR-3 | Location fusion with map; HoursEditor | 2496, 2491 |
| PR-4 | MediaManager skin; translations look | 2489, 2492 |
| PR-5 | Repeater; FAQ ×2, carta, menú del día, eventos to the bar with guard | 2490, 2487 (managers) |

## 14. Linear

Canonical tracking: HOS-2415 (parent HOS-2409). The 12 children already exist in
Linear (created by the owner on 2026-11-20); this spec proposes no new issues.
The internal order is fixed by HOS-2486 (editor shell first). Phase 3 must be
done first (Menu, DataList, ListingCard).

| Order | Issue | What | Decision | Labels | PR |
|---|---|---|---|---|---|
| 1 | HOS-2486 | Section nav by container query (column from 60rem of content, below it a sticky previous/next/menu switcher) | D2 | area-web | PR-1 |
| 2 | HOS-2493 | Total visual unification of both editors (same width, PageHeader, flat sections on 32 pages) | D7 | area-web | PR-1 |
| 3 | HOS-2499 | Fusion: hub + CompletenessMeter (IN) | D7, owner 20/11 | area-web | PR-1 |
| 4 | HOS-2487 | Save bar on every section; carta, menú and eventos move to the bar with guard | D8 | area-web | PR-1 (wiring), PR-5 (managers) |
| 5 | HOS-2488 | Field kit in both editors; controls are 44px minimum (Linear text corrected from 32px) | D7 | area-web | PR-2 |
| 6 | HOS-2497 | Fusion: contact, one component with PhoneField (IN) | D7 | area-web | PR-2 |
| 7 | HOS-2515 | Reputation to the kit (split to files of at most 500 lines); moved out of HOS-2503 | P0 | area-web | PR-2 |
| 8 | HOS-2496 | Fusion: location with map (IN) | D7, D12 | area-web | PR-3 |
| 9 | HOS-2491 | HoursEditor with translated texts | P0 | area-web | PR-3 |
| 10 | HOS-2489 | Photos UI (MediaManager), visual layer only | D7 | area-web | PR-4 |
| 11 | HOS-2492 | Translations with the same look | D10 | area-web, area-i18n | PR-4 |
| 12 | HOS-2490 | Repeater for FAQ, carta, menú del día and eventos (splits the big files) | D7 | area-web | PR-5 |

Out of the epic, unchanged: HOS-2494, HOS-2495, HOS-2498 and HOS-2500
(`post_v1`). Per-child acceptance criteria live in each Linear issue and in §9.
Rules common to all PRs: target `epic/HOS-2409-mi-cuenta-ui`, at most 2 open,
title `[HOS-24xx] <type>(web): …`, no magic word, `data-help` on every Section
(HOS-2410), each migrated file leaves both guard exception lists in the same PR.
