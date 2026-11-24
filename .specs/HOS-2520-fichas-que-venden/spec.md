---
title: Listing detail pages that sell — sticky contact bar, swipeable gallery and mobile-first order
linear: HOS-2520
statusSource: linear
created: 2026-11-20
type: feature
areas:
  - web
related:
  - HOS-19    # WhatsApp gated by the viewer's plan (upsell)
  - HOS-1076  # venue has no WhatsApp channel
  - HOS-363   # experience has no WhatsApp channel
  - HOS-2258  # venue videos (merged, touched alojamientos/[slug].astro)
  - HOS-2119  # analytics migration (events go through @repo/analytics)
smokeGates:
  # Visual behaviour on a real phone (sticky bar over the browser chrome, safe-area
  # inset, swipe, bottom sheet) is not observable in jsdom nor fully in Playwright.
  - status-needs-smoke-staging
design: https://claude.ai/artifact/B2Bn5iZrspDzS25E7pJYzr
---

# Listing detail pages that sell

## 1. Summary

Redesign the public listing detail pages so that, on mobile, the visitor sees the
price and a way to contact the host on the first screen and keeps that call to
action in view for the whole scroll. Accommodation is the main target. Experience,
venue (Comer y salir) and partner get the parts that apply to their channels.

The owner approved the design in the canvas linked in the frontmatter (`design`).
It has four boards: **Fase 1 · Mobile**, **Fase 1 · Panel «Consultar» abierto**,
**Fase 2 · Mobile** and **Desktop · Fase 1 + Fase 2 aplicadas**. When this spec and
the canvas disagree on a visual detail, the canvas wins. When they disagree on
behaviour, data or scope, this spec wins.

The work ships in two phases. Phase 1 is conversion and is shippable alone. Phase 2
is polish and depends on Phase 1's new primitives (the `sheet` dialog variant and
the contact panel).

## 2. Problem

Measured on staging, accommodation `sendero-tranquilo` (Gualeguaychú), at a 390px
viewport:

| Measure | Value |
|---|---|
| Page height | 10,938px |
| Listing price first visible at | 7,870px |
| Inquiry form first visible at | 8,423px |
| Sticky call to action | none |

Root cause:

- `apps/web/src/layouts/DetailLayout.astro:167-183` collapses to one column at
  `max-width: 1024px` and gives the sidebar (`PricingSidebar`, `OwnerCard` with
  `ContactHost` and `WhatsAppContact`, `ReviewSidebarCard`) `order: 2`.
- The four `RelatedCarousels` live INSIDE the default slot (`<article>`), at
  `apps/web/src/pages/[lang]/alojamientos/[slug].astro:636-670`. The comment at
  L634 says they are "outside two-column grid"; they are not.
- So on mobile the visitor scrolls through the whole description, amenities, FAQ,
  map and **four carousels of other listings** before seeing this listing's price.

Secondary problems on mobile:

- `ImageGallery.client.tsx` has no swipe and no mobile CSS. On ≤640px it shows one
  featured photo plus a strip of 100px thumbnails.
- The title block repeats breadcrumbs and a back row that cost ~150px.
- Phone and email are plain text on the partner page
  (`apps/web/src/pages/[lang]/partners/[slug].astro:173-175`).
- No analytics event exists for a call, email or WhatsApp click, so the effect of
  any redesign cannot be measured.

## 3. Goals

- **G-1** On mobile (≤767px), the price (or «Consultar precio») and a contact action
  are visible on the first screen of every accommodation detail page, and stay
  visible for the whole scroll.
- **G-2** On mobile, the listing's own price block and host block render before any
  related-listing carousel.
- **G-3** The gallery can be browsed with a swipe on touch devices, full-bleed, with
  back/share/favorite on top of it.
- **G-4** Every contact action (WhatsApp, phone, email, form open, form sent) emits an
  analytics event carrying the channel and the origin.
- **G-5** Phase 2: section tabs, summarized amenities, truncated description, a
  more prominent host and reviews, and the same bar/panel on experience and venue
  with the channels each one really has.
- **G-6** Zero regression in session-blindness, CLS, the existing lightbox, the
  dock's other consumers (CompareBar, AiChatWidget) and the desktop layout outside
  the explicit desktop changes.

## 4. Non-goals

- **NG-1** Real `check_in`/`check_out`/`guests` columns in `conversations`. Owner
  decision: in this spec the dates and guests travel as text inside the message.
  The columns are a separate follow-up issue (see §13).
- **NG-2** An inquiry (conversation) flow for experience or venue. Conversations are
  accommodation-only (`CreateConversationAnonSchema.accommodationId`, FK to
  `accommodations.id`). Experience and venue get a channels-only panel.
- **NG-3** WhatsApp for venue (HOS-1076) or experience (HOS-363).
- **NG-4** New review data, response-time data or any number that does not exist
  today. A listing without reviews shows the existing empty state.
- **NG-5** The `/alojamientos/<slug>/fotos/` page (glightbox), the admin, the API.
- **NG-6** Changing what the WhatsApp entitlement grants (HOS-19 stays as is).

## 5. Current baseline

### 5.1 Layout and page

- `DetailLayout.astro`: slots `head-extra`, `breadcrumbs`, `page-header` (into
  `WaveHeader`'s `content`), default (inside `<article class="detail-page__main">`)
  and `sidebar` (inside `<aside class="detail-page__sidebar">`). Desktop grid
  `1fr 360px` (L133-138). The sidebar is already sticky on desktop (L159-165).
- Pages using it with a sidebar: `alojamientos/[slug]`, `eventos/[slug]`,
  `publicaciones/[slug]`, `destinos/[...path]`, `destinos/lugar/[slug]/index`.
  Without (`showSidebar={false}`): `comer-y-salir/[slug]` (+ `/carta`),
  `experiencias/[slug]`, `alojamientos/[slug]/fotos`, `alojamientos/comparar`.
- `alojamientos/[slug].astro` main order: `ImageGallery` (L564) → `QuickFacts` →
  description → `VideoSection` → `AccommodationContactBlock` → `FeaturesGrid` →
  `AmenitiesGrid` → `PromotionBanner` → `ReviewPreview` → `ExternalReputation` →
  `FaqAccordion` → `LocationSection` → `WhatsNearbySection` → RelatedCarousels
  (L636-670) → headless items (`AccommodationViewTracker`, `AiChatWidget` L686,
  `CompareBar` L702). Sidebar fragment L705-770.
- `DetailHeader.astro`: back row (`wh-compact-hide`), badges, h1, destination link,
  rating + bookmark count; `DetailCompareButton` and `FavoriteButton` at
  `.detail-header__favorite` (~L143-160).
- `WaveHeader.astro`: sticky band at `top: var(--navbar-height)`, states
  expanded → compact → hidden (detail pages), state machine `waveHeaderState.ts`.

### 5.2 Mobile dock

- `MOBILE_DOCK_SLOTS = ['above','filters','start','map-cards','ai-search','ai-chat']`
  (`apps/web/src/lib/mobile-dock/mobile-dock-slots.ts:6-13`), materialized in
  `components/shared/dock/MobileDock.astro` (`above` L21, row L24-30).
- `DockPortal.tsx:45-53` portals an island's button into the slot after hydration.
- Breakpoint `max-width: 767px` (`mobile-dock-measure.ts:2`, `MobileDock.astro:50`).
- `--mobile-dock-height` is measured from visible `[data-dock-item]` elements.
- The dock uses `backdrop-filter`, so **a fixed-position sheet must NOT render inside
  the portal** (`DockPortal.tsx:38-43`).
- Auto-hide: `mobile-dock-autohide.ts` hides on scroll down (min 120px, delta 8px);
  it pins only for focus-within and a pinned compare selection.

### 5.3 Contact stack

- `ContactHost.client.tsx`: props `accommodation`, `locale`, optional
  `initialMessage`. Anonymous fields name/email/phone?/message; authenticated
  message only; existing conversation → "view thread" link. Endpoints
  `POST /api/v1/public/conversations/initiate` and
  `POST /api/v1/protected/conversations/initiate`. Rate limits 10/10min per IP and
  5/h per email. Emits `contact_owner_started|completed|failed` with hard-coded
  `source_page: 'accommodation_detail'`, `contact_method: 'platform_message'`.
- `WhatsAppContact.client.tsx`: the SSR/cache payload only carries `hasWhatsapp`.
  The island resolves the session with `useAccountPermissions()`; anonymous →
  upsell with no network call; signed-in → `GET /api/v1/protected/accommodations/:id/whatsapp`
  → `{ number, direct, entitled }`. Not entitled or any error → upsell linking to
  the plans page.
- `AccommodationContactBlock.astro`: public `contactInfo.phone|email|website` as
  `tel:`/`mailto:` links (L68-93).
- Experience: `ExperienceContactBlock.astro` (`workPhone`, `mobilePhone`,
  `workEmail`, `website`), `hasPublicContactChannel()` and
  `EXPERIENCE_CONTACT_ANCHOR_ID` in `lib/experience-contact.ts`. Price: `priceFrom`
  (centavos), `priceUnit` (`per_day|per_hour|per_person|per_group|null`),
  `isPriceOnRequest`.
- Venue: `VenueContactBlock.astro` (menu link + social networks, `id="venue-contact"`).
  No phone, no email, no numeric price (only `priceRange`).
- Analytics: `@repo/analytics` catalog (`packages/analytics/src/catalog.ts`), web
  facade `apps/web/src/lib/analytics/events.ts`, client `trackEvent` from
  `@/lib/analytics/posthog-client`. No event exists for tel/mailto/wa.me clicks.

### 5.4 Reusable primitives

- `shared/ui/Dialog.client.tsx`: sizes `sm|md|lg|full`, variants `solid|transparent`,
  focus trap, `useDialogHistoryBack`. **No bottom-sheet variant.**
- Bottom-sheet precedents: `SearchBar.module.css` (hero search),
  `MapCardsSidebar.client.tsx`; shared `lib/focus-trap.ts`.
- `ShareButtons.client.tsx`: Web Share API + popover fallback. Used on events and
  posts only (`share-buttons-in-detail-pages.test.ts`).
- Buttons: `GradientButton.astro` / `GradientButtonReact`, `.btn-gradient`
  (`src/styles/components.css:169`), `IconButton.astro`.
- Breakpoints are hard-coded per file; the de-facto set is 480/640/768/1024. This
  spec uses **767px** for "mobile" (the dock's breakpoint) and **1024px** for the
  one-column layout. Nothing new is introduced.

## 6. Proposed design — Phase 1 (conversion)

All Phase 1 items apply at `max-width: 767px` unless stated otherwise.

### 6.1 New dock slot `contact` and `ListingContactBar`

1. Add `'contact'` to `MOBILE_DOCK_SLOTS` and a matching
   `<div data-mobile-dock-slot="contact">` in `MobileDock.astro`. Position: **inside
   `.mobile-dock__row`, first**, so the row reads `[contact … ][ai-chat]`. `above`
   (CompareBar) stays above the row. Update the single-row and CSS contract tests.
2. New island `apps/web/src/components/listing/contact/ListingContactBar.client.tsx`
   (+ `.module.css`). It renders inside `<DockPortal slot="contact">`; its root has
   `data-dock-item` and `position: static` on mobile. Hidden at ≥768px
   (`display: none`), because desktop has the sticky sidebar.
3. Props (RO-RO, Zod-validated at the boundary, `import type` for types):

   ```ts
   export interface ListingContactBarProps {
       readonly vertical: 'accommodation' | 'experience' | 'venue';
       readonly listingId: string;
       readonly locale: SupportedLocale;
       readonly price: {
           readonly amount: number | null;     // major units for accommodation, centavos→major for experience
           readonly currency: string | null;
           readonly unitLabelKey: string | null; // i18n key, e.g. accommodations.detail.pricing.perNightLabel
           readonly onRequest: boolean;
       } | null;                                // null → venue (no price block)
       readonly hasWhatsapp: boolean;           // accommodation only; false elsewhere
       readonly primaryLabelKey: string;        // 'Consultar' | 'Contactar' | 'Ver carta'
       readonly panelId: string;                // id of the ListingContactPanel it opens
   }
   ```

4. Layout (canvas, Fase 1 board, bottom bar): left, the price («$155.500» bold +
   «/noche» muted) or «Consultar precio» when `price.onRequest` or `amount` is null;
   right, a round green WhatsApp button (only when `hasWhatsapp`) and a primary
   button «Consultar». Height 64px + `env(safe-area-inset-bottom)`.
5. WhatsApp button behaviour (owner decision): **always rendered when
   `hasWhatsapp`**. On tap it opens the panel scrolled to the WhatsApp row, where
   `WhatsAppContact` resolves the entitlement exactly as today (direct `wa.me` link,
   plain number, or upsell). The bar never changes shape after hydration and never
   fetches the number itself.
6. Auto-hide (owner decision): **the bar never auto-hides on detail pages.** Extend
   `mobile-dock-autohide.ts` with a pin rule: when the dock contains a visible
   `[data-mobile-dock-slot="contact"] [data-dock-item]`, `data-dock-hidden` is never
   set. The existing hide-on-menu/search/filters rules (`MobileDock.astro:133-137`)
   still apply.

### 6.2 `Dialog` variant `sheet` and `ListingContactPanel`

1. Add `variant: 'sheet'` to `shared/ui/Dialog.client.tsx` + `Dialog.module.css`.
   At ≤767px it renders as a bottom sheet: full width, anchored to the bottom,
   `max-height: 90dvh`, top radius `var(--radius-card)`, a drag handle (decorative,
   `aria-hidden`), slide-up animation disabled under `prefers-reduced-motion`. At
   ≥768px it renders as the existing centered `md` dialog. Focus trap, Escape,
   backdrop click and `useDialogHistoryBack` behave as in the other variants.
2. New island `apps/web/src/components/listing/contact/ListingContactPanel.client.tsx`.
   It is mounted **once per page, outside the dock portal** (sibling of the other
   headless items at the end of the default slot). The bar and any other trigger
   open it through a tiny event bus:
   `apps/web/src/lib/listing-contact/listing-contact-events.ts` exporting
   `openListingContactPanel({ origin, focus })` and
   `onListingContactPanelOpen(handler)` (a `CustomEvent` named
   `hospeda:listing-contact:open` on `window`; payload validated with Zod).
   `focus` is `'whatsapp' | 'form' | undefined`.
3. Panel contents for **accommodation** (canvas, «Panel Consultar» board), top to
   bottom:
   - Title «Consultá a <owner first name>» and the price line.
   - Shortcut row: WhatsApp (`WhatsAppContact`, gated), «Llamar» (`tel:` from public
     `contactInfo.phone`), «Email» (`mailto:` from public `contactInfo.email`). A
     shortcut whose data is absent is not rendered. If none exists, the row is not
     rendered.
   - Optional fields **Llegada**, **Salida** (native `<input type="date">`) and
     **Huéspedes** (native `<input type="number" min=1 max=<capacity>>`).
   - `ContactHost` (reused, unchanged API) with `initialMessage` built by
     `buildInquiryMessage()` (§6.2.4) and re-built whenever a field changes, **only
     while the visitor has not edited the message by hand**.
   - Trust line «Tu consulta va directo al anfitrión. Sin comisiones.» (i18n).
4. `apps/web/src/lib/listing-contact/build-inquiry-message.ts`, a pure function:

   ```ts
   export function buildInquiryMessage(input: {
       readonly locale: SupportedLocale;
       readonly checkIn?: string;   // YYYY-MM-DD
       readonly checkOut?: string;  // YYYY-MM-DD
       readonly guests?: number;
   }): { readonly message: string }
   ```

   Rules: no field → the default greeting already used by `ContactHost`; only dates
   → «Hola, ¿está disponible del 9/1 al 11/1?»; only guests → «Hola, ¿está
   disponible para 4 personas?»; both → combined. Dates formatted with the
   locale's short day/month. `checkOut` ≤ `checkIn` → field error «La salida tiene
   que ser después de la llegada» and the message is not rebuilt. Guests outside
   `1..capacity` → field error. All strings via `@repo/i18n` (es/en/pt).
5. `ContactHost` gets two **optional** props, backwards compatible:
   `sourcePage?: string` (default `'accommodation_detail'`) and
   `origin?: ContactOrigin` (§6.6). Nothing else in its API changes. The panel
   instance and the sidebar instance share the existing
   `accommodation-conversation-store`, so the conversation lookup is done once.

### 6.3 Mobile order: price and host before the related listings

1. Add a new slot `after-content` to `DetailLayout.astro`, rendered **after the
   grid** (outside `.detail-page__grid`), full width inside the container.
2. Move the four `RelatedCarousels` from the default slot to
   `<Fragment slot="after-content">` in `alojamientos/[slug].astro`. Fix the comment
   at L634. Desktop result: the carousels move from the left column to full width
   under both columns (canvas Desktop board shows them full width in 4 columns).
3. New compact block `apps/web/src/components/accommodation/MobileBookingSummary.astro`
   rendered in the default slot **right after `QuickFacts`**, visible only at
   ≤1024px (`display: none` above). Content: price per night (or «Consultar
   precio»), min/max nights, the owner mini-card (avatar, name, «Anfitrión desde
   <month year>») and two buttons: «Consultar» (calls
   `openListingContactPanel({ origin: 'summary', focus: 'form' })` through a small
   island `MobileBookingSummaryActions.client.tsx`) and WhatsApp (only when
   `hasWhatsapp`, opens the panel with `focus: 'whatsapp'`). It is server-rendered,
   session-blind, and reads only public fields already in the page payload.
4. At ≤1024px the existing sidebar keeps rendering (after main), so the full
   `ContactHost` form and `ReviewSidebarCard` stay reachable for non-JS and for the
   `#contact` anchor. `PricingSidebar` is hidden at ≤1024px because
   `MobileBookingSummary` replaces it there (avoid showing the price block twice).
5. Rejected alternative: `display: contents` on `<article>` plus `order`. It breaks
   the `<article>` landmark's box, interacts badly with the sticky desktop sidebar,
   and makes the order depend on CSS across 13 children.

### 6.4 Full-bleed swipeable gallery

1. `ImageGallery.client.tsx` gets a mobile presentation for `variant="detail"`,
   active at ≤767px via CSS (both presentations are in the DOM, so there is no
   hydration mismatch and no CLS). Desktop keeps the mosaic unchanged.
2. Mobile presentation: a horizontal `scroll-snap-type: x mandatory` track,
   full-bleed (negative margin equal to `--space-container-x`), aspect ratio 4:3
   locked, `loading="lazy"` for every slide after the first, `srcset` exactly as
   the mosaic. Overlays: back (top-left, `history.back()` with fallback to the
   listing index), share and favorite (top-right), counter «1/8» (bottom-right) and
   dots (bottom-center, max 8 visible). The current index is derived from
   `scrollLeft` (IntersectionObserver on slides, threshold 0.6). Tapping a slide
   opens the existing lightbox at that index. Keyboard: the track is focusable and
   arrow keys move one slide.
3. Share uses `ShareButtons.client.tsx` in its compact icon mode (add an
   `appearance: 'icon-overlay'` prop if the existing API has no such mode).
   Favorite reuses `FavoriteButton` with the same props as in `DetailHeader`.
4. The lightbox gets touch swipe (pointer events, horizontal threshold 40px,
   vertical movement > horizontal cancels) because users who open it on mobile
   expect it.

### 6.5 Compact title block

At ≤767px in `DetailHeader.astro` + `WaveHeader` usage on the accommodation page:

- Visual breadcrumbs hidden (`display: none` on the breadcrumbs slot wrapper at
  ≤767px). The `BreadcrumbList` JSON-LD in `head-extra` is untouched.
- Back row hidden (the gallery overlay has the back button).
- Badges at 12px, one line, horizontally scrollable if they overflow.
- `FavoriteButton` hidden in the header on mobile (it is on the gallery).
  `DetailCompareButton` stays next to the title as a 32px icon button (owner
  decision).
- `QuickFacts` on one line: «7 huéspedes · 3 hab · 5 camas · 2 baños».
- The compact/hidden scroll states of `WaveHeader` keep working; the
  `wave-header-anim-sync` guard must stay green.

### 6.6 Contact analytics

1. Add to `packages/analytics/src/catalog.ts` one event
   `listingContactClicked: 'listing_contact_clicked'` with schema:

   ```ts
   z.object({
       listing_id: idSchema,
       vertical: z.enum(['accommodation', 'experience', 'venue', 'partner']),
       channel: z.enum(['whatsapp', 'phone', 'email', 'website', 'menu', 'social', 'form_open']),
       origin: z.enum(['bar', 'panel', 'summary', 'sidebar', 'contact_block', 'gallery']),
       is_whatsapp_entitled: z.boolean().optional(),
       locale: localeSchema
   })
   ```

   and the web alias `ListingContactClicked` in `apps/web/src/lib/analytics/events.ts`.
2. Emitted from: the bar (WhatsApp, Consultar → `form_open`), the panel shortcuts,
   `MobileBookingSummaryActions`, `WhatsAppContact` (direct link click),
   `AccommodationContactBlock`, `ExperienceContactBlock`, `VenueContactBlock`,
   the partner page. Server-rendered `.astro` blocks emit through one tiny shared
   script `apps/web/src/lib/listing-contact/track-contact-links.ts` that listens for
   clicks on `[data-contact-channel]` anchors (event delegation, one listener per
   page) so the blocks stay zero-JS-per-link.
3. `ContactHost`'s existing `contact_owner_*` events keep their names; they now
   pass `source_page` from the new prop.

### 6.7 Partner page tappable contact

`partners/[slug].astro` L173-175: phone → `<a href="tel:<digits>">`, email →
`<a href="mailto:<email>">`, both with `data-contact-channel` for §6.6. Phone digits
normalized with an existing util if one exists in `@repo/utils`, else a local pure
helper with tests.

## 7. Proposed design — Phase 2 (polish)

### 7.1 Section tabs (mobile and desktop)

New island `ListingSectionTabs.client.tsx`: sticky under the WaveHeader band
(`top: calc(var(--navbar-height) + var(--wave-bar-compact))`), anchors
«Fotos · Detalles · Comodidades · Ubicación · Reseñas · Anfitrión». A tab whose
section is absent is not rendered. Active tab from IntersectionObserver. On
desktop, once the gallery has scrolled out, the right side of the tab bar shows
the price and a «Consultar» button that opens the panel (canvas Desktop board).

### 7.2 Summarized amenities and features

`AmenitiesGrid.astro`: show 6 items on mobile / 8 on desktop as pills with icon;
«Ver las N comodidades» opens a `sheet` dialog listing all, grouped as today. The
inline expand (`:nth-child(n+9)` + inline script) is removed. `FeaturesGrid` gets
the same treatment when it has more than 6 items.

### 7.3 Truncated description

The description (rich and `Description.astro`) is clamped to 4 lines on mobile /
8 on desktop with a «Leer más» toggle (`<button aria-expanded>`). The full text is
always in the DOM (SEO). No clamp when the text fits.

### 7.4 Host section

New `HostSection.astro` in the main column (before the location): avatar, name,
«Anfitrión desde», languages if present, and a «Consultar» button that opens the
panel. Only existing fields; no response time, no superhost-like badges.

### 7.5 Reviews

`ReviewPreview`: when the listing has reviews, show the average and a horizontal
scroll-snap track of up to 6 review cards, then «Ver las N reseñas» opening the
existing `ReviewsModal`. When it has none, keep today's empty state. No sample or
placeholder reviews ever.

### 7.6 Visual consistency

- Ad-hoc CTA links in the detail page components migrate to `GradientButton` /
  `IconButton`.
- The hero wave (`WaveHeader` path) is reused as a divider above `after-content`.
- Cards use `--radius-card`, `--shadow-card`; the map uses `--radius-organic`.

### 7.7 Desktop

- The sticky sidebar card gains the Llegada/Salida/Huéspedes fields (same
  `buildInquiryMessage`) and an «o contactá directo» row (WhatsApp/Llamar).
- Gallery mosaic gets a «Ver las N fotos» button (opens the lightbox).
- The `ListingContactBar` stays hidden on desktop.

### 7.8 Experience and venue (channels only, owner decision)

- **Experience** (`experiencias/[slug].astro`): `ListingContactBar` with the price
  from `priceFrom`/`priceUnit` («Consultar precio» when `isPriceOnRequest`), button
  «Contactar». Its panel shows Llamar (`mobilePhone` then `workPhone`), Email
  (`workEmail`) and Web (`website`). No form. When `hasPublicContactChannel()` is
  false, the bar is not rendered.
- **Venue** (`comer-y-salir/[slug].astro`): `ListingContactBar` without price,
  primary button «Ver carta» linking to `menuUrl` when present, else «Contactar»
  opening a panel with the social links. When the venue has neither menu nor
  social links, the bar is not rendered.
- Both get the swipeable gallery and the compact title block. Their pages use
  `showSidebar={false}`, so §6.3 does not apply.

## 8. Data model / contracts

- No DB change. No API change. No migration.
- New analytics event `listing_contact_clicked` (§6.6) in `@repo/analytics`.
- New `Dialog` variant `sheet`.
- New dock slot `contact`.
- New `DetailLayout` slot `after-content`.
- New window event `hospeda:listing-contact:open`, payload
  `{ origin: ContactOrigin; focus?: 'whatsapp' | 'form' }`.
- `ContactHost` new optional props `sourcePage`, `origin`.

## 9. Constraints

- **Session-blind pages.** Every `.astro` touched stays free of `Astro.locals.user`,
  protected endpoints and forwarded cookies
  (`apps/web/test/pages/cacheable-pages-are-session-blind.guard.test.ts`). The only
  server-side WhatsApp signal is `hasWhatsapp`. Anything per-viewer lives in islands.
- Web styling is CSS Modules / vanilla CSS only. No Tailwind.
- All new user-facing text goes through `@repo/i18n` in es, en and pt.
- Icons come from `@repo/icons`. WhatsApp's glyph is not in the sprite today: add
  `WhatsappLogo` to `@repo/icons` following that package's process.
- No `console.log`; `@repo/logger` where logging is needed.
- Hydration: `ListingContactBar` and `ListingContactPanel` use `client:idle`; the
  gallery keeps `client:load`. No new island on the page uses `client:load`.
- Max 500 lines per file; `ImageGallery.client.tsx` is already 962 lines, so the
  mobile track goes in a new sibling `ImageGalleryMobileTrack.client.tsx` and the
  lightbox swipe in a hook `useSwipe.ts`.

## 10. Acceptance criteria

Each AC is a test (unit/vitest unless marked E2E).

### Phase 1

- **AC-1.1** Given an accommodation with price at 390px, when the page loads, then
  `ListingContactBar` is visible in the dock with the formatted price, «/noche»,
  the WhatsApp button (if `hasWhatsapp`) and «Consultar». (unit + E2E)
- **AC-1.2** Given an accommodation without price, then the bar shows «Consultar
  precio» and no amount.
- **AC-1.3** Given `hasWhatsapp=false`, then the bar has no WhatsApp button.
- **AC-1.4** Given an anonymous visitor taps WhatsApp in the bar, then the panel
  opens focused on the WhatsApp row and that row shows the upsell; no request to
  `/protected/accommodations/:id/whatsapp` is made.
- **AC-1.5** Given the visitor scrolls down 2,000px, then the dock has no
  `data-dock-hidden` while the contact slot is occupied.
- **AC-1.6** At ≥768px the bar is not displayed and `--mobile-dock-height` does not
  count it.
- **AC-1.7** CompareBar (`above`) and AiChatWidget (`ai-chat`) still render in the
  dock alongside the bar; the row stays single-line (contract tests green).
- **AC-1.8** Given «Consultar» is tapped, then a `sheet` dialog opens with focus on
  its first focusable element; Escape, backdrop and browser back close it and
  return focus to the trigger. (unit + E2E)
- **AC-1.9** `buildInquiryMessage` covers: no fields, only dates, only guests, both,
  in es/en/pt; checkout ≤ checkin and guests out of range produce field errors.
- **AC-1.10** Given the visitor edits the message by hand, when they change the
  dates afterwards, then the message is not overwritten.
- **AC-1.11** Given the anonymous form is submitted from the panel, then the request
  body matches `CreateConversationAnonSchema` and the message contains the dates
  text. (unit + E2E against the local API)
- **AC-1.12** Shortcuts: phone present → `tel:` link; email present → `mailto:`;
  absent data → that shortcut is not rendered.
- **AC-1.13** At 390px, `MobileBookingSummary` is positioned above the first
  RelatedCarousel in the document (`compareDocumentPosition`) and its top is
  above 1,400px. (E2E)
- **AC-1.14** At ≤1024px `PricingSidebar` is hidden and `MobileBookingSummary`
  visible; above 1024px the inverse.
- **AC-1.15** RelatedCarousels render inside `after-content`, outside
  `.detail-page__grid`. Updated source-order tests
  (`alojamientos-slug-compare-bar.test.ts`, `alojamientos-slug-whats-nearby.test.ts`)
  stay green.
- **AC-1.16** Gallery at 390px: swipe moves one slide; counter goes «1/8» → «2/8»;
  tapping opens the lightbox at that index; arrow keys move when focused. (unit +
  E2E)
- **AC-1.17** Gallery: the first slide is eager, the rest lazy; `srcset` identical
  to the mosaic; existing `ImageGallery.cls` test green (no CLS regression).
- **AC-1.18** Lightbox swipe: horizontal drag > 40px changes image; a vertical drag
  does not.
- **AC-1.19** At 390px the visual breadcrumbs and back row are not displayed; the
  `BreadcrumbList` JSON-LD is still present; `DetailCompareButton` is next to the
  h1.
- **AC-1.20** Partner page: phone and email are `tel:`/`mailto:` anchors.
- **AC-1.21** Each contact interaction emits `listing_contact_clicked` with the
  right `channel` and `origin`, and the payload passes the catalog schema.
- **AC-1.22** Session-blind guard green with every touched page.

### Phase 2

- **AC-2.1** Section tabs: only tabs for present sections; clicking scrolls to the
  section below the sticky band; active tab follows the scroll.
- **AC-2.2** Desktop tabs show price + «Consultar» once the gallery is out of view.
- **AC-2.3** Amenities and features: 6 visible on mobile / 8 on desktop (features:
  6 on both), and a breakpoint collapses ONLY when at least 5 items would be hidden
  there (owner decision 2026-11-23). With 4 or fewer hidden, that breakpoint shows
  every item and renders no «Ver las N» button (amenities: up to 10 items on mobile
  and up to 12 on desktop show all; features: up to 10). Otherwise «Ver las N» opens
  a sheet with all N; the inline expand script no longer exists.
- **AC-2.4** Description clamp with «Leer más» toggling `aria-expanded`; full text
  always in the DOM; no toggle when the text fits.
- **AC-2.5** Host section renders only existing fields; its button opens the panel.
- **AC-2.6** Reviews: with reviews → average + track + «Ver las N reseñas» opening
  `ReviewsModal`; without → today's empty state, no placeholder data.
- **AC-2.7** Desktop sidebar: date/guest fields feed the same message builder;
  «o contactá directo» row present when channels exist.
- **AC-2.8** Experience: bar with price from `priceFrom`/`priceUnit` or «Consultar
  precio»; panel with only the channels present; no bar when
  `hasPublicContactChannel()` is false.
- **AC-2.9** Venue: bar without price; «Ver carta» when `menuUrl`; panel with
  social links otherwise; no bar when neither exists.
- **AC-2.10** No WhatsApp element on experience or venue pages (guard test).

## 11. Testing strategy

- **Unit (vitest + testing-library), new:** `ListingContactBar`,
  `ListingContactPanel`, `listing-contact-events`, `build-inquiry-message`,
  `Dialog` `sheet` variant, `ImageGalleryMobileTrack`, `useSwipe`,
  `MobileBookingSummary` (render rule), `track-contact-links`, analytics catalog
  schema for the new event, autohide pin rule, partner page anchors,
  `ListingSectionTabs`, amenities sheet, description clamp, `HostSection`,
  reviews track, experience/venue bar variants.
- **Updated:** `mobile-dock*.test.ts` contracts and
  `mobile-floating-dock.guard.test.ts`; `alojamientos-slug-compare-bar.test.ts`,
  `alojamientos-slug-whats-nearby.test.ts`; `ImageGallery.*.test.tsx`;
  `DetailHeader.test.ts`; `listing-amenities-render`; `ContactHost` tests for the
  new optional props; `share-buttons-in-detail-pages.test.ts` (accommodation now
  uses it).
- **E2E (Playwright, `apps/e2e/tests/guest/guest-NN-listing-detail-mobile.spec.ts`),
  390×844:** AC-1.1, 1.8, 1.11, 1.13, 1.16, plus experience/venue bar presence in
  Phase 2.
- **Guards:** session-blind, `wave-header-anim-sync`, i18n structure guards.
- Coverage target 90% on new files. No `.only`, no hard-coded `.skip`.
- **Manual smoke (staging, real phone):** bar over browser chrome and safe area,
  swipe feel, sheet with the on-screen keyboard open, WhatsApp direct link with a
  VIP account and upsell with a free one.

## 12. Risks

| Risk | P | I | Mitigation |
|---|---|---|---|
| The always-visible bar plus CompareBar plus AI chat crowd the screen | M | M | Row order fixed in §6.1; contract tests; smoke on a 360px device |
| The sheet inside the dock breaks `position: fixed` | H if done wrong | H | Panel mounted outside the portal (§6.2.2), test asserts it is not a dock descendant |
| Gallery mobile track causes CLS or hydration mismatch | M | H | Both presentations SSR'd, CSS switch, locked aspect ratio, CLS test |
| Two `ContactHost` instances (panel + sidebar) double the lookup | M | L | Shared `accommodation-conversation-store` |
| `on-screen keyboard` hides the panel's submit button | M | M | Sheet `max-height: 90dvh`, body scrolls, smoke item |
| Reorder breaks source-order tests | H | L | Updated in the same PR (§11) |
| `ImageGallery` already 962 lines | H | L | New sibling component + hook (§9) |

## 13. Follow-ups (create on approval)

- **Dates and guests as real columns in `conversations`** (`kind-needs-spec`,
  `area-api`, `area-db`, `area-web`): add `check_in`, `check_out`, `guests`, show
  them in the host inbox, and send them from the panel instead of message text.

## 14. Implementation order and delivery

**Tracking (owner decision, 2026-11-20).** HOS-2520 is the epic. Each part is a
Linear sub-issue labelled `fichas-f1` or `fichas-f2`:

| Phase | Sub-issue | Part | Blocked by |
|---|---|---|---|
| 1 | HOS-2521 | Primitives (dock slot, `sheet`, event bus, message builder, analytics event, icon) | — |
| 1 | HOS-2522 | Contact bar + «Consultar» panel on accommodation | 2521 |
| 1 | HOS-2523 | Mobile order: `after-content`, `MobileBookingSummary` | 2521 |
| 1 | HOS-2524 | Swipeable gallery + lightbox swipe | — |
| 1 | HOS-2525 | Compact title, partner tappable contact, contact-block tracking | 2521 |
| 1 | HOS-2526 | Mobile E2E | 2522, 2523, 2524 |
| 2 | HOS-2527 | Section tabs | 2521 |
| 2 | HOS-2528 | Amenities/features summary + sheet | 2521 |
| 2 | HOS-2529 | Description clamp | — |
| 2 | HOS-2530 | Host section + reviews | 2522 |
| 2 | HOS-2531 | Desktop sidebar fields + «Ver las N fotos» | 2522 |
| 2 | HOS-2532 | Experience and venue bars | 2522, 2524, 2525 |
| 2 | HOS-2533 | Visual consistency pass | 2523 |

**Branches (owner decision, DEC-CI-001 umbrella convention).** One umbrella per
phase, each reaching `staging` exactly once:

- `epic/HOS-2520-fichas-f1`, cut from `staging`. Sub-issue branches
  (`feat/HOS-252N-<slug>`) are cut from the umbrella and PR back into it. When
  every Phase 1 sub-issue is merged and the phase smoke passes, the umbrella's own
  PR goes to `staging`.
- `epic/HOS-2520-fichas-f2`, cut from `staging` **after** the Phase 1 umbrella
  merged, same flow.
- `staging` is merged into the active umbrella periodically.
- Sub-issue PR titles carry `[HOS-252N]` and **never** a magic word; only the
  Phase 2 umbrella PR carries `Closes HOS-2520`.
- `check-umbrella-branch-target.sh` discovers every remote `epic/*` head, so no
  guard change is needed.

Phase 1 groups in order:

1. Primitives: dock slot `contact` + autohide pin; `Dialog` `sheet`;
   `listing-contact-events`; `build-inquiry-message`; analytics event;
   `WhatsappLogo` icon.
2. `ListingContactBar` + `ListingContactPanel` + `ContactHost` optional props, wired
   in `alojamientos/[slug].astro`.
3. `after-content` slot, carousels moved, `MobileBookingSummary`, `PricingSidebar`
   hidden ≤1024px.
4. Gallery mobile track + lightbox swipe + share/favorite overlays.
5. Compact title block; partner tappable contact; `track-contact-links` on the
   contact blocks.
6. E2E spec.

Phase 2: tabs → amenities/features sheet → description clamp → host section →
reviews track → desktop sidebar fields → experience/venue bars → visual
consistency pass.

## 15. Internal review notes

- Pass 1 (junior-readability): exact file paths, prop shapes, breakpoints and the
  order of the dock row were made explicit; every "if absent" case states what
  renders.
- Pass 2 (coherence): reuses `DockPortal`, `Dialog`, `ContactHost`,
  `WhatsAppContact`, `ShareButtons`, `FavoriteButton`, `GradientButton`; the only
  new patterns are the `sheet` variant and the window event bus, both justified in
  §6.2. Rejected `display: contents` in §6.3.5.
- Pass 3 (external): no external service is touched (WhatsApp is a plain `wa.me`
  link already built by `buildWhatsAppLink`).
- Pass 4 (testability): every AC in §10 has a pass/fail condition; visual-only
  checks moved to the smoke list.
- Open question for implementation, not blocking: whether `ShareButtons` already
  has an icon-only appearance; §6.4.3 covers both cases.
