---
title: Mi Cuenta UI · Phase 5 · Long tail (remaining P2/P3 pages, content triplets, remaining editor sections, partner logo upload, exclusive deals, legacy retirement)
linear: HOS-2416
statusSource: linear
created: 2026-11-22
type: feature
parent: HOS-2409   # epic «rediseño visual de Mi Cuenta»
children:
  - HOS-2501   # profile & settings long tail + focus pages (FocusShell)
  - HOS-2502   # reviews, alliances, directory, benefit usages, AI assistants
  - HOS-2503   # host editor sections: calendar, capacity, policies, SEO, AI questions (reputation moved to HOS-2515)
  - HOS-2504   # commerce: night info, promotions, `comercio/nuevo` 404 (+ `no-encontrado`)
  - HOS-2505   # events, posts and promotions triplets + provider tabs
  - HOS-2506   # partner logo upload with preview (D13)
  - HOS-2507   # exclusive deals page to the kit (D21)
  - HOS-2508   # retire legacy components and CSS; guards with empty exceptions
related:
  - HOS-2413   # phase 2 kit and guards
  - HOS-2414   # phase 3 (EntityCard, DataList, ListingCard, KeyValueList, Stepper built there)
  - HOS-2415   # phase 4 (editor shell, Repeater, MediaManager skin)
  - HOS-2410   # help center (`ayuda/*` pages are outside this epic)
  - HOS-2431   # phase-1 fix: change password unreachable
  - HOS-2440   # phase-1 fix: silent cap of 50
  - HOS-2451   # phase-1 fix: promotions Cancel overlaps Save
  - HOS-1215   # partner self-service (open)
areas:
  - web
umbrellaBranch: epic/HOS-2409-mi-cuenta-ui
smokeLabels:
  # Partner logo upload goes through the real Cloudinary pipeline, which local
  # cannot reproduce (the audit saw broken images locally); role pages (editor,
  # sponsor, provider) need real role accounts.
  - status-needs-smoke-staging
---

# Mi Cuenta UI · Phase 5 · Long tail

> Spec language is English (repo rule, as in HOS-2413). Owner decisions are
> quoted by their epic id with a short title.

## 1. Summary

Phase 5 migrates every account page phases 3 and 4 left, adds the two small
features the owner kept in the epic (partner logo upload, D13; exclusive deals
on the kit, D21), and closes the epic by deleting the legacy primitives and
turning both CSS guards into hard rules with empty exception lists.

- **30 non-editor pages**: focus pages, settings long tail, tourist long tail,
  directory list and usage registration, benefit usages, AI assistants, events
  ×3, posts ×3, promotions ×3, provider, exclusive deals, `comercio/nuevo` ×2 and
  `no-encontrado`.
- **8 editor sections** whose content phase 4 left (they already have the new
  shell): accommodation calendar, capacity-price, policies, SEO, AI questions;
  commerce night info, promotions, AI questions.
- **Retirement**: zero imports of the legacy primitives, zero entries in both
  exception lists, zero dead CSS.

## 2. Problem

- **Two systems would coexist.** After phases 3-4, 38 pages still use
  `AccountSectionCard` (30 consumers today), `AccountButton.module.css` (35),
  `AccountSection.module.css` (31), `AccountPageHeader` (42), two empty states
  (28 + 17), two legacy paginations, `EditableContentCard` (7), `PropertyCard`
  (11) and own switches/badges.
- **Copied twins.** Events and posts lists share an identical `<style>`; access
  differs (events show a lock, posts redirect silently to `/mi-cuenta`); both cap
  at 50 silently (HOS-2440). Promotions (`PromotionForm.client` 970 lines) nests
  cards and uses the global `form--card` kit; partner and provider forms are
  near forks.
- **Focus pages reimplement the chrome.** `completar-perfil` (module 540
  lines, 3 breakpoints), `agregar-contrasena` (`SetPassword` 430 + module 289)
  and `cambiar-contrasena` share ~85% CSS and run under `BaseLayout`.
- **Literal-heavy files.** ~20 `oklch` in `BenefitUsagesPanel`, 9 entries of
  `components/host/host-trades` in the literals list, emoji/glyph icons.
- **Small feature gaps.** Partner logo is a pasted URL (D13); exclusive deals
  rows are inert (D21: kit now, richer data is a separate spec).
- **Guards still tolerate legacy.** Literals exceptions: 346 entries / 1,629
  hits; breakpoints: 38 / 59 (`origin/staging` `60a5ac14ca`).

## 3. Goals

- **G-1.** Every page in §5 uses `PageHeader`, `Section` and kit async states;
  no page under `/mi-cuenta/` keeps its own button, card, pagination, switch,
  badge or empty-state recipe (HOS-2416 AC).
- **G-2.** A `FocusShell` layout serves the three focus pages: minimal chrome,
  no sidebar, kit primitives.
- **G-3.** One `MyContentList` template + `ContentCard` serve events, posts and
  promotions lists; one editor template (phase-4 shell + `StickySaveBar`) serves
  their editors; the no-permission case is `LockedState`, never a redirect.
- **G-4.** Partner uploads a logo with preview through the existing media
  pipeline (D13).
- **G-5.** Exclusive deals use the kit with the data that exists today (D21).
- **G-6.** At the end: zero imports of the legacy primitives (§6.3), both guard
  exception lists empty, the strict zone covering all account CSS, visual and
  axe suites green in light and dark.

## 4. Non-goals

- **NG-1.** Richer exclusive-deal data (link, validity, conditions): separate
  spec (D21).
- **NG-2.** Translation model unification (D10), single form engine (D7),
  post_v1 fusions (HOS-2494/2495/2498/2500).
- **NG-3.** Help center pages `ayuda/index` and `ayuda/[id]` (owned by HOS-2410;
  they are in neither exception list today).
- **NG-4.** Tourist trial and «Plus» vs VIP (D22).
- **NG-5.** Promoting the kit to `components/ui/` (D17 follow-up).
- **NG-6.** Removing inline `t()` fallbacks in code this phase does not touch
  (D23).

## 5. Page inventory and assignment (`origin/staging` `60a5ac14ca`)

### 5.1 Non-editor pages (30)

| Route | Lines | Components today | Kit target | Child |
|---|---|---|---|---|
| `completar-perfil` | 98 | `ProfileCompletion.client` 462 (+ module 540), `ProfileCompletionBasicFields` 434, `ProfileCompletionMoreDetails` 369, `ProfileCompletionAvatarPicker` 228 | FocusShell + Stepper + field kit | 2501 |
| `agregar-contrasena` | 75 | `SetPassword.client` 430 (+ module 289) | FocusShell; «Saltar» as ghost after primary; status tokens on the strength bar | 2501 |
| `cambiar-contrasena` | 108 | `ChangePasswordForm.client` | FocusShell; forced vs voluntary copy; result state | 2501 |
| `newsletter` | 59 | `NewsletterPreferences.client`, `WhatsAppCTA` (switch already removed in phase 3) | Section, StatusPill, ErrorState | 2501 |
| `novedades` | 148 | `WhatsNewPageList.client` 152 | reading template, rows, Skeleton, ErrorState, Pagination (≈50 entries today) | 2501 |
| `alertas` | 65 | `AlertsList.client` 484 | DataList, ConfirmDialog, LockedState (catalog plan names) | 2501 |
| `historial-busquedas` | 93 | `SearchHistoryList.client` 771 (+ module 335) | DataList, ConfirmDialog, whole i18n sentences | 2501 |
| `recomendaciones` | 55 | `RecommendationsFeed.client` 463 (+ module 304) | EntityCard on background, EmptyState, LockedState | 2501 |
| `publica` | 46 | `DiscoveryDoorHub` | OptionCard, `accent` button | 2501 |
| `resenas` | 37 | `UserReviewsList.client` 408 | DataList, RatingStars, StatusPill, Pagination | 2502 |
| `aliados` | 191 | `AllianceApplicationsSection` 165, `PartnerStatsSection` 320, `PartnerMentionsSection` 253, `DiscoveryDoorHub` 248, `AllianceClaimBanner.client` 141 | ordered Sections, StatGrid, OptionCard, ErrorState per Section | 2502 |
| `directorio-proveedores` | 249 | `TradesDirectory.client`, shared `EmptyState` | FilterChips, tokenized cards, EmptyState with clear | 2502 |
| `…/[slug]/registrar-uso` | 341 | `RegisterUsageForm` | result state + back | 2502 |
| `usos-de-beneficio` | 106 | `BenefitUsagesPanel` (~20 oklch, native dialogs) | pending first with CountPill, DataList, StatusPill, FilterChips, Dialog | 2502 |
| `asistentes-ia` | 61 | `AiAssistantsPanel.client` 432 | NavTabs, Skeleton, CopyField, ConfirmDialog | 2502 |
| `asistentes-ia/historial` | 85 | `AiActivityHistory.client` 317 | NavTabs, compact filter bar, Pagination | 2502 |
| `ofertas-exclusivas` | 58 | `ExclusiveDealsList.client` 284 | PageHeader, DataList, Skeleton, EmptyState | 2507 |
| `eventos` | 277 | `EditableContentCard` 272, `AccountPagination`, two EmptyStates, `btn` | MyContentList + ContentCard + Pagination | 2505 |
| `eventos/nuevo` | 106 | `EventCreateForm` | editor template + StickySaveBar | 2505 |
| `eventos/[id]/editar` | 173 | `EventEditor.client`, `ContentMediaSection.client` 802 | editor template + StickySaveBar, split | 2505 |
| `publicaciones` | 253 | same set as `eventos` | MyContentList; LockedState instead of redirect | 2505 |
| `publicaciones/nuevo` | 57 | `PostCreateForm` | editor template | 2505 |
| `publicaciones/[id]/editar` | 166 | `PostEditor.client`, `PublicationSection.client` 339 | editor template | 2505 |
| `promociones` | 44 | `PromotionList.client` 417 | MyContentList, PageHeader actions, ConfirmDialog | 2505 |
| `promociones/nueva` | 53 | `PromotionForm.client` 970 | field kit, LockedState before the form (not on save), StickySaveBar, split | 2505 |
| `promociones/[id]/editar` | 67 | `PromotionForm.client` | same | 2505 |
| `proveedor` | 331 | `HostTradeEditForm.client` 467, `ProviderQrPanel`, `ProviderReviewsPanel`, `ProviderUsagesPanel` | NavTabs + CountPill, field kit, StickySaveBar | 2505 |
| `comercio/nuevo` | 41 | redirect | styled 404 for unknown verticals | 2504 |
| `comercio/nuevo/[vertical]` | 46 | redirect | styled 404 | 2504 |
| `no-encontrado` | 52 | `AccountSectionCard`, `AccountEmptyState` | EmptyState inside the shell | 2504 (A-3) |

### 5.2 Editor sections (8; shell from phase 4)

| Section | Component today (lines) | Kit target | Child |
|---|---|---|---|
| acc. `calendario` | `CalendarSection` 826, `PlanEntitlementGate` 156 | keep the grid; 12px floor; sync as its own Section; LockedState; split | 2503 |
| acc. `capacidad-precio` | `forms/CapacityPricingForm` 200 | field kit, InputGroup «ARS», no duplicate legends | 2503 |
| acc. `politicas` | `forms/PoliciesForm` 132 | field kit | 2503 |
| acc. `seo` | `forms/SeoForm` 73 | field kit, Textarea counter | 2503 |
| acc. + commerce `preguntas-ia` | `AiQuestionsPanel` 536 (shared) | kit primitives, split | 2503 |
| commerce `de-noche` | `NightInfoSection` 419 | FormSection + segmented Tabs | 2504 |
| commerce `promociones` | `VenuePromotionsManager` 489 | DataList, StatusPill, Button, Skeleton, ConfirmDialog, LockedState when the plan lacks promotions | 2504 |

(`preguntas-ia` is one shared component serving two pages; 8 pages in total.)

Assignment notes: reputation left HOS-2503 for HOS-2515 (owner 20/11); commerce
menú del día and eventos are done in phase 4 (HOS-2415 A-1), so HOS-2504 keeps
only night info, promotions and the 404s.

## 6. Proposed design

### 6.1 New templates and pieces

| Piece | Consumer | Notes |
|---|---|---|
| `FocusShell.astro` | 3 focus pages | Astro layout like `AccountShell` (OD-2): compact header, no sidebar, `reading` width, `AccountFooter` |
| `MyContentList` | events, posts, promotions lists | PageHeader with «Crear», filters, `ContentCard` grid, Pagination without cap |
| `ContentCard` | same | replaces `EditableContentCard` and its two identical `<style>` blocks |
| `RatingStars` | reviews | read-only; replaces 3 star styles |
| `FilterChips` | directory, benefit usages | 44px chips, `aria-pressed` |
| `CopyField` | AI assistants | copy with announced feedback |
| `AvatarUploader`-style `ImageUploader` | partner logo | preview, type/size validation, client compression |

All follow the kit README and land with tests and gallery entries.

### 6.2 Partner logo (HOS-2506)

- `ImageUploader` in the partner form: pick or drop, client-side type check
  (png, jpeg, webp, svg if the media package allows it) and size cap,
  compression, preview, then upload through `@repo/media` (Cloudinary) using the
  same signed-upload path the avatar uses; the saved value is the resulting URL
  in the existing `logoUrl` field (no schema change).
- The URL text field remains as a secondary «Pegar URL» `Disclosure` (A-4).
- Status shown as `StatusPill` + next-action `Alert` (already built in phase 3).

### 6.3 Retirement (HOS-2508, last PR of the epic)

Delete, once `git grep` shows no consumer:
`AccountPageHeader`, `AccountSectionCard`, `AccountSection.module.css`,
`AccountButton.module.css`, `AccountEmptyState` (.astro/.tsx/.module.css),
`AccountPagination.astro`, `EditableContentCard`, `PropertyCard.astro`,
`ConversationReply` (if not gone), `TradeCategoryBadges`,
`NewsletterStatusBadge`, own switches, `GradientButton` usage in account
(the component stays for marketing), `HostTradesAccessDenied` (→ LockedState),
the `legacy` branch of `AccountLayout` if HOS-2413 has not removed it, and the
`EditorRouteNav`/`ActionBar` leftovers. `shared/feedback/EmptyState.astro` and
`shared/feedback/Pagination.astro` are deleted only if no public page uses them;
otherwise they stay and leave the account scope.

Guards:
- `account-css-literals-exceptions.json` and
  `account-breakpoints-exceptions.json` become empty and their ceilings 0; the
  guard code keeps the list mechanism but CI fails on any entry (hard rule).
- `scripts/lib/account-css-scope.ts` keeps covering every account folder and the
  shared folders file by file.
- Dead CSS: a one-off check (unused class selectors in account CSS Modules) run
  in the PR and reported; no new dependency (A-5).

## 7. Data model / contracts

- No DB, API or schema change (partner logo reuses `logoUrl`; deals use
  existing fields).
- i18n: new keys for FocusShell copy variants, MyContentList, uploader,
  filter chips, reviews; whole sentences instead of `.toLowerCase()` assembly in
  history.

## 8. UX / UI behaviour

- Catalog v5 is the visual source of truth. Same mobile rules as phases 3-4.
- Publications without permission show `LockedState reason.kind='permission'`
  like events (one answer for one case).
- Promotions without plan show `LockedState` before the form opens (fixes «Tu
  plan no incluye promociones» only on save).

## 9. Acceptance criteria

- **AC-1.** The 30 pages of §5.1 and the 8 sections of §5.2 render one
  `PageHeader` h1 (or FocusShell heading), flat `Section`s and kit async states.
- **AC-2.** `git grep` over `apps/web/src` finds no import of any §6.3 legacy
  primitive (a test or guard asserts the list).
- **AC-3.** Both exception lists are empty with ceilings 0, and the guards fail
  on a synthetic entry (guard tests).
- **AC-4.** Events, posts and promotions lists share `MyContentList`; > 50 items
  paginate (e2e); posts without permission render LockedState, not a redirect.
- **AC-5.** Focus pages render in FocusShell; `cambiar-contrasena` shows the
  voluntary copy when reached from edit profile and the forced copy when the
  middleware sends the user.
- **AC-6.** Partner uploads a png/jpeg/webp logo, sees the preview before
  saving, an oversize or wrong-type file is rejected with a field error, and the
  saved logo renders on the public partner surface (staging smoke).
- **AC-7.** Exclusive deals use PageHeader, DataList, Skeleton and EmptyState
  without asking the API for new fields.
- **AC-8.** No `oklch`/hex literal, native `confirm()`/`<dialog>` or emoji icon
  in account code (`check:no-native-dialogs`, literals guard).
- **AC-9.** Every file touched ≤ 500 lines (`PromotionForm` 970, `CalendarSection`
  826, `ContentMediaSection` 802, `SearchHistoryList` 771, `AiQuestionsPanel` 536).
- **AC-10.** Visual regression (light + dark, desktop + mobile) and axe pass
  over every account route; the nesting sweep passes.
- **AC-11.** Staging smoke signed (§10).

## 10. Smoke plan

| Step | Account | Check |
|---|---|---|
| 1 | new user | `completar-perfil` stepper end to end; `agregar-contrasena` skip and set |
| 2 | any | `cambiar-contrasena` from edit profile (voluntary copy) |
| 3 | tourist-free | alerts, history, recommendations: lock states with catalog plan names; deletes confirm |
| 4 | host | directory list filters, register usage → back; benefit usages pending first |
| 5 | editor (seed `editor`) | events and posts lists, create and edit with the save bar; >50 pagination if seeded |
| 6 | host without editor role | posts → LockedState, not redirect |
| 7 | sponsor / host without plan | promotions: lock before the form; with plan, create/edit/delete |
| 8 | host-provider | provider tabs with counts, save bar |
| 9 | partner | logo upload with preview, wrong type rejected, public render |
| 10 | host in trial | calendar, capacity-price, policies, SEO, AI questions |
| 11 | venue-owner | night info, venue promotions (lock when the plan lacks them) |
| 12 | all | light and dark, 390 and 1440px; unknown `comercio/nuevo/x` shows the styled 404 |

## 11. Risks

- **R-1.** Retirement breaks a consumer outside `/mi-cuenta/` (e.g. a public page
  importing `AccountButton.module.css`). Mitigation: grep the whole `apps/web/src`
  and run the full visual suite before deleting; keep shared files that public
  pages need, moved out of the account scope.
- **R-2.** Media upload behaves differently locally (Cloudinary not configured,
  per the audit). Mitigation: unit tests with a mocked uploader + staging smoke.
- **R-3.** `PromotionForm` (970) is shared by three roles. Mitigation: split
  with its existing tests green; smoke per role.
- **R-4.** Phase 5 depends on every phase-3/4 PR having removed its exception
  entries. Mitigation: HOS-2508 is the last PR and fails loudly if any entry
  remains; each earlier PR lowers the ceilings.
- **R-5.** `CalendarSection` grid is a «keep distinct» pattern in the audit;
  over-refactoring it breaks the good mobile grid. Mitigation: restyle only, keep
  the grid structure, visual baseline before/after.

## 12. Decisions relied on

- **D5 · Secciones planas, barra degradé**; **D6 · Breakpoints cerrados**.
- **D9 · Sin acceso único** (posts lock, promotions lock before the form).
- **D11 · Ajustes en Preferencias** (newsletter/history already linked in phase 3).
- **D13 · Logo de partner con subida**.
- **D16 · Un componente React por pieza**; **D17 · Ubicación del kit**.
- **D18 · Modo oscuro en alcance**.
- **D21 · Ofertas exclusivas al kit** (data expansion out).
- **D23 · Fallbacks inline fuera de la épica**.
- **Q1 · Names (HOS-2479), owner 2026-11-22.** Product-updates notes are
  «Novedades de Hospeda»; the mail subscription is «Newsletter por mail» (en/pt
  translated accordingly). HOS-2501 uses these names on the `newsletter` and `novedades` pages (titles, sidebar item), keys in es, en and pt.
- **Q2 · Dashboard data for venue and experience owners (HOS-2475, HOS-2476),
  owner 2026-11-22.** A new protected aggregated endpoint per vertical, decided
  in phase 3 (HOS-2414). No phase-5 work depends on it.
- **OD-2 · Shell como layout Astro** (FocusShell follows it); **OD-9 · Guards
  solo en cuenta, lista que solo baja** (now down to zero).

Assumptions:
- **A-1.** Focus pages are phase 5 (HOS-2501), not phase 3 (HOS-2413 NG-5 is
  superseded by the Linear child).
- **A-2.** HOS-2503 without reputation; HOS-2504 without menú del día and
  eventos.
- **A-3.** `mi-cuenta/no-encontrado` joins HOS-2504 (it is the other «404»
  surface); `kit/` and `ayuda/*` are out of scope.
- **A-4.** The partner URL field stays as a secondary option (partners who
  already host their logo elsewhere keep working).
- **A-5.** Dead-CSS detection is a scripted one-off in HOS-2508, not a new CI
  guard.

No open owner question blocks this spec.

## 13. Implementation plan

All PRs target `epic/HOS-2409-mi-cuenta-ui`, at most 2 open, titles
`[HOS-2416] <type>(web): …`, no magic word except as the epic's own promotion
rules say.

| PR | Scope | Children |
|---|---|---|
| PR-1 | FocusShell + profile/settings long tail | 2501 |
| PR-2 | Tourist long tail + exclusive deals (RatingStars, FilterChips, CopyField) | 2502, 2507 |
| PR-3 | MyContentList, ContentCard, events/posts/promotions triplets, provider tabs | 2505 |
| PR-4 | Remaining editor sections (host and commerce), 404s, `no-encontrado` | 2503, 2504 |
| PR-5 | Partner logo upload | 2506 |
| PR-6 | Retirement + guards to zero (last, after every other PR of phases 3-5) | 2508 |

## 14. Linear

Canonical tracking: HOS-2416 (parent HOS-2409). The 8 children already exist in
Linear (created by the owner on 2026-11-20); this spec proposes no new issues.
Depends on phases 3 and 4 (EntityCard, DataList, KeyValueList, Stepper and the
editor shell). HOS-2508 always goes last.

| Order | Issue | What | Decision | Labels | PR |
|---|---|---|---|---|---|
| 1 | HOS-2501 | Remaining profile and settings pages, password flows (FocusShell for the 3 focus pages; newsletter and history: only the switch left in phase 3, the rest is here) | long tail | area-web | PR-1 |
| 2 | HOS-2502 | Reviews, partners, directory, usages and AI assistants | long tail | area-web | PR-2 |
| 3 | HOS-2507 | Exclusive deals to the kit | D21 | area-web | PR-2 |
| 4 | HOS-2505 | Events, posts, promotions and provider tabs | long tail | area-web | PR-3 |
| 5 | HOS-2503 | Remaining host sections (calendar, capacity, policies, SEO, AI questions); reputation removed, it lives in HOS-2515 (phase 4) | long tail | area-web | PR-4 |
| 6 | HOS-2504 | Remaining commerce (night info, promotions, 404 of `comercio/nuevo`) plus `mi-cuenta/no-encontrado`; menú del día and eventos removed, they live in HOS-2487/HOS-2490 (phase 4) | long tail | area-web | PR-4 |
| 7 | HOS-2506 | Partner logo upload with preview (`@repo/media`, `logoUrl`) | D13 | area-web | PR-5 |
| 8 | HOS-2508 | Retire legacy components and CSS; guards to zero | closes the epic | area-web | PR-6 |

Per-child acceptance criteria live in each Linear issue and in §9. Rules common to
all PRs: target `epic/HOS-2409-mi-cuenta-ui`, at most 2 open, title
`[HOS-24xx] <type>(web): …`, `data-help` on every Section (HOS-2410), each migrated
file leaves both guard exception lists in the same PR.
