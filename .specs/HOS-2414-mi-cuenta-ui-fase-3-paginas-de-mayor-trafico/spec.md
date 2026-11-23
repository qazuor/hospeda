---
title: Mi Cuenta UI · Phase 3 · High-traffic pages (dashboards, profile, preferences, favorites, both inboxes, listings, subscription and add-ons, provider detail)
linear: HOS-2414
statusSource: linear
created: 2026-11-22
type: feature
parent: HOS-2409   # epic «rediseño visual de Mi Cuenta»
children:
  - HOS-2472   # provider detail: contact button + «no encontrado» copy (D14, high priority)
  - HOS-2473   # general dashboard to the kit
  - HOS-2474   # host dashboard: separate from the general one, no duplication (+ HOS-2214)
  - HOS-2475   # new dashboard for venue owners
  - HOS-2476   # new dashboard for experience owners
  - HOS-2477   # new dashboard for partners
  - HOS-2478   # edit profile with save bar and security section
  - HOS-2479   # preferences: every on/off in one place
  - HOS-2480   # favorites and collections (split the 992-line island)
  - HOS-2481   # guest inbox + thread (ConversationThread, Composer)
  - HOS-2482   # owner inbox + thread (gate and login return)
  - HOS-2483   # properties list (ListingCard, action menu, pagination)
  - HOS-2484   # venue / experience lists + «Mis locales» / «Mis experiencias» nav
  - HOS-2485   # subscription + add-ons (sidebar item, Plan / Complementos tabs)
related:
  - HOS-2413   # phase 2: the kit this phase consumes (must be closed first, §5.4)
  - HOS-2415   # phase 4: editors
  - HOS-2416   # phase 5: long tail + legacy retirement
  - HOS-2410   # help center: owns the `data-help` convention
  - HOS-2214   # host dashboard 403 for a host without plan
  - HOS-2418   # phase-1 fix: host dashboard links to the guest inbox
  - HOS-2419   # phase-1 fix: chat bubbles inverted
  - HOS-2420   # phase-1 fix: «Sin colección» filters only the current page
  - HOS-2421   # phase-1 fix: listing false empty
  - HOS-2422   # phase-1 fix: guest inbox false empty
  - HOS-2423   # phase-1 fix: collection page lacks venues/experiences
  - HOS-2424   # phase-1 fix: dashboard «0» on failure
  - HOS-2433   # phase-1 fix: owner inbox without gate / return URL
  - HOS-2439   # phase-1 fix: reply reloads the page, 14px textarea
  - HOS-2179   # in flight: add-on store (conflict risk with HOS-2485)
areas:
  - web
  - billing
  - api      # new aggregate stats endpoints for venue and experience dashboards (Q2, decided 2026-11-22)
umbrellaBranch: epic/HOS-2409-mi-cuenta-ui
smokeLabels:
  # Subscription, add-ons, properties (plan cap notice) and the host dashboard
  # (plan-locked state) are billing UI: they need the staging billing smoke
  # (CLAUDE.md «Billing testing»). The rest needs a staging smoke per role
  # because only real accounts show every gate.
  - status-needs-smoke-staging
---

# Mi Cuenta UI · Phase 3 · High-traffic pages

> Spec language is English (repo rule, as in HOS-2413). Owner decisions are
> quoted by their epic id with a short title (D1…D24 in HOS-2409, OD-n in
> HOS-2413).

## 1. Summary

Phase 3 migrates the P0/P1 pages of the 20/11/2026 audit to the phase-2 kit.
It changes page CONTENT for the first time: phase 2 only changed the chrome.

- **16 existing pages** move to the kit: general dashboard, host dashboard,
  edit profile, preferences, favorites, collection detail, both inboxes with
  their threads, properties, listing list, subscription, add-ons, provider
  detail and the partner page.
- **2 new pages**: a venue-owner dashboard and an experience-owner dashboard
  (D19 «tableros por vertical»). The partner dashboard reuses the partner page.
- **Navigation changes**: «Mis locales» and «Mis experiencias» as separate
  sidebar items (D20 «nombres de comercio»), and «Complementos» as its own item
  under «Cuenta» plus a tab inside Mi suscripción (D15 «complementos en nav y
  pestañas»).
- **Data pieces the kit left out on purpose** (HOS-2413 NG-4) are built here,
  each in the PR of its first consumer: StatCard/StatGrid, DataList/ListRow,
  KeyValueList, Menu (overflow), Avatar, EntityCard, ListingCard,
  ConversationThread + MessageBubble + Composer, PlanSummary, Stepper.

## 2. Problem

From the audit (staging `b66bf18705`) and re-verified on `origin/staging`
`60a5ac14ca`:

- **The heaviest pages carry the oldest code.** `mi-cuenta/index.astro` is 733
  lines with stats painted by a DOM script (`AccountStatsGrid.astro` 367 lines);
  `UserFavoritesList.client.tsx` is 992 lines plus a 493-line module;
  `propiedades/index.astro` is 629 lines over `PropertyCard.astro` (585 lines,
  11 consumers); `comercio/index.astro` is 612 lines.
- **Failures read as empty or zero** on the dashboard, the guest inbox and the
  listing list (phase-1 fixes HOS-2421/2422/2424 patch the logic; this phase
  makes the UI unable to regress by using `AsyncRegion`).
- **Inconsistent gates.** The host dashboard shows a raw «Entitlement required»
  to a host without a plan (HOS-2214); favorites shows two upsells and a
  disabled «Crear colección» that «Mover» contradicts; the owner inbox has no
  permission gate and no login return URL (HOS-2433).
- **Inverted chat.** Both threads copy CSS and align bubbles by sender type, not
  by viewer (HOS-2419); replying reloads the page and the textarea is 14px
  (HOS-2439).
- **Duplicated settings.** Newsletter and search history carry their own
  `role="switch"` (`NewsletterContentTypeToggles`, `SearchHistoryList.client.tsx`
  771 lines) next to `PreferenceToggles.client.tsx` (598 lines, its own switch).
- **Billing dead ends.** Subscription renders state and price as loose
  paragraphs with equal headings; add-ons has no nav entry, no back step and no
  stepper (HOS-2441) and ends in «No hay suscripciones disponibles» (HOS-2426).
- **Navigation names drift.** One «comercio» item for two verticals; add-ons
  borrows `activeSection="suscripcion"`.
- **Provider detail has no way to contact the provider** and its not-found copy
  talks about a scanned QR (bug #18, D14 «contacto del proveedor»).

## 3. Goals

- **G-1.** Each page in §6 renders a single `PageHeader` (the only `h1`), flat
  `Section`s (D5 «secciones planas, barra degradé»), and kit async states. No
  page in scope keeps an import of a legacy primitive listed in §6.3.
- **G-2.** Every async region uses `AsyncRegion` with its five states (OD-10).
  A failed fetch can never render as empty, «0» or a blank 404.
- **G-3.** Every role, plan or permission block uses `LockedState` (D9 «sin
  acceso único»), with plan names read from the catalog, never a literal.
- **G-4.** One `ConversationThread` serves both inboxes; alignment depends on
  the `viewer` prop; replying is optimistic and never reloads the page.
- **G-5.** Every on/off setting has one source: Preferences (D11 «ajustes en
  Preferencias»). Other pages show the state and link there.
- **G-6.** The general and host dashboards do not duplicate each other (D19);
  venue owners, experience owners and partners get an equivalent dashboard built
  only from data the API exposes, plus one new aggregate endpoint per vertical
  for venue and experience owners (Q2, decided 2026-11-22).
- **G-7.** Every file touched ends at or below 500 lines, and each migrated file
  leaves both guard exception lists in the same PR (OD-9: lists only shrink).
- **G-8.** Every Section carries `data-help` per HOS-2410's convention (owner AC,
  20/11/2026).

## 4. Non-goals

- **NG-1.** Editors (accommodation and listing sections, hub, nav, save bar):
  phase 4 (HOS-2415).
- **NG-2.** P2/P3 pages: phase 5 (HOS-2416). Newsletter and search history are
  touched here ONLY to remove their own switch (G-5); their full migration is
  HOS-2501.
- **NG-3.** Focus pages (`agregar-contrasena`, `cambiar-contrasena`,
  `completar-perfil`). HOS-2413 NG-5 parked them «for phase 3», but the Linear
  child that owns them is HOS-2501 (phase 5). This spec follows Linear (A-1).
  Phase 3 only adds the «Cambiar contraseña» link in the Security section of
  edit profile.
- **NG-4.** Deleting legacy components. They are retired in HOS-2508 once their
  last consumer is gone.
- **NG-5.** Tourist free trial and «Plus» vs VIP (D22 «prueba del turista,
  aparte»). LockedState only renders «Empezar prueba» when a caller passes it.
- **NG-6.** New statistics the API does not compute (HOS-734 is Canceled;
  HOS-1063 found the partner analytics column empty). Dashboards show what exists.
- **NG-7.** Inline `t()` fallbacks in untouched code (D23). New code adds none.
- **NG-8.** New runtime dependencies.

## 5. Current baseline (`origin/staging` `60a5ac14ca`, 2026-11-22)

### 5.1 Kit and shell

- The kit exists in `apps/web/src/components/account/ui/` and is exported from
  `index.ts`: Button, LinkButton, TextLink, Section, Field + controls, StatusPill,
  CountPill, Dialog, Drawer, ConfirmDialog/`useConfirm`, Pagination, Tabs,
  NavTabs, Switch, SwitchRow, PageHeader, Skeleton, EmptyState, ErrorState,
  Alert, AsyncRegion/`settleAsync`, Toast, StickySaveBar/`useSaveBar`,
  AutoSaveChip, LockedState, `helpAttr`, `KitNestingError`.
- No page imports the kit yet. Only `AccountLayout.astro`, `AccountShell.astro`
  and the hidden gallery `mi-cuenta/kit/index.astro` do.
- The shell is ON (`AccountLayout` `shell = 'account'`, T-031). The `legacy`
  rollback prop still exists until HOS-2413 deletes it.

### 5.2 Guards

- `pnpm check:account-css-literals` (exceptions ceiling 346 entries / 1,629
  hits) and `pnpm check:account-breakpoints` (38 / 59). Pages of this phase in
  the lists: `index`, `comercio/index`, both inboxes and threads,
  `favoritos/index`, `favoritos/colecciones/[id]`, `preferencias/index`,
  `propiedades/index`; components such as `AccountStatsGrid.astro`,
  `AccountSectionCards.astro`, `UserFavoritesList.module.css`,
  `ProfileEditForm.module.css`, `PartnerEditForm.module.css`,
  `HostDashboard.module.css`, `PropertyCard.astro`, `ListingActions.module.css`,
  `ListingViewsWidget.module.css`, `VenueMenuQrWidget.module.css`,
  `VenueListingStatsPanel.module.css`, `NewsletterPreferences.module.css`.

### 5.3 Page inventory (lines are the page file; components one level down)

| Route | Lines | Main components today |
|---|---|---|
| `index` | 733 | `AccountStatsGrid.astro` 367, `AccountSectionCards.astro` 146, `DashboardController.client` |
| `host-dashboard` | 56 | `AccountPageHeader`, `HostDashboard.client` 372 (`hostDashboardApi.get` → `/protected/host/dashboard`) |
| `editar` | 204 | `ProfileEditForm.client` 407 + 3 sections (285/211/169), `useProfileEditSubmit.ts` 362, `AvatarUpload.client` 329 |
| `preferencias` | 148 | `PreferenceToggles.client` 598 (own switch), `RestartTour.client` |
| `favoritos` | 169 | `UserFavoritesList.client` 992 (+ module 493), `CreateCollectionCTA` 174, `CollectionUsageMeter` 133, `MoveToCollectionModal` 478, `CreateEditCollectionModal` 458 |
| `favoritos/colecciones/[id]` | 880 | `BookmarkGrid.tsx` 342, `EditableNote` 309, `CollectionDetailActions` 169, shared `Breadcrumbs` |
| `consultas` | 385 | `AccountSectionCard`, `AccountEmptyState`, `AccountPageHeader`, `<style>` |
| `consultas/[conversationId]` | 377 | `ConversationReply.client` 196, `ListingGoneNotice` |
| `consultas-propietario` | 302 | same set as `consultas` |
| `consultas-propietario/[conversationId]` | 315 | same set as the guest thread |
| `propiedades` | 629 | `PropertyCard.astro` 585, `AccountPagination.astro`, shared `EmptyState`, `AccountButton.module.css` |
| `comercio` | 612 | `AccountSectionCard`, `AccountEmptyState`, `ListingActions.client` 288, `ListingViewsWidget.client` 350, `VenueMenuQrWidget.client` 489, `VenueListingStatsPanel`, `TourController.client` 159 |
| `suscripcion` | 132 | `TrialSummary.astro` 162, `MySubscriptions.astro`, `PromoCodeRedeem.client`, `SubscriptionReturn.client` |
| `complementos` | 29 | `AddonPurchase`, `RecurringAddonWithdrawal` |
| `directorio-proveedores/[slug]` | 382 | `DirectoryReviewsList`, `TradeCategoryBadges`, `HostTradesAccessDenied` |
| `partner` | 234 | `PartnerEditForm.client` 358 |

### 5.4 Data available for the new dashboards (D19)

- **Host:** `GET /protected/host/dashboard` (property counts, plan info, unread
  conversations).
- **Venue / experience owners:** `ownerListingsApi.listMine({ vertical })`
  (`/protected/{venues|experiences}/mine`: id, name, slug only);
  `listingAnalyticsApi.getTrafficStats` (Umami traffic per ONE listing,
  entitlement-gated `view_basic_stats`); section states per listing. No
  aggregate per owner exists today. Decision Q2 (2026-11-22): add one protected
  aggregate endpoint per vertical instead of composing N calls in the client
  (§6.2, §7).
- **Partner:** `partnerApi.mineStats({ windowDays: 7 | 30 })`
  (`/protected/partners/mine/stats`: `available`, partner, views and clicks).
  Today rendered by `PartnerStatsSection.astro` on `aliados`, not on `partner`.
- **Unread owner conversations per vertical:** to be confirmed in the first task of HOS-2475 (the
  host endpoint returns one count for the host; no venue/experience split was
  found).

### 5.5 Dependencies on phase 2

- **Visual regression (HOS-2471, T-030) is not on staging yet**, and neither is
  the structural `[data-kit-section] [data-kit-section]` sweep. Phase 3's
  baselines and nesting checks need both. This phase starts when HOS-2413
  closes (A-2).

## 6. Proposed design

### 6.1 Per-page migration inventory

The per-page inventory (what each page adopts from the kit and what it retires)
lives in [`docs/page-inventory.md`](docs/page-inventory.md). Each child issue in §14
owns the pages it lists there.

### 6.2 New data pieces (built in the first consumer's PR)

| Piece | First consumer | Notes |
|---|---|---|
| StatCard / StatGrid | HOS-2473 | «—» + retry on error; grid by container query |
| ListRow / DataList | HOS-2473 / HOS-2481 | rows in a grid from 40rem container, stacked below; > 2 actions → Menu |
| Avatar | HOS-2473 | initials fallback (replaces 4 copies) |
| Menu (overflow) | HOS-2483 | WAI-ARIA menu button, labelled trigger |
| ListingCard | HOS-2483 | shared with listing; vertical as prop |
| EntityCard | HOS-2480 | favorites, collections, recommendations (phase 5) |
| ConversationThread + MessageBubble + Composer | HOS-2481 | `viewer: 'guest' \| 'owner'`; optimistic send |
| KeyValueList | HOS-2485 | `<dl>` |
| Venue / experience owner stats endpoint | HOS-2475 / HOS-2476 | service in `service-core` + protected route + tests, same idea as `/protected/partners/mine/stats` (Q2) |
| PlanSummary, Stepper, OptionCard | HOS-2485 | catalog-driven, no price literal (G7 guard) |

Each piece follows the kit README (one React component + CSS Module, RO-RO,
JSDoc, i18n under `account.ui.*`, tokens only, `helpId` optional) and lives in
`apps/web/src/components/account/ui/` with tests in
`apps/web/test/components/account/ui/`. It is added to the kit gallery.

### 6.3 Legacy primitives this phase removes from its pages

`AccountPageHeader`, `AccountSectionCard`, `AccountSection.module.css`,
`AccountButton.module.css`, `AccountEmptyState` (.astro/.tsx),
`shared/feedback/EmptyState.astro`, `AccountPagination.astro`,
`AccountStatsGrid.astro`, `AccountSectionCards.astro`, `ConversationReply.client`,
own switches (`PreferenceToggles`, `SearchHistoryList`,
`NewsletterContentTypeToggles`), `TradeCategoryBadges`.
Deleting the files is HOS-2508's job; this phase deletes a file only when it
was its last consumer (`AccountStatsGrid`, `AccountSectionCards`,
`ConversationReply`), and says so in the PR.

### 6.4 Gates and session-blindness

- Pages stay session-blind in the sense the guard checks (`mi-cuenta/` is
  exempt as the personalized surface, but per-user data still lives in islands
  where it is today; no new `Astro.locals` read beyond the existing auth gate).
- Gates use `PermissionEnum`, never roles (`check-role-never-decides`).
- Plan reasons come from `useListingPlanGate` / `lib/billing/*` catalog readers;
  `check:commercial-values` (G7) stays green.

## 7. Data model / contracts

- No DB or migration change.
- API (Q2, decided 2026-11-22): one protected aggregate endpoint per vertical,
  same shape idea as `/protected/partners/mine/stats` (proposed paths
  `/protected/venues/mine/stats` and `/protected/experiences/mine/stats`; the
  first task of each child fixes the final path and payload). Each is built as:
  schema in `@repo/schemas`, service method in `@repo/service-core`, route via
  `createProtectedRoute` (thin), tests, and the error contract of
  `apps/api/docs/error-contract.md`. Payload: listings by status, unread
  inquiries, traffic total only when the entitlement allows it (otherwise the
  field is absent, never `0`). Permission via `PermissionEnum`; a foreign
  resource answers 404.
- i18n: new keys under `account.*` (es/en/pt) for the new dashboards, nav items,
  tabs, Composer and empty/error copy. Names «Novedades de Hospeda» and «Newsletter por mail» (Q1) in es, en and pt.
- Nav config (`config/navigation.ts`): `comercio` group split into two items;
  new «Complementos» item; two dashboard items.

## 8. UX / UI behaviour

- Catalog v5 (<https://claude.ai/artifact/26HuDrHSqJJ7jtDwbnfFzq>) is the visual
  source of truth; this spec wins on behaviour.
- Mobile: 44px controls, 16px inputs, primary action full width below 30rem,
  Composer fixed with safe-area.
- Dark mode by tokens (D18 «modo oscuro en alcance»).
- Action color: blue for Guardar/Crear, orange only for upsell (D4 «color de
  acción», with the owner's adjustment accepting non-AA white on brand colors).

## 9. Acceptance criteria

- **AC-1.** Each of the 16 pages in §5.3 and the 2 new dashboards renders exactly
  one `h1` from `PageHeader`, uses `Section` for every surface, and imports none
  of the §6.3 legacy primitives (checked by a test that greps the page closure).
- **AC-2.** Every async region in scope is an `AsyncRegion`. Tests force a fetch
  failure on the dashboard stats, guest inbox, owner inbox, listing list and
  favorites and assert an `ErrorState` with retry, never an empty state or «0».
- **AC-3.** Host without plan, favorites without plan, history row without plan
  and a dashboard widget without entitlement each render `LockedState`; a test
  asserts no enabled control inside and no plan-name literal (fixture catalog).
- **AC-4.** The same conversation rendered with `viewer="guest"` and
  `viewer="owner"` aligns own messages right in both; sending appends the
  message optimistically and does not trigger navigation (e2e: no `load` event).
- **AC-5.** No page outside `preferencias` contains a `role="switch"` for an
  account setting; newsletter and history link to Preferences.
- **AC-6.** Favorites: the «Sin colección» filter paginates server-side (e2e
  from HOS-2420 kept green); «Crear colección» and «Mover» agree on the lock.
- **AC-7.** Properties and listing: no silent cap (e2e with > 50 seeded
  listings shows a next page); one primary action per card; listing makes one
  list request (network assertion).
- **AC-8.** Nav shows «Mis locales», «Mis experiencias» and «Complementos» per
  role; add-ons highlights its own item; the subscription tabs are `NavTabs`.
- **AC-9.** Add-on purchase has a working back step on every step, and no path
  ends in the HOS-2426 message.
- **AC-10.** Provider detail shows «Contactar» with the provider's contact data
  and a not-found copy without QR (regression tests from HOS-2472).
- **AC-11.** General and host dashboards share no widget (a test lists widget
  ids per page and asserts an empty intersection).
- **AC-12.** Every file touched is ≤ 500 lines; each migrated file has left
  `account-css-literals-exceptions.json` and `account-breakpoints-exceptions.json`
  and the ceilings dropped in the same PR; both guards green.
- **AC-13.** Every Section carries a `data-help` that matches HOS-2410's grammar.
- **AC-14.** Visual baselines (light + dark, desktop + mobile) exist for every
  page in scope and the structural nesting sweep passes on all of them.
- **AC-15.** Staging smoke signed for: subscription, add-ons, properties (cap
  notice), host dashboard (with and without plan) — billing checklist parts —
  and one pass per role over the rest (tourist, host, venue owner, experience
  owner, partner, provider).
- **AC-16.** The venue and experience dashboards read one aggregate endpoint each
  (network assertion: one stats request per dashboard, no per-listing traffic
  calls). Each endpoint has service and route tests (permission, foreign
  resource 404, entitlement absent leaves traffic out, never `0`), a schema in
  `@repo/schemas` and the error contract; none of it invents a stat the API does
  not compute.

## 10. Smoke plan

Accounts: seed users (`tourist-free`, `host-basico`, `host-provider`,
`venue-owner`, `experience-owner`, `host-venue`) plus one partner and one host
in trial created through the UI (as in the audit's second wave).

| Step | Account | Check |
|---|---|---|
| 1 | tourist-free | Dashboard stats load; kill API (devtools offline) → «—» + retry, never «0» |
| 2 | tourist-free | Favorites: tabs per type, lock coherent between «Crear» and «Mover», remove asks confirmation |
| 3 | tourist-free | Guest thread: own bubbles right, reply without reload, 16px field on a phone |
| 4 | host-basico (no plan) | Host dashboard shows LockedState with catalog plan names, no raw error |
| 5 | host in trial | Properties: one primary action, cap notice in info tone, pagination |
| 6 | host-provider | Owner inbox gated; logged-out deep link returns after login |
| 7 | venue-owner / experience-owner | «Mis locales» / «Mis experiencias» filter; list before «Rendimiento»; new dashboards render or lock per widget |
| 8 | partner | Partner page: status pill, next action, stats only when available |
| 9 | any | Preferences: every switch autosaves with chip; newsletter/history link back |
| 10 | host in trial | Subscription tabs; add-on stepper with back on every step (MP sandbox per billing checklist) |
| 11 | host | Provider detail «Contactar»; unknown slug copy |
| 12 | all | Light and dark, 390px and 1440px |

Sign-off: `/smoke HOS-N` per child or the `smoke-tanda` skill for the batch.

## 11. Risks

- **R-1.** Phase 2 not closed (visual regression and structural sweep missing on
  staging). Mitigation: A-2; do not open phase-3 PRs before HOS-2413 closes.
- **R-2.** Splitting the 992- and 880-line favorites files can regress the
  HOS-2420/2423/2445 fixes. Mitigation: keep their regression tests unchanged
  and green in the split PR.
- **R-3.** HOS-2179 (add-on store) touches `AddonPurchase` concurrently.
  Mitigation: land after it or rebase onto it; never in parallel.
- **R-4.** The new stats endpoints add API scope to a web phase and lengthen PR-6
  by about 2-3 days. Mitigation: they are the first task of HOS-2475/2476; the
  web widgets are built against the schema in `@repo/schemas`, per-widget
  `AsyncRegion`, `client:visible`.
- **R-5.** The directory detail API may not expose provider contact fields.
  Mitigation: the first task of HOS-2472 verifies it; if absent, the API change is added to
  HOS-2472 with `area-api` (still in this phase per D14 «prioridad alta»).
- **R-6.** `PropertyCard` has 11 consumers; replacing it only on `propiedades`
  leaves two looks until phase 4-5. Accepted; tracked in HOS-2508.
- **R-7.** Billing smoke can block the whole listings/billing PR. Mitigation:
  isolate it in its own PR (§12).

## 12. Decisions relied on

- **D1 · Marco compacto** (shell already on).
- **D4 · Color de acción** (blue action, orange upsell; owner adjustment: brand
  colors exact with white text, non-AA accepted).
- **D5 · Secciones planas, barra degradé**.
- **D8 · Dos modelos de guardado** (profile/partner: bar; preferences: chip).
- **D9 · Sin acceso único** (LockedState, plan from catalog).
- **D11 · Ajustes en Preferencias**.
- **D14 · Contacto del proveedor** (phase 3, high priority).
- **D15 · Complementos en nav y pestañas**.
- **D16 · Un componente React por pieza** / **D17 · Ubicación del kit**.
- **D18 · Modo oscuro en alcance**.
- **D19 · Tableros separados y por vertical**.
- **D20 · «Mis locales» y «Mis experiencias»**.
- **D22 · Prueba del turista, aparte** (only the hook).
- **Q1 · Names (HOS-2479), owner 2026-11-22.** Product-updates notes are
  «Novedades de Hospeda»; the mail subscription is «Newsletter por mail» (en/pt
  translated accordingly). Rejected: «Novedades»/«Boletín por mail» and leaving
  the names as they are.
- **Q2 · Dashboard data for venue and experience owners (HOS-2475, HOS-2476),
  owner 2026-11-22.** A new protected aggregated endpoint per vertical (service
  in `service-core` + route + tests), same shape idea as
  `/protected/partners/mine/stats`. Rejected: composing in the client (N calls)
  and a stats-less minimal dashboard.
- **D23 · Fallbacks inline fuera de la épica**.
- **OD-9 · Guards solo en cuenta, lista que solo baja**; **OD-10 · AsyncRegion
  con cinco estados** (HOS-2413).

Assumptions (decided here, revisit if wrong):
- **A-1.** Focus pages migrate in phase 5 (HOS-2501), not phase 3 as HOS-2413
  NG-5 says; Linear is the source of truth for scope.
- **A-2.** Phase 3 PRs open only after HOS-2413 closes.
- **A-3.** New dashboard routes `tablero-locales` / `tablero-experiencias`; the
  partner dashboard is the `partner` page.
- **A-4.** «Mis locales» / «Mis experiencias» share `/mi-cuenta/comercio/` with a
  `vertical` query param (D20 allows keeping the URL).

No open owner question blocks this spec (Q1 and Q2 were decided on
2026-11-22, see above).

## 13. Implementation plan

All PRs target `epic/HOS-2409-mi-cuenta-ui`, at most 2 open at once, titles
`[HOS-2414] <type>(web): …`, no Linear magic word.

| PR | Scope | Children | Smoke |
|---|---|---|---|
| PR-1 | StatCard/StatGrid, ListRow, Avatar + general and host dashboards | 2473, 2474 | billing (host no-plan lock) |
| PR-2 | Edit profile, preferences consolidation, provider detail | 2478, 2479, 2472 | staging |
| PR-3 | DataList, ConversationThread, Composer + both inboxes | 2481, 2482 | staging |
| PR-4 | EntityCard + favorites and collection split | 2480 | staging |
| PR-5 | Menu, ListingCard, KeyValueList, PlanSummary, Stepper + properties, listing lists + nav, subscription and add-ons | 2483, 2484, 2485 | billing |
| PR-6 | Venue and experience stats endpoints (service, route, tests) + venue, experience and partner dashboards | 2475, 2476, 2477 | staging |

Six PRs, one over the epic's «4-5 per phase» guideline: PR-5 bundles every
billing-smoke page so the smoke runs once, and PR-6 carries the two new API endpoints (Q2).

## 14. Linear

Canonical tracking: HOS-2414 (parent HOS-2409). The 14 children already exist in
Linear (created by the owner on 2026-11-20); this spec proposes no new issues.
Order follows dependencies (HOS-2413 closes first).

| Order | Issue | What | Decision | Labels | PR |
|---|---|---|---|---|---|
| 1 | HOS-2473 | General dashboard to the kit; builds StatCard, ListRow, Avatar | D19 | area-web | PR-1 |
| 2 | HOS-2474 | Host dashboard separated, no duplication (+ HOS-2214) | D19 | area-web, area-billing | PR-1 |
| 3 | HOS-2478 | Profile with StickySaveBar and a Security section | P1 row | area-web | PR-2 |
| 4 | HOS-2479 | Preferences holds every on/off; newsletter and history lose only the switch (the rest of those pages is HOS-2501); names per Q1 | D11 | area-web | PR-2 |
| 5 | HOS-2472 | Provider detail: Contactar button, no-QR not-found copy | D14 | area-web (+ area-api if contact is not exposed, R-5) | PR-2 |
| 6 | HOS-2481 | Guest inbox and thread | P0 rows | area-web | PR-3 |
| 7 | HOS-2482 | Owner inbox and thread (gate, login return) | P0 rows | area-web | PR-3 |
| 8 | HOS-2480 | Favorites and collections (split the 992-line island) | P0 rows | area-web | PR-4 |
| 9 | HOS-2483 | Properties list (ListingCard, Menu, Pagination) | P1 row | area-web, area-billing | PR-5 |
| 10 | HOS-2484 | Venue and experience lists, separate nav | D20 | area-web | PR-5 |
| 11 | HOS-2485 | Subscription and add-ons (tabs, Stepper, sidebar item); coordinate with HOS-2179 | D15 | area-web, area-billing | PR-5 |
| 12 | HOS-2475 | Venue-owner dashboard + new aggregate endpoint (Q2) | D19 | area-web, area-api | PR-6 |
| 13 | HOS-2476 | Experience-owner dashboard + new aggregate endpoint (Q2) | D19 | area-web, area-api | PR-6 |
| 14 | HOS-2477 | Partner dashboard on the `partner` page (`mineStats`) | D19 | area-web | PR-6 |

Per-child acceptance criteria live in each Linear issue and in §9. Rules common to
all PRs: target `epic/HOS-2409-mi-cuenta-ui`, at most 2 open, title
`[HOS-24xx] <type>(web): …`, no Linear magic word, `data-help` on every Section
(HOS-2410), and each migrated file leaves both guard exception lists in the same PR.
