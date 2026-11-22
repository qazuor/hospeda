# Phase 3 · Per-page migration inventory (HOS-2414)

Split out of `spec.md` §6.1 to keep each file under 500 lines.

Legend: **→** kit replacement; **✗** retired from this page (deleted globally
only when its last consumer goes, HOS-2508).

**General dashboard — `index` (HOS-2473)**
- Template `dashboard`. `PageHeader` with identity (Avatar + name + one
  «Editar perfil» action; the second link is removed).
- `AccountStatsGrid.astro` + DOM script → `StatGrid` of `StatCard`s, each in its
  own `AsyncRegion`; a failed stat shows «—» plus retry, never «0».
- `AccountSectionCards.astro` → `Section`s of `ListRow`s.
- Glow, dot pattern, avatar ring, hover-lift and ~80 lines of dead sidebar CSS
  → deleted.
- Per-user data stays in client islands (session-blind rule); page ≤ 500 lines.
- ✗ `AccountStatsGrid`, `AccountSectionCards` (last consumers), `AccountSectionCard`.

**Host dashboard — `host-dashboard` (HOS-2474)**
- `StatGrid` (properties, unread owner conversations), quick actions as
  `ListRow`s, onboarding `EmptyState` for a host with no listing.
- Shows only host-specific data; anything already on the general dashboard
  (profile, account plan summary) is removed (D19 «sin duplicación»).
- Host without plan → `LockedState` `reason.kind = 'plan'` with catalog names,
  never «Entitlement required» (closes the UI half of HOS-2214; the API half
  stays in HOS-2214 if it is a server bug).
- Unread link goes to `consultas-propietario` (HOS-2418 fixed the bug; this
  page keeps the link through `ListRow` and a test).
- ✗ `AccountPageHeader`, `HostDashboard.module.css` breakpoint exception.

**Venue-owner and experience-owner dashboards — new (HOS-2475, HOS-2476)**
- Routes: `mi-cuenta/tablero-locales/` and `mi-cuenta/tablero-experiencias/`
  (A-3), template `dashboard`, gated by `VENUE_EDIT_OWN` / `EXPERIENCE_EDIT_OWN`.
- Data comes from a NEW aggregate endpoint per vertical (Q2, decided 2026-11-22;
  see §6.2 and §7): listings by status, unread inquiries and, when the plan's
  entitlement (`view_basic_stats`) allows it, total traffic. One request per
  dashboard, no N+1. Without the entitlement the traffic widget renders
  `LockedState`. Each widget is its own `AsyncRegion`.
- Nav: one «Tablero» item inside each new nav item group, mirroring
  `hostDashboard`.

**Partner dashboard — `partner` (HOS-2477)**
- The partner page becomes the partner's dashboard: `PageHeader` with
  `StatusPill` of the listing status + a «próxima acción» `Alert`;
  `StatGrid` from `mineStats` (views; clicks only when the logo links out, per
  the API comment); `KeyValueList` of listing data; the edit form below in a
  `Section` with `StickySaveBar`.
- No promised stat that the API lacks (NG-6). Logo upload is HOS-2506 (phase 5);
  the URL field keeps working, restyled with `Field`.
- ✗ `PartnerEditForm.module.css` exceptions.

**Edit profile — `editar` (HOS-2478)**
- Template `form`. Five flat `Section`s (identity, contact, about, social,
  security) using the field kit; `AvatarUpload` restyled inside the identity
  Section (logic kept).
- `StickySaveBar` + `useSaveBar` registered through
  `use-unsaved-changes-guard.ts`; field errors via `focus-first-invalid-field`
  and per-field `error` (HOS-2444 behaviour pinned by test).
- Security Section with a link to `cambiar-contrasena` (HOS-2431).
- ✗ `ProfileEditForm.module.css` hover-lift cards and breakpoint exception.

**Preferences — `preferencias` (HOS-2479)**
- Sections of `SwitchRow`s with `AutoSaveChip` (D8 «dos modelos de guardado»:
  direct action). `PreferenceToggles` own switch and ~100 lines of `:global` →
  kit `Switch`.
- Absorbs the newsletter on/off and the search-history opt-out (D11). Plan-locked
  rows (history in Gratis) render `SwitchRow locked` + LockedState link.
- `newsletter` and `historial-busquedas` lose their switch and show a
  `StatusPill` + `TextLink` «Cambiar en Preferencias»; the rest of those pages
  waits for HOS-2501.
- Names (Q1, decided 2026-11-22): product-updates notes are «Novedades de
  Hospeda»; the mail subscription is «Newsletter por mail» (en and pt translated
  accordingly). They apply to the sidebar item and the page titles.
- ✗ own `role="switch"` in `PreferenceToggles`, `SearchHistoryList`,
  `NewsletterContentTypeToggles`.

**Favorites + collection — `favoritos`, `favoritos/colecciones/[id]` (HOS-2480)**
- `PageHeader` with actions («Crear colección»), `Tabs` per entity type
  (accommodation, venue, experience, attraction, per HOS-2423), `EntityCard`
  grid, `Pagination`, `Skeleton`, one `LockedState` for the plan (the second
  upsell goes).
- «Crear colección» and the «Mover» dialog read the SAME gate: when creation is
  locked, «Mover» does not offer «+ Crear nueva colección» and explains why.
- Removal through `useConfirm` (HOS-2429), note autosave on blur with
  `AutoSaveChip` (HOS-2445).
- Split `UserFavoritesList.client.tsx` (992) and the collection page (880) into
  files ≤ 500 lines: list state hook, filters, grid, collections Section.
- Modals (`MoveToCollectionModal`, `CreateEditCollectionModal`) → kit `Dialog`
  skin.
- ✗ `CreateCollectionCTA` upsell variant, shared `Breadcrumbs` here
  (PageHeader `back`).

**Guest inbox + thread — `consultas`, `consultas/[conversationId]` (HOS-2481)**
- List: `DataList` of `ListRow`s (counterpart, listing, last message, `CountPill`
  unread), `Pagination`, `AsyncRegion` (error with retry, never empty on failure).
- Thread: `ConversationThread viewer="guest"` + `MessageBubble` + `Composer`
  (fixed, 16px textarea, optimistic send, retry on failure, no page reload).
- Missing conversation → `ErrorState`/`EmptyState` inside the shell, never a
  blank 404 (HOS-2434).
- ✗ `ConversationReply.client` (replaced by `Composer`), `AccountSectionCard`,
  `AccountEmptyState`, `<style>` blocks.

**Owner inbox + thread — `consultas-propietario`, `[conversationId]` (HOS-2482)**
- Same components as the guest inbox (`viewer="owner"`); a test renders the
  same conversation from both viewers and asserts mirrored alignment.
- Permission gate in the page (owner permissions via `PermissionEnum`) with
  `buildLoginRedirect` return URL (HOS-2433); lacking permission →
  `LockedState reason.kind='permission'`.
- Translated `aria-label`s; back is a labelled `PageHeader back`.

**Properties — `propiedades` (HOS-2483)**
- `ListingCard` (shared with commerce): one primary action visible, the other
  four in a `Menu`; status as `StatusPill`.
- One `Alert` per state (preparing host, trial, cap reached in `info` tone, not
  error: HOS-2425/2443).
- `Pagination` without the silent cap of 50 (HOS-2440).
- Emoji icons → `@repo/icons`.
- ✗ `PropertyCard.astro` here (it has 11 consumers; the others go in phases 4-5),
  `AccountPagination.astro`, shared `EmptyState.astro`, `AccountButton.module.css`.

**Commerce lists — `comercio` (HOS-2484)**
- Two nav items «Mis locales» and «Mis experiencias» (D20) pointing at
  `mi-cuenta/comercio/?vertical=venue|experience` (A-4); each filters its
  vertical; the group header follows `suppressHeaderWhenSingle`.
- List first with `ListingCard`; «Rendimiento» (`ListingViewsWidget`,
  `VenueMenuQrWidget`, `VenueListingStatsPanel`) moves below as Sections.
- Draft checklist items link to the editor section that resolves them.
- One request for the list, not one per unpublished listing (N+1 removed; the
  per-listing data comes from the list payload or one batched call).
- ✗ `AccountSectionCard`, `AccountEmptyState`, `ListingActions` own buttons.

**Subscription + add-ons — `suscripcion`, `complementos` (HOS-2485)**
- `PageHeader` with `NavTabs` «Plan / Complementos» (URLs stay
  `suscripcion` and `complementos`).
- Plan: `PlanSummary` (name, price, renewal, `StatusPill`) + `KeyValueList`;
  empty → `EmptyState` with «Ver planes»; trial copy de-duplicated.
- Add-ons: `Stepper` (choose → target → confirm) with a back step (HOS-2441),
  `OptionCard`s from the catalog; the dead end of HOS-2426 renders an explained
  `LockedState`/`EmptyState`, never «No hay suscripciones disponibles».
- Sidebar item «Complementos» under «Cuenta» (D15); `activeSection` fixed.
- The dashboard and this page read the plan from the same source (AC).
- Coordinate with HOS-2179 (add-on store, in flight) before touching
  `AddonPurchase` (R-3).

**Provider detail — `directorio-proveedores/[slug]` (HOS-2472)**
- `PageHeader back`, `KeyValueList` of provider data, `Button` «Contactar» with
  the provider's contact channels (only fields the API already returns; if none
  is exposed, see R-5); the review list is kept as is.
- Not-found state with its own copy, no QR mention.
- `TradeCategoryBadges` → `StatusPill`/Badge.

