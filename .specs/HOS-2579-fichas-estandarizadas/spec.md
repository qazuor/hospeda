---
title: Standardized listing detail pages across verticals and an icon-only mobile action bar
linear: HOS-2579
statusSource: linear
created: 2026-11-23
type: feature
areas:
  - web
related:
  - HOS-2520  # listing detail pages that sell (bar, panel, tabs, clamp). This spec builds on it
  - HOS-2528  # amenities summarising rule + tabs offset (PR #4735, open)
  - HOS-2578  # no-store on 404s of JS chunks (PR #4737, open)
  - HOS-19    # accommodation WhatsApp gated by the viewer's plan (upsell)
  - HOS-2256  # venue WhatsApp and its owner-chosen visibility
  - HOS-363   # experience has no WhatsApp channel
  - HOS-1049  # experience meeting-point map is a paid trait (manage_experience_directions)
  - HOS-1780  # mobile dock must fit one row at 360–430px
  - HOS-1787  # venue body follows the listing-section catalog order
dependsOn:
  # Uncommitted today in worktree hospeda-HOS-2520-owner-smoke-feedback,
  # branch fix/HOS-2520-owner-smoke-feedback. No PR was open on 2026-11-23.
  - "PR [HOS-2520] fix(web): owner smoke feedback on listing detail pages"
smokeGates:
  # The icon row on a real phone (safe area, browser chrome, 360px device,
  # tap targets) is not fully observable in jsdom or Playwright.
  - status-needs-smoke-staging
---

# Standardized listing detail pages across verticals

## 1. Summary

The three public listing detail pages (accommodation, venue «Comer y salir» and
experience) have the same skeleton. Several of their parts are parallel copies
that drifted apart: the header, the contact block, the social links, the
location block, the section order, the icons and the mobile action bar.

This spec makes one canonical component for each shared part, gives the three
pages one section order, and redesigns the sticky mobile footer (the `contact`
slot of `MobileDock`) as one row of icon buttons.

The scope is the owner's decision of 2026-11-23 on the HOS-2579 audit
(Linear comment of the same date):

1. **Package 2 (shared components)** plus the cheap package-1 items that touch
   the same components.
2. **One common section order** for the three pages. The tabs follow it.
3. **An icon-only mobile action bar**:
   `[Consultar] [WhatsApp] [Llamar] [Favorito] [Compartir] [Comparar]`, with the
   price above it in smaller type.

Reviews unification and «similares» for venue and experience are out of scope.

## 2. Problem

Measured on `origin/staging` on 2026-11-23, with staging screenshots at 390px and
1280px (accommodation, two venues and one experience).

| Part | Accommodation | Venue | Experience |
|---|---|---|---|
| Header | `accommodation/DetailHeader.astro` (487 lines) | `venue/VenueDetailHeader.astro` (385) | `experience/ExperienceHero.astro` (407) |
| Rating in header | `RatingStars.astro` | hand-drawn `StarIcon` | hand-drawn `StarIcon` |
| Location line | link to the destination, no icon | `LocationIcon`, plain `<span>`, no link | `LocationIcon`, plain `<span>`, no link |
| Bookmark count glyph | `♥` text (`DetailHeader.astro:156,170`) | `FavoriteButton` count pill | `FavoriteButton` count pill |
| Share on desktop | none | none | none |
| Section tabs | `ListingSectionTabs` | none | none |
| Description clamp | `ClampedText` | none | none |
| Contact block | `AccommodationContactBlock.astro` | `VenueContactBlock.astro` | `ExperienceContactBlock.astro` |
| Social links | `FacebookIcon`/`InstagramIcon` | emoji (`VenueContactBlock.astro:115-120`) | emoji (`ExperienceInfo.astro:97-102`) |
| Location block | `accommodation/LocationSection.astro` + `LocationMap mode="approximate"` | `VenueAddress.astro`, external «Ver en el mapa» link only | `ExperienceMeetingPoint.astro` + `LocationMap mode="exact"`, map only with the paid trait |
| FAQ JSON-LD | `FAQPageJsonLd` | none | none |
| Main JSON-LD | `LodgingBusinessJsonLd` | `VenueJsonLd` | `TouristAttractionJsonLd` with name, description, url, image and telephone only |
| View tracker | `AccommodationViewTracker` | `EntityViewTracker` | `EntityViewTracker` |
| Policies heading | `ListingHouseRules` `<h2>` | `ListingHouseRules` `<h2>` | `ExperiencePreparation` and `ExperienceCancellationPolicy` `<h3>` |

Loose glyphs used as icons on the three pages and their components:

- `★` / `&#9733;`: `ReviewPreview.astro:93`, `ReviewsModal.client.tsx:192`,
  `VenueReviewsPreview.astro:79`, `ExperienceReviews.client.tsx:71`.
- Emoji: `ExperienceMeetingPoint.astro:91` (📍), `ExperiencePreparation.astro:56,72`
  (🎒, ✅), the social emoji above.
- Arrows: `VenueContactBlock.astro:196` (`↗`), `VenueMenu.astro:265` (`↗`),
  `ExperienceMeetingPoint.astro:207` (CSS `content: '→'`).

Section order today:

- **Accommodation** (`alojamientos/[slug].astro:634-790`): gallery, tabs,
  QuickFacts, MobileBookingSummary, description, videos, contact block,
  features and amenities, house rules, promotions, reviews, FAQ, host, location,
  nearby, related.
- **Venue** (`comer-y-salir/[slug].astro:492-556`): gallery, videos, then the
  body in `LISTING_SECTIONS.venue` catalog order through
  `orderVenueDetailSections()` (`lib/venue/venue-detail-sections.ts`), then
  reviews.
- **Experience** (`experiencias/[slug].astro:285-381`): gallery, ExperienceInfo
  (description, hours, amenities, socials), meeting point, preparation,
  cancellation, private groups, contact block, reviews, FAQ.

So contact sits near the top on accommodation, in the middle on venue and near
the end on experience.

Mobile bar today (`ListingContactBar.client.tsx` + `ListingContactActions.tsx`):
price plus a text «Consultar» button, a WhatsApp icon only for accommodations
with `hasWhatsapp`, and no favorite, share, call or compare.

## 3. Goals

- **G-1** One canonical component per shared part: `ListingHeader`,
  `ListingContactBlock` + `ListingSocialLinks`, and `LocationSection` +
  `LocationMap`. The three pages use them, and the vertical copies are deleted.
- **G-2** The same 13-slot section order on the three pages. The tabs follow it.
- **G-3** No emoji, unicode star, heart or arrow used as an icon on the three
  pages or the components they render. Icons come from `@repo/icons`. A guard
  test enforces it.
- **G-4** An icon-only mobile action bar that fits one row at 360px and 390px,
  with «Consultar» first and visually primary.
- **G-5** SEO parity: FAQ JSON-LD on all three pages, and a richer experience
  JSON-LD.
- **G-6** Zero regression in session-blindness, CLS, the WaveHeader compact
  states, the owner-panel interaction counters, the Umami block markers and
  the existing plan gates.

## 4. Non-goals

- **NG-1** Unifying the three review systems (`ReviewPreview` + `ReviewsModal`,
  `VenueReviewsPreview` + `VenueReviewForm`, `ExperienceReviews`). Only their
  star glyph changes (§6.7). A later spec covers the rest.
- **NG-2** «Similares» or other related carousels for venue and experience.
- **NG-3** A host section («Tu anfitrión», «Quién lo ofrece») for venue and
  experience. Slot 9 stays accommodation-only.
- **NG-4** Any change to what an entitlement grants. Every plan gate in §6.11
  stays as it is.
- **NG-5** WhatsApp for experiences (HOS-363).
- **NG-6** Compare for venues or experiences. The compare page
  (`alojamientos/comparar`) exists only for accommodations.
- **NG-7** The partner page, the admin, the API and the database.
- **NG-8** Changing the `LISTING_SECTIONS` catalog `order` in `@repo/schemas`.
  The listing editor reads it too (§6.2.3).
- **NG-9** Anything the in-flight HOS-2520 smoke-feedback PR already does
  (§5.3). This spec builds on it and does not repeat it.

## 5. Current baseline

### 5.1 Building blocks that already exist

- `ListingSectionTabs.client.tsx` takes `vertical: 'accommodation' | 'experience' | 'venue'`
  (L34). Tab keys and anchor ids live in `lib/listing-section-tabs.ts`:
  `LISTING_SECTION_KEYS = ['photos','details','amenities','reviews','host','location']`,
  ids `listing-<key>`. `buildListingSectionTabs({ present, hideOnDesktop })`
  keeps only present sections, in `LISTING_SECTION_KEYS` order.
- `ClampedText.astro` (4 lines mobile / 8 desktop, «Leer más» with
  `aria-expanded`, full text always in the DOM).
- `RatingStars.astro` (props `rating`, `maxStars?`, `size?: 'sm' | 'md'`, `showValue?`).
- `FavoriteButton.client.tsx`: variants `standalone | pill | compact`. State
  lives in `store/favorites-store`, so every instance for the same entity stays
  in sync. It emits `favorite_added` / `favorite_removed`.
- `DetailCompareButton.client.tsx`: accommodation-only, gated by
  `EntitlementKeyEnum.CAN_COMPARE_ACCOMMODATIONS` (`DetailHeader.astro:68`),
  icons `ColumnIcon` / `CheckIcon`.
- `ShareButtons.client.tsx`: Web Share API with a popover fallback, UTM-tagged
  URL, `appearance?: 'icon-overlay'`. It emits no analytics event.
- `LocationMap.client.tsx`: modes `approximate`, `exact` and `multi`. `exact`
  loads `LocationMapInner.client`, and `multi` loads the heavier
  `MultiMarkerMapInner.client`.
- `FAQPageJsonLd.astro` (props `sections`, `name?`, `description?`, `inLanguage?`).
- `EntityViewTracker.client.tsx`: supports `POST | EVENT | VENUE | EXPERIENCE | PARTNER`.
  It has no `ACCOMMODATION` case. `AccommodationViewTracker` emits
  `accommodation_viewed` with `accommodation_id`, `entity_id`, `entity_type`,
  `accommodation_slug`, `locale`, `accommodation_type`, `is_featured`,
  `destination_id` and `source_page: 'accommodation_detail'`, plus the view beacon.
- `@repo/icons` has everything this spec needs: `ChatIcon`, `PhoneIcon`,
  `WhatsappLogo`, `ShareIcon`, `FavoriteIcon`, `ColumnIcon`, `LocationIcon`,
  `StarIcon`, `ExternalLinkIcon`, `ArrowRightIcon`, `CheckCircleIcon`,
  `GlobeIcon`, `FacebookIcon`, `InstagramIcon`, `XIcon`, `TiktokIcon` and
  `YoutubeIcon`. If an implementer needs a glyph that is missing (for example a
  backpack for «Qué llevar»), they add it through `@repo/icons`' own process,
  never inline.

### 5.2 Mobile dock and contact bar

- `MOBILE_DOCK_SLOTS = ['above','contact','filters','start','map-cards','ai-search','ai-chat']`
  (`lib/mobile-dock/mobile-dock-slots.ts:6-14`). Only `contact` and `above` keep
  the dock visible while scrolling.
- `ListingContactBar` props: `vertical`, `listingId`, `locale`, `price`,
  `hasWhatsapp`, `primaryLabelKey`, `panelId`, `fallbackHref?` and
  `primaryLink?` (the venue menu).
- `ListingContactActions` renders the WhatsApp icon only for
  `vertical === 'accommodation' && hasWhatsapp`. It opens the panel with
  `focus: 'whatsapp'`, and the plan gate (HOS-19) is resolved inside the panel
  by `WhatsAppContact`. It emits `listing_contact_clicked` only for
  accommodations. Venue and experience channel clicks are reported by the
  delegated `initContactLinkTracking` listener through `[data-contact-channel]`.
- `listing_contact_clicked` (`packages/analytics/src/catalog.ts:213`) carries
  `listing_id`, `vertical`, `channel` (`whatsapp | phone | email | website | menu | social | form_open`),
  `origin` (`ContactOriginSchema`: `bar | panel | summary | sidebar | contact_block | gallery | tabs`),
  `is_whatsapp_entitled?` and `locale`.
- `favorite_added` / `favorite_removed` carry `entity_id`, `entity_type` and
  `assigned_collection?`. **They have no origin.** No share or compare event
  exists.
- Venue WhatsApp: `VenueWhatsappState = { mode: 'PUBLIC'; number } | { mode: 'LOGGED_IN_ONLY' }`
  (`data/types.ts:1267`). `null` means no button. `VenueWhatsAppButton.client`
  resolves the session for `LOGGED_IN_ONLY`.
- HOS-1780 fixed the dock row at 360–430px. The CSS contract lives in
  `test/layouts/mobile-dock-single-row-contract.test.ts`. Real widths cannot be
  computed in jsdom, so they were measured in a browser.

### 5.3 In-flight work this spec depends on (not repeated here)

- **HOS-2520 owner smoke feedback.** Worktree
  `hospeda-HOS-2520-owner-smoke-feedback`, branch
  `fix/HOS-2520-owner-smoke-feedback`. It was uncommitted and had no PR on
  2026-11-23. It brings:
  - badges of the same height across verticals (`listing-header-badge-contract.source.test.ts`);
  - a «Z/X» photo counter everywhere (`gallery/GalleryCounter.tsx`);
  - an inline venue map and brand social logos (`VenueAddress.map.source.test.ts`);
  - an experience contact block like accommodation's;
  - the AI chat as a mobile drawer;
  - the footer price layout (`ListingContactBar.module.css` `.prefix/.line/.amount/.unit`);
  - a visible `/fotos` link and unified buttons.

  It also creates **`listing/contact/ListingContactChannels.astro`** and
  **`listing/contact/listing-contact.types.ts`**: one presentation for the
  three contact blocks (channels as outline `GradientButton`s, socials as
  outline `IconButton`s with brand logos). This spec promotes that component
  to the canonical `ListingContactBlock` (§6.4) instead of building a second one.
- **PR #4735** (`[HOS-2528]`, open): amenities summarising rule and the tabs
  offset on scroll-up.
- **PR #4737** (`[HOS-2578]`, open): `no-store` on 404s of JS chunks.

**Rule:** implementation starts only after the smoke-feedback PR merges to
`staging`. Every file path below is the one on `staging` after that merge. If
that PR renames something, the implementer follows the rename and records it
in the child issue.

## 6. Proposed design

### 6.1 The 13-slot section order

The order is one constant in a new file,
`apps/web/src/lib/listing-detail/listing-detail-order.ts`:

```ts
/** Canonical slots of a public listing detail page, in render order (HOS-2579). */
export const LISTING_DETAIL_SLOTS = [
    'galleryHeader', // 1. gallery + videos + ListingHeader
    'summary',       // 2. price / today's status / duration + Consultar
    'description',   // 3. description with «Leer más»
    'offers',        // 4. amenities+features / menu+daily specials+night info / what's included
    'hours',         // 5. opening hours (venue, experience)
    'promotions',    // 6. promotions (+ venue events)
    'location',      // 7. location + map (+ what's nearby)
    'reviews',       // 8. reviews (+ external reputation, venue review form)
    'host',          // 9. host (accommodation only)
    'contact',       // 10. contact channels + socials (+ experience private groups)
    'policies',      // 11. house rules / preparation + cancellation
    'faq',           // 12. FAQ
    'related'        // 13. related carousels (`after-content`)
] as const;
export type ListingDetailSlot = (typeof LISTING_DETAIL_SLOTS)[number];
```

A vertical skips a slot it has no content for. Each page renders its blocks by
iterating `LISTING_DETAIL_SLOTS`. It never lists blocks in an ad-hoc order.

#### 6.1.1 Block assignment per vertical

| Slot | Accommodation | Venue | Experience |
|---|---|---|---|
| 1 galleryHeader | `ImageGallery`, `ListingVideoSection`, `ListingHeader` (page-header slot) | same | same |
| 2 summary | `QuickFacts`, `MobileBookingSummary` | new `VenueSummary.astro`: price-range label + «Ver carta»/«Consultar» (`ListingContactActions` origin `summary`) | new `ExperienceSummary.astro`: `ExperiencePriceTag` + duration (moved out of `ExperienceHero`) + «Consultar» (origin `summary`) |
| 3 description | summary + `ClampedText` (existing) | `VenueDescription` with its body wrapped in `ClampedText` | description half of `ExperienceInfo`, wrapped in `ClampedText` |
| 4 offers | `FeaturesGrid`, `AmenitiesGrid` | `FeaturesGrid`, `AmenitiesGrid`, `VenueMenu`, `VenueDailySpecials`, `VenueNightInfo`, `VenueEventsCta` | `FeaturesGrid`, `AmenitiesGrid` (the amenities half of `ExperienceInfo`) |
| 5 hours | — | `OpeningHoursSection` | hours half of `ExperienceInfo` |
| 6 promotions | `PromotionBanner` | `VenuePromotions`, `VenueEvents` | — |
| 7 location | `LocationSection` + `WhatsNearbySection` | `LocationSection` | `LocationSection` (meeting point) |
| 8 reviews | `ReviewPreview` (+ `ReviewsModal`), `ExternalReputation` | `VenueReviewsPreview` + `VenueReviewForm` | `ExperienceReviews` |
| 9 host | `HostSection` | — | — |
| 10 contact | `ListingContactBlock` | `ListingContactBlock` + `VenueWhatsAppContact` | `ListingContactBlock` + `ExperiencePrivateGroups` |
| 11 policies | `ListingHouseRules` | `ListingHouseRules` | `ExperiencePreparation`, `ExperienceCancellationPolicy` |
| 12 faq | `FaqAccordion` | `FaqAccordion` | `ExperienceFaqs` |
| 13 related | 4 × `RelatedCarousel` in `after-content` | — | — |

Notes:

- `ExperienceInfo.astro` is split into its three halves (description, hours,
  amenities and features). Its social half is deleted, because
  `ListingContactBlock` owns socials. The file is deleted once empty.
- `ExperiencePrivateGroups` keeps its `hasContactBlock` guard. It now renders
  right after the contact block, so its CTA anchor is adjacent to its target.
- Venue `VenueEvents` sits in slot 6 because a venue event is a time-bound
  offer, like a promotion. This is a judgment call, flagged in §15.

#### 6.1.2 Every slot is an anchored landmark

Each rendered slot is wrapped in an element whose `id` is
`LISTING_DETAIL_SLOT_IDS[slot]` (`listing-<kebab-slot>`, for example
`listing-gallery-header` and `listing-offers`). The tab ids in
`lib/listing-section-tabs.ts` become aliases of these ids, so
`LISTING_SECTION_IDS` stays exported with the same values:

- `photos` → `listing-photos`, on the gallery wrapper inside slot 1;
- `details` → `listing-details`, on slot 3;
- `amenities` → `listing-amenities`, on slot 4;
- `location` → `listing-location`, on slot 7;
- `reviews` → `listing-reviews`, on slot 8;
- `host` → `listing-host`, on slot 9.

Existing in-page anchors keep their ids, either as the wrapper id or as an
inner id: `contact`, `venue-contact` (`VENUE_CONTACT_ANCHOR_ID`),
`EXPERIENCE_CONTACT_ANCHOR_ID` and `venue-address`.

### 6.2 Tabs on the three pages, in the new order

1. `LISTING_SECTION_KEYS` gains `hours` and `contact`, and is reordered to
   follow the slots:
   `['photos','details','amenities','hours','location','reviews','host','contact']`.
   Add `hours: 'listing-hours'` and `contact: 'listing-contact'` to
   `LISTING_SECTION_IDS`. The `contact` tab points at slot 10, and
   `listing-contact` is the slot-10 wrapper id.
2. `buildListingSectionTabs` is unchanged, because order comes from the keys.
3. Venue and experience mount `ListingSectionTabs` with `client:idle`, right
   after the gallery. Use the same props as accommodation, with
   `vertical="venue" | "experience"`, `price` (venue `null`; experience
   `priceFrom`/`priceUnit`/`isPriceOnRequest`), `panelId` and `primaryLabelKey`
   (`…bar.viewMenu` for a venue with a menu, otherwise `…bar.contact`).
4. Tab labels for `hours` and `contact` are new i18n keys under
   `accommodations.detail.sectionTabs.*` (the namespace the existing tab labels
   use), in es, en and pt.

#### 6.2.3 Venue body order: page order, not catalog order

`orderVenueDetailSections()` currently sorts by `LISTING_SECTIONS.venue[*].order`.
That order also drives the owner's listing editor, so it must not change (NG-8).

The page changes how it orders, not the catalog:

- `VENUE_DETAIL_SECTION_BODY` stays as the exhaustiveness registry
  (`satisfies Record<ListingSectionId<'venue'>, boolean>`).
- Add `VENUE_SECTION_SLOT: Record<VenueDetailBodySectionId, ListingDetailSlot>`
  in `venue-detail-sections.ts`, also typed with `satisfies`, so a new catalog
  section still breaks the build until it gets a slot:
  - `basicInfo` → `description`;
  - `amenities`, `menu`, `dailySpecials` and `nightInfo` → `offers`;
  - `openingHours` → `hours`;
  - `promotions` and `venueEvents` → `promotions`;
  - `location` → `location`;
  - `contact` → `contact`;
  - `faqs` → `faq`.
- `ListingHouseRules` moves out of the `amenities` block list into slot
  `policies`. HOS-2060 bound `policies` to the amenities catalog section for
  the editor. The public page now places it by slot. The catalog binding does
  not change.
- `orderVenueDetailSections()` returns ids sorted by
  `LISTING_DETAIL_SLOTS.indexOf(VENUE_SECTION_SLOT[id])`. Within one slot the
  catalog `order` breaks ties.
- `venue-detail-sections.test.ts` is updated. Its "catalog reversed in, catalog
  order out" case becomes "any input order in, slot order out", with the
  tie-break case kept.

### 6.3 `ListingHeader` (canonical header)

New folder `apps/web/src/components/listing/header/`:

| File | Role |
|---|---|
| `ListingHeader.astro` | Frame: back button, badges, `<h1>`, location line, rating, actions. Keeps every `wh-compact-*` class the three current headers use (`wh-compact-hide`, `wh-compact-title`, `wh-compact-badge`, `wh-compact-demote`), so `WaveHeader`'s compact and hidden states keep working. |
| `ListingHeaderBadges.astro` | The badge row, honouring the badge-height contract from the smoke-feedback PR. |
| `ListingLocationLine.astro` | `LocationIcon` + destination name, as `<a href="/{lang}/destinos/{slug}/">` when the destination has a slug, plain text otherwise. |
| `ListingHeaderActions.astro` | Favorite, compare (accommodation only), share and bookmark count. |
| `listing-header.types.ts` | Prop types. |
| `apps/web/src/lib/listing-header/build-listing-header.ts` | Pure builders `buildAccommodationHeader`, `buildVenueHeader` and `buildExperienceHeader`, mapping each page's detail data to `ListingHeaderProps`. |

Props (RO-RO, `readonly`, `import type`):

```ts
export interface ListingHeaderProps {
    readonly vertical: 'accommodation' | 'venue' | 'experience';
    readonly locale: SupportedLocale;
    readonly entityId: string;
    readonly title: string;
    readonly backHref: string;
    readonly badges: readonly ListingHeaderBadge[];
    readonly rating: { readonly average: number; readonly count: number } | null;
    readonly location: { readonly name: string; readonly href: string | null } | null;
    readonly share: { readonly url: string; readonly title: string; readonly campaign: ShareCampaign };
    readonly compare: boolean;          // true only for accommodation
    readonly bookmarkCount?: number;
    readonly hasMobileGalleryControls: boolean;
}

export type ListingHeaderBadge =
    | { readonly kind: 'type'; readonly label: string; readonly style?: string }
    | { readonly kind: 'featured' | 'verified' | 'new'; readonly label: string }
    | { readonly kind: 'openNow'; readonly openingHours: Record<string, VenueOpeningHoursEntry> };
```

Rules:

- **Rating** always renders through `RatingStars.astro` (`size="sm"`,
  `showValue`) plus the count. `rating === null` or `count === 0` renders
  nothing.
- **Location line**: venue and experience pass
  `href = /{lang}/destinos/{destinationSlug}/` when the detail data carries the
  slug. If a builder finds no slug in the data, `href` is `null` and the line
  is plain text. The builder must not invent a URL.
- **`openNow`** renders `VenueOpenNowBadge` `variant="inline"` with `client:idle`,
  exactly as today. A cached page cannot know «today», so this stays an island.
- **Bookmark count**: the `♥` text glyph is replaced by `FavoriteIcon`
  (`aria-hidden`), and the number keeps its accessible label.
- **Actions**:
  - ≥768px: favorite, compare (accommodation), share. Share uses
    `ShareButtons` with a new `appearance: 'icon'` (round 44px outline button,
    `ShareIcon`).
  - ≤767px with `hasMobileGalleryControls`: favorite and share stay hidden, as
    today, because the gallery overlay and the action bar carry them.
- **Experience price and duration** leave the header for slot 2 (§6.1.1). The
  header is the same frame for the three verticals.
- **Delete**: `accommodation/DetailHeader.astro`, `venue/VenueDetailHeader.astro`
  and `experience/ExperienceHero.astro`. Migrate their tests:
  - `DetailHeader.test.ts` and `VenueDetailHeader.open-now.test.ts` →
    `listing/header/ListingHeader.test.ts`;
  - `wave-header-anim-sync.test.ts` and
    `listing-contact-channels-no-whatsapp.guard.test.ts` repoint to the new
    file.
- Each file stays ≤500 lines. The CSS of the three headers is one copy in
  `ListingHeader.astro`'s `<style>`, or in a sibling `listing-header.css` if
  the file would pass 500 lines.

### 6.4 `ListingContactBlock` + `ListingSocialLinks` (canonical contact)

The base is `ListingContactChannels.astro` from the smoke-feedback PR, which is
already the accommodation look the owner called canonical.

1. Rename `listing/contact/ListingContactChannels.astro` →
   `listing/contact/ListingContactBlock.astro`. Its props
   (`heading?`, `socialHeading?`, `channels`, `socialLinks`, `trackingData`,
   `shell?`, `id?`, `blockProps?`) stay the same.
2. Extract its social row into `listing/contact/ListingSocialLinks.astro` (props
   `links: readonly ListingContactSocialLink[]`, `heading?`, `trackingData`).
   `ListingContactBlock` renders it.
3. Move the data mapping of the three wrappers into pure builders in
   `apps/web/src/lib/listing-contact/listing-contact-block.ts`:
   `buildAccommodationContactBlock`, `buildVenueContactBlock` and
   `buildExperienceContactBlock`. Each returns
   `{ channels, socialLinks, trackingData, id } | null`, where `null` means the
   block does not render. They keep the rules the wrappers apply today:
   - `resolveSafeExternalUrl` for every URL;
   - the HOS-2042 landline;
   - the networks each vertical allows: accommodation Facebook and Instagram;
     venue and experience website, Instagram, Facebook, X, TikTok and YouTube
     when present;
   - `data-interaction-kind` for the owner-panel counters
     (`venue-interaction-attributes.test.ts`);
   - the Umami block marker (`umami-block-markers.test.tsx`).
4. Brand icons: Instagram → `InstagramIcon`, Facebook → `FacebookIcon`,
   X/Twitter → `XIcon`, TikTok → `TiktokIcon`, YouTube → `YoutubeIcon`,
   website → `GlobeIcon`. No emoji.
5. Delete `AccommodationContactBlock.astro`, `VenueContactBlock.astro` and
   `ExperienceContactBlock.astro` once the pages call `ListingContactBlock` with
   the builders' output. Their tests move to the builders (unit) and to one
   `ListingContactBlock.test.ts` (render). The guards that grep these file
   names repoint: `a11y-label-in-name.guard`, `venue-contact-block-whatsapp.guard`,
   `outbound-href-migration`, `landline-public-contact.hos2042` and
   `venue-whatsapp-session-blind`.
6. **No WhatsApp inside `ListingContactBlock`** (unchanged contract). Venue
   WhatsApp stays in `VenueWhatsAppContact`, next to the block in slot 10.

### 6.5 `LocationSection` + `LocationMap` (canonical location)

1. Move `accommodation/LocationSection.astro` → `listing/location/LocationSection.astro`
   and generalize its props:

   ```ts
   interface Props {
       readonly locale: SupportedLocale;
       readonly heading: string;                 // vertical-specific title, from i18n
       readonly addressLines: readonly string[]; // visible text, may be empty
       readonly destination: { readonly name: string; readonly href: string | null } | null;
       readonly map:
           | { readonly mode: 'approximate'; readonly lat: number; readonly lng: number; readonly label: string }
           | { readonly mode: 'exact'; readonly lat: number; readonly lng: number; readonly label: string }
           | null;                               // null = no map (see gates)
       readonly externalMapHref?: string;        // «Abrir en el mapa» (venue)
       readonly directions?: readonly string[];  // experience how-to-get-there
       readonly trackingData?: Readonly<Record<string, string>>;
   }
   ```

2. Pure builders in `apps/web/src/lib/listing-location/build-location-section.ts`:
   - **Accommodation**: `mode: 'approximate'` from `approximateLocation`, as
     today.
   - **Venue**: `mode: 'exact'` from the venue location coordinates, the
     street line from `formatVenueStreetLine` and `externalMapHref` from
     `buildVenueMapUrl`. This is the inline map the smoke-feedback PR adds to
     `VenueAddress`. `VenueAddress.astro` is deleted, and the `venue-address`
     id moves to the section root.
   - **Experience**: `mode: 'exact'` from `meetingPointLat`/`meetingPointLong`
     **only when `meetingPointDirectionsEnabled === true`** (see §6.11). The
     meeting-point text always renders. `directions` only renders when
     enabled. `ExperienceMeetingPoint.astro` is deleted, and its 📍 emoji and
     CSS `→` are replaced by `LocationIcon` and `ArrowRightIcon`.
3. A map is never drawn without coordinates. With `map: null` the section
   shows its text and the destination link only.
4. `LocationMap` keeps its three modes, and no new mode is added. `exact` keeps
   loading the light `LocationMapInner` chunk.
5. `WhatsNearbySection` stays accommodation-only, inside slot 7.

### 6.6 SEO

- **FAQ JSON-LD on venue and experience**: render `FAQPageJsonLd` in
  `head-extra` when the page has at least one FAQ. Build it the way
  accommodation does (`alojamientos/[slug].astro:564-608`, `faqSetInLanguage`).
  Move that mapping into a shared pure helper,
  `lib/seo/faq-jsonld-sections.ts`, used by the three pages.
- **Richer experience JSON-LD**: `TouristAttractionJsonLd.astro` gains optional
  props. It emits each one only when the data exists:
  - `geo` (`GeoCoordinates`, from the meeting-point coordinates);
  - `aggregateRating` (`AggregateRating` with `ratingValue` and `reviewCount`)
    when the review count is above 0;
  - `isAccessibleForFree: false` when `priceFrom > 0`;
  - `containedInPlace` (`City`, the destination name).

  **Price**: schema.org `TouristAttraction` (a `Place`) has no `offers`
  property (verified on 2026-11-23, §15). The price is therefore emitted as
  `@type: ['TouristAttraction', 'TouristTrip']` with `offers: { '@type': 'Offer', price, priceCurrency: 'ARS' }`
  (`TouristTrip` → `Trip` has `offers`). `price` is
  `priceFrom / 100`, because the field is in centavos. With `isPriceOnRequest`,
  no `offers` is emitted. This is flagged in §15 as the one non-obvious
  choice.
- `geo` uses the coordinates whenever they exist. They are already in the
  public payload on every tier (HOS-1048 left them free). The paid part is the
  map widget, not the coordinates.

### 6.7 Icon sweep

Replace every glyph listed in §2 with `@repo/icons` (`aria-hidden="true"`, plus
an accessible text when the glyph carried meaning):

- `★` / `&#9733;` → `StarIcon` (`weight="fill"`), in `ReviewPreview`,
  `ReviewsModal`, `VenueReviewsPreview` and `ExperienceReviews`. Only the glyph
  changes (NG-1).
- `♥` → `FavoriteIcon`.
- 📍 → `LocationIcon`, 🎒 → `BackpackIcon` (add it to `@repo/icons` if missing),
  ✅ → `CheckCircleIcon`.
- `↗` → `ExternalLinkIcon`. CSS `content: '→'` → `ArrowRightIcon` in the
  markup.

### 6.8 Policies heading level

Slot 11 opens with an `<h2>` on all three pages:

- `ListingHouseRules` already uses `<h2>`.
- For experience, slot 11 gets one `<h2>` («Antes de ir», new i18n key
  `experience.detail.policies.title`). `ExperiencePreparation` and
  `ExperienceCancellationPolicy` keep their `<h3>`s under it.

Every slot's first heading is an `<h2>`. The page `<h1>` is in `ListingHeader`.

### 6.9 View tracking

- `EntityViewTracker` gains `'ACCOMMODATION'` in `SupportedEntityType`, plus
  optional props `accommodationType`, `isFeatured` and `destinationId`. For
  `ACCOMMODATION` it emits `WebEvents.AccommodationViewed` with **the exact
  payload `AccommodationViewTracker` emits today** (§5.1) and the same view
  beacon.
- The accommodation page switches to `EntityViewTracker entityType="ACCOMMODATION"`.
- Delete `AccommodationViewTracker.client.tsx`. Its test becomes the
  `ACCOMMODATION` case of `EntityViewTracker.test.tsx`, with the payload
  asserted field by field. The owner stats read these fields.
- Update the drift comment in `EntityViewTracker` (L34-46): `ACCOMMODATION` is
  now supported on both sides.

### 6.10 Icon-only mobile action bar

`ListingContactBar` (≤767px, `contact` dock slot, hidden ≥768px as today)
changes its layout. It does not change slot, portal or autohide.

```
┌──────────────────────────────────────────────┐
│ Desde $ 85.000 /noche                        │  ← price line, smaller (text-sm amount)
│ [💬 Consultar] [WA] [☎] [♡] [⇪] [▥]   [AI]  │  ← one row of icon buttons, ai-chat slot at the end
└──────────────────────────────────────────────┘
```

#### 6.10.1 Buttons, in this order

| # | Action | Icon | Rendered when | Behaviour | Analytics (origin `bar`) |
|---|---|---|---|---|---|
| 1 | Consultar | `ChatIcon` | always (venue: see note) | opens the panel (`openListingContactPanel({ origin: 'bar' })`), falling back to the contact anchor before hydration | `listing_contact_clicked` `channel: 'form_open'` (accommodation, as today) |
| 2 | WhatsApp | `WhatsappLogo` | accommodation: `hasWhatsapp`. Venue: `venue.whatsapp !== null`. Experience: never | accommodation: opens the panel with `focus: 'whatsapp'` (HOS-19 gate inside the panel, unchanged). Venue `PUBLIC`: direct `wa.me` link via `buildWhatsAppLink`. Venue `LOGGED_IN_ONLY`: opens the channels panel focused on the WhatsApp row (`VenueWhatsAppButton` resolves the session) | `listing_contact_clicked` `channel: 'whatsapp'` |
| 3 | Llamar | `PhoneIcon` | the listing has a public phone: accommodation `contactInfo.phone`, then `landlinePhone`; venue and experience `mobilePhone`, then `workPhone` | `tel:` link with the same normalization as `toTelHref` in `listing-channels.ts` | `listing_contact_clicked` `channel: 'phone'` |
| 4 | Favorito | `FavoriteIcon` (via `FavoriteButton` `variant="compact"`) | always | `FavoriteButton` as everywhere (shared store, toast, sign-in flow for anonymous) | `favorite_added` / `favorite_removed` + new optional `origin: 'bar'` |
| 5 | Compartir | `ShareIcon` (via `ShareButtons` `appearance="icon"`) | always | Web Share API, popover fallback | new `listing_shared` (§6.10.4) |
| 6 | Comparar | `ColumnIcon` / `CheckIcon` (via `DetailCompareButton`) | accommodation only | as `DetailCompareButton` today, including its `CAN_COMPARE_ACCOMMODATIONS` gate | none today; this spec adds none (NG-6 scope) |

**Venue primary.** HOS-2520 §7.8 made «Ver carta» the venue's primary when
`menuUrl` exists. Position 1 therefore stays «Ver carta» for a venue with a
menu: same primary styling, icon `ForkKnifeIcon` (add it to `@repo/icons` if
missing), `aria-label` «Ver carta». A venue without a menu shows «Consultar».
This keeps the previous owner decision. §15 flags it for confirmation.

**Absent channels are not rendered.** No disabled or ghost button. The
experience bar therefore shows 1, 3?, 4 and 5. The venue bar shows 1, 2?, 3?,
4 and 5.

**Experience and venue without any channel.** Today `ListingContactBar` is
omitted when `hasPublicContactChannel()` is false (experience) or
`contactMode.kind === 'none'` (venue). Now the bar renders whenever at least
one button renders. Favorite and share always exist, so the bar is always
rendered, and «Consultar» is omitted when there is no channel to consult.

#### 6.10.2 Visual and accessibility rules

- «Consultar» is visually primary by every means except width: first position,
  filled `btn-gradient--accent`, 52×44px (the others 44×44), and its icon in
  the primary foreground. The rest are outline `IconButton`s.
- Every button has an accessible name from i18n
  (`aria-label`, es/en/pt, keys under
  `accommodations.detail.listingContact.bar.actions.*`: `inquire`, `viewMenu`,
  `whatsapp`, `call`, `favoriteAdd`, `favoriteRemove`, `share`, `compareAdd`,
  `compareRemove`). The label follows the state: favorite and compare toggle
  their label and `aria-pressed`.
- Tap target ≥44×44px for every button, with a 4px gap between buttons.
- **Width budget at 360px**: the dock inline padding is 8px per side (HOS-1780
  compact spacing). That gives 52 + 5 × 44 + 44 (the `ai-chat` button) = 316px,
  plus 6 gaps × 4px = 24px, which is 340px. That fits in 344px. At 390px it has
  ≥30px to spare. If the AI chat drawer from the smoke-feedback PR removes the
  `ai-chat` dock button, the budget only improves.
- The price line is above the row: amount `text-sm` bold, unit and prefix
  `text-caption` muted (the smoke-feedback classes). No price means no price
  line (venue).

#### 6.10.3 Session-blindness

The `.astro` pages pass only public facts: `hasWhatsapp`, the venue
`whatsapp` mode, public phones, `entityId`, the share URL and `compare: boolean`.
The favorite state, the compare selection count and the WhatsApp entitlement
live in islands (`FavoriteButton`, `DetailCompareButton`, `WhatsAppContact`,
`VenueWhatsAppButton`). `cacheable-pages-are-session-blind.guard.test.ts` stays
green.

#### 6.10.4 Analytics changes

- `favorite_added` / `favorite_removed` gain optional
  `origin: ContactOriginSchema.optional()`. The change is additive, so old
  callers stay valid. `FavoriteButton` gains an optional `origin` prop and
  forwards it.
- New event `listing_shared` in `packages/analytics/src/catalog.ts`:
  `{ listing_id, vertical: 'accommodation' | 'experience' | 'venue', origin: ContactOriginSchema, method: 'native' | 'copy' | 'network', locale }`.
  `ShareButtons` gains optional `analytics?: { listingId; vertical; origin }`,
  and emits the event only when that prop is passed (events and posts are
  unchanged).
- Every bar `tel:` / `wa.me` anchor carries `data-contact-channel`,
  `data-contact-origin="bar"`, `data-listing-id` and `data-vertical`, and is
  reported **only** by the delegated `initContactLinkTracking` listener. The
  buttons that open the panel keep their direct `trackEvent`. So one tap
  produces exactly one event.
- Each of the three pages calls `initContactLinkTracking({ document })` (venue
  and experience already do; accommodation adds it if it is missing).

### 6.11 Plan gates kept, stated explicitly

| Gate | Where it is resolved | What this spec does |
|---|---|---|
| Accommodation WhatsApp number (HOS-19, `WhatsAppContact`, protected `GET …/whatsapp`) | island, after session | unchanged. The bar's WhatsApp opens the panel, and anonymous visitors see the upsell with no network call |
| Venue WhatsApp visibility (HOS-2256, `whatsapp.mode`) | public payload + `VenueWhatsAppButton` | unchanged. `PUBLIC` → direct link, `LOGGED_IN_ONLY` → panel row, `null` → no button |
| Experience meeting-point map and directions (`manage_experience_directions`, `meetingPointDirectionsEnabled` from `public-listing-projector.ts:246-252`) | API projector | **kept**. No exact map and no directions without the trait. The meeting-point text and destination link always render |
| Compare (`CAN_COMPARE_ACCOMMODATIONS`) | `DetailCompareButton` | unchanged, and reused in the bar |
| Venue paid sections (section states from the projector) | API projector | unchanged. Each block still self-hides on empty props |

## 7. UX per width

| Width | Header | Tabs | Body | Action bar |
|---|---|---|---|---|
| 360px | Back row hidden, title, badges scroll horizontally, location line, rating. Favorite and share hidden (gallery overlay). Breadcrumbs hidden (JSON-LD kept) | sticky, horizontal scroll, active tab auto-scrolls into view | one column, 13-slot order | one row: price line above, 5–6 icons + `ai-chat`, no wrap, dock height equal to the single-row height measured by HOS-1780 |
| 390px | same as 360 | same | same | same, ≥30px spare |
| 820px (tablet) | full header with favorite, compare (accommodation) and share as round 44px buttons | sticky; the price + CTA band appears after the gallery (HOS-2527) | one column (DetailLayout collapses at ≤1024px). Accommodation sidebar hidden, `MobileBookingSummary` in slot 2 | hidden (≥768px) |
| 1280px | same as 820 | same | accommodation: two columns with sticky sidebar. Venue and experience: one column (`showSidebar={false}`) | hidden |

Edge cases:

- A listing without photos: slot 1 is the header only, and no `photos` tab.
- No FAQ: no slot 12, no `FAQPageJsonLd`.
- An experience without the trait but with coordinates: no map (§6.11).
- A venue without hours: no slot 5, no `hours` tab.
- A listing with no public channel: no «Consultar», no Llamar, no WhatsApp.
  The bar still shows favorite and share.

## 8. User stories and acceptance criteria

Each AC is an automated test: unit/source (vitest) unless marked E2E.

### US-1: Same section order everywhere

**As a** visitor comparing a cabin, a bar and a tour, **I want** each page
organized the same way, **so that** I find price, location and contact in the
same place on each.

- **AC-1** Given the three pages' sources, when the slot wrappers are read in
  document order, then their `id`s are a subsequence of
  `LISTING_DETAIL_SLOT_IDS` in `LISTING_DETAIL_SLOTS` order (source guard
  `listing-detail-section-order.guard.test.ts`).
- **AC-2** Given `orderVenueDetailSections({ sections })` with the venue catalog
  in any order, then the output follows `VENUE_SECTION_SLOT` slot order, with
  ties broken by catalog `order`. And `VENUE_SECTION_SLOT` is exhaustive
  (type-level `satisfies` plus a runtime key-equality test).
- **AC-3** Given the venue catalog, then `LISTING_SECTIONS.venue[*].order` is
  unchanged by this spec (snapshot of the ids-and-order pairs).
- **AC-4** Given a rendered accommodation, venue and experience at 390px, then
  `#listing-location` precedes `#listing-reviews`, which precedes
  `#listing-contact`, which precedes the FAQ (`compareDocumentPosition`). (E2E)

### US-2: Tabs on the three pages

- **AC-5** Given `buildListingSectionTabs` with every key present, then the keys
  come out as `photos, details, amenities, hours, location, reviews, host, contact`.
- **AC-6** Given a venue with hours and a menu, then its page renders
  `ListingSectionTabs` with `vertical="venue"` and tabs only for present
  sections. Clicking «Horarios» scrolls `#listing-hours` below the sticky band.
  (unit + E2E)
- **AC-7** Given an experience, then its page renders `ListingSectionTabs` with
  `vertical="experience"` and the experience price. A missing section produces
  no tab.

### US-3: One header

- **AC-8** Given the three pages, then each imports
  `listing/header/ListingHeader.astro`, and the files `DetailHeader.astro`,
  `VenueDetailHeader.astro` and `ExperienceHero.astro` do not exist (source
  guard).
- **AC-9** Given `buildVenueHeader` / `buildExperienceHeader` with a destination
  slug, then `location.href === '/{lang}/destinos/{slug}/'`. Without a slug,
  `href === null` and the line renders as text with `LocationIcon`.
- **AC-10** Given a rating of 4.6 with 12 reviews, then the header renders
  `RatingStars` and the count. With 0 reviews it renders no rating element.
- **AC-11** Given ≥768px, then the header shows a share button
  (`ShareButtons appearance="icon"`) on the three verticals, and a compare
  button only on accommodation.
- **AC-12** `wave-header-anim-sync.test.ts` stays green against `ListingHeader`,
  with every `wh-compact-*` class present.

### US-4: One contact block with brand icons

- **AC-13** Given the three builders, then accommodation social links are
  limited to Facebook and Instagram, venue and experience map every present
  network to its brand icon, and every `href` went through
  `resolveSafeExternalUrl` (unsafe URL → link omitted).
- **AC-14** Given a builder with no channel and no social link, then it returns
  `null` and the page renders no slot-10 block (and no `contact` tab).
- **AC-15** Given the venue contact block, then each link still carries its
  `data-interaction-kind` and the Umami block marker
  (`venue-interaction-attributes`, `umami-block-markers` green).
- **AC-16** `ListingContactBlock` never renders a WhatsApp link (guard
  `listing-contact-channels-no-whatsapp` repointed, green).

### US-5: One location block, map in all three

- **AC-17** Given a venue with coordinates, then slot 7 renders `LocationMap`
  `mode="exact"` and the «Abrir en el mapa» link. Without coordinates it
  renders the street line only.
- **AC-18** Given an experience with coordinates and
  `meetingPointDirectionsEnabled=false`, then no `LocationMap` and no directions
  list render, and the meeting-point text and destination link do. With
  `true`, then the exact map and the directions render.
- **AC-19** Given an accommodation, then slot 7 renders `mode="approximate"`
  as before, and `WhatsNearbySection` follows it inside slot 7.

### US-6: Icons, not glyphs

- **AC-20** Guard `listing-detail-no-glyph-icons.guard.test.ts`: the three
  pages, `components/listing/**` and every component they import from
  `components/{accommodation,venue,experience}/**` contain no character from
  the emoji ranges (U+1F300–U+1FAFF, U+2600–U+27BF), no `★ ☆ ♥ ♡ → ← ↗ ↘ ↑ ↓ ✕ ✓`,
  no `&#9733;`/`&#9829;`, and no CSS `content:` with one of them. Comments are
  exempt. Editor and manager components (`*Manager.client.tsx`,
  `listing/editor/**`) are out of the guard's set, and the guard header says so.
- **AC-21** Mutation check: inserting `★` into `VenueReviewsPreview.astro`
  turns the guard red.

### US-7: SEO parity

- **AC-22** Given a venue or experience with 2 FAQs, then the page's
  `head-extra` contains one `FAQPageJsonLd` with 2 questions in the page
  locale. With 0 FAQs it contains none.
- **AC-23** Given an experience with coordinates, 5 reviews averaging 4.4, and
  `priceFrom = 850000`, then the JSON-LD has
  `@type: ['TouristAttraction','TouristTrip']`,
  `geo.latitude`/`geo.longitude`,
  `aggregateRating.ratingValue = 4.4`, `reviewCount = 5`, and
  `offers.price = 8500`, `priceCurrency = 'ARS'`. With `isPriceOnRequest` it
  has no `offers`, and with 0 reviews no `aggregateRating`.

### US-8: Description, headings and tracking

- **AC-24** Venue and experience descriptions render inside `ClampedText` (full
  text in the DOM, toggle `aria-expanded`).
- **AC-25** On the three pages, the first heading of every slot is an `<h2>`,
  and there is exactly one `<h1>`.
- **AC-26** `EntityViewTracker entityType="ACCOMMODATION"` emits
  `accommodation_viewed` with a payload deep-equal to the old tracker's
  (`toStrictEqual`, not `objectContaining`), plus one view beacon. And
  `AccommodationViewTracker.client.tsx` no longer exists.

### US-9: Icon-only action bar

**As a** mobile visitor, **I want** every useful action one tap away at the
bottom, **so that** I can ask, call, save or share without scrolling back.

- **AC-27** Given an accommodation with price, `hasWhatsapp`, a public phone and
  compare, then the bar renders, in order: Consultar, WhatsApp, Llamar,
  Favorito, Compartir, Comparar. Each has a non-empty accessible name, and
  Consultar has the primary class.
- **AC-28** Given an experience with a phone, then the bar renders Consultar,
  Llamar, Favorito and Compartir, with **no** WhatsApp and no Comparar (guard:
  no `WhatsappLogo` in the experience bar output).
- **AC-29** Given a venue with `whatsapp.mode === 'PUBLIC'`, then the WhatsApp
  button is a `wa.me` anchor. With `LOGGED_IN_ONLY` it opens the channels panel
  focused on the WhatsApp row. With `null` there is no WhatsApp button.
- **AC-30** Given an accommodation with `hasWhatsapp` and an anonymous visitor,
  when WhatsApp is tapped, then the panel opens on the WhatsApp row with the
  upsell, and no request to `/protected/accommodations/:id/whatsapp` is made.
- **AC-31** Given no public phone, then there is no Llamar button. Given no
  channel at all, then there is no Consultar, and Favorito and Compartir still
  render. No button in the bar is `disabled` or `aria-disabled` (guard).
- **AC-32** Given a venue with `menuUrl`, then position 1 is «Ver carta» with the
  primary class and `data-contact-channel="menu"`.
- **AC-33** At 360×740 and 390×844, for the accommodation fixture with all six
  buttons plus `ai-chat`, then every `[data-dock-item]` in the dock row has the
  same `offsetTop`, and the dock height is within 2px of the HOS-1780
  single-row baseline. (E2E, `apps/e2e`)
- **AC-34** At 360px every bar button's bounding box is ≥44×44px. (E2E)
- **AC-35** Tapping each bar action emits exactly one event:
  - `listing_contact_clicked` with `origin: 'bar'` and the right `channel` for
    Consultar, WhatsApp and Llamar;
  - `favorite_added` with `origin: 'bar'`;
  - `listing_shared` with `origin: 'bar'`.

  Every payload passes its catalog schema. (unit with a mocked `trackEvent`
  and the delegated listener installed)
- **AC-36** Toggling favorite in the bar updates the gallery overlay's
  `FavoriteButton` for the same entity (shared store) without a reload.
- **AC-37** At ≥768px the bar is not displayed, and `--mobile-dock-height` does
  not count it (existing AC-1.6 of HOS-2520 stays green).
- **AC-38** `cacheable-pages-are-session-blind.guard.test.ts` and
  `venue-whatsapp-session-blind.test.ts` are green with the three pages.

## 9. Architecture summary

### 9.1 Files to create

- `apps/web/src/lib/listing-detail/listing-detail-order.ts`
- `apps/web/src/components/listing/header/{ListingHeader,ListingHeaderBadges,ListingLocationLine,ListingHeaderActions}.astro`
  and `listing-header.types.ts`
- `apps/web/src/lib/listing-header/build-listing-header.ts`
- `apps/web/src/components/listing/contact/ListingSocialLinks.astro`
- `apps/web/src/lib/listing-contact/listing-contact-block.ts`
- `apps/web/src/components/listing/location/LocationSection.astro` (moved)
- `apps/web/src/lib/listing-location/build-location-section.ts`
- `apps/web/src/lib/seo/faq-jsonld-sections.ts`
- `apps/web/src/components/venue/VenueSummary.astro`
- `apps/web/src/components/experience/ExperienceSummary.astro`
- `apps/web/src/components/listing/contact/ListingActionBarButtons.tsx`
  (the icon row, used by `ListingContactBar`; `ListingContactActions` stays for
  the tabs and the summary)
- Icons, only if missing: `BackpackIcon`, `ForkKnifeIcon` in `@repo/icons`.

### 9.2 Files to rename

- `listing/contact/ListingContactChannels.astro` → `ListingContactBlock.astro`.

### 9.3 Files to delete

- `accommodation/DetailHeader.astro`, `venue/VenueDetailHeader.astro`,
  `experience/ExperienceHero.astro`
- `accommodation/AccommodationContactBlock.astro`, `venue/VenueContactBlock.astro`,
  `experience/ExperienceContactBlock.astro`
- `accommodation/LocationSection.astro` (moved), `venue/VenueAddress.astro`,
  `experience/ExperienceMeetingPoint.astro`, `experience/ExperienceInfo.astro`
- `analytics/AccommodationViewTracker.client.tsx`

### 9.4 Files to modify

- The three pages.
- `lib/listing-section-tabs.ts`, `lib/venue/venue-detail-sections.ts`.
- `ListingContactBar.client.tsx` / `.module.css`.
- `ShareButtons.client.tsx` (`appearance: 'icon'`, `analytics?`).
- `FavoriteButton.client.tsx` (`origin?`).
- `EntityViewTracker.client.tsx`, `TouristAttractionJsonLd.astro`.
- `ReviewPreview.astro`, `ReviewsModal.client.tsx`, `VenueReviewsPreview.astro`,
  `ExperienceReviews.client.tsx`, `ExperiencePreparation.astro`, `VenueMenu.astro`.
- `packages/analytics/src/catalog.ts`.
- `packages/i18n` es/en/pt (`accommodations.json`, `experience` namespace).

### 9.5 Migration per page (the order inside each PR)

1. **Accommodation**: mount slot wrappers → swap `DetailHeader` for
   `ListingHeader` → swap the contact block → move `LocationSection` → reorder
   by slots → swap the tracker.
2. **Venue**: `VENUE_SECTION_SLOT` + new `orderVenueDetailSections` → slot
   wrappers → `ListingHeader` → `VenueSummary` → `ClampedText` → contact block →
   `LocationSection` (map) → tabs → FAQ JSON-LD.
3. **Experience**: split `ExperienceInfo` → `ListingHeader` + `ExperienceSummary`
   → `ClampedText` → contact block → `LocationSection` (gate) → policies `<h2>` →
   tabs → FAQ JSON-LD + richer JSON-LD.

## 10. Data model

No DB change, no API change, no migration, no seed change. Every field used
already exists in the public payloads (`destination.slug` for accommodation;
venue and experience destination slug if present, otherwise text, §6.3).

Two **additive** analytics contract changes: `origin?` on the favorite events
and the new `listing_shared` event. `packages/analytics` tests cover both.

## 11. Testing strategy

- **Unit (vitest + testing-library), new:** `listing-detail-order`,
  `build-listing-header`, `listing-contact-block`, `build-location-section`,
  `faq-jsonld-sections`, `ListingHeader` render, `ListingContactBlock` +
  `ListingSocialLinks` render, `LocationSection` render (three map variants),
  `ListingActionBarButtons` (render rules, labels, order, no disabled buttons),
  `TouristAttractionJsonLd` (AC-23), `EntityViewTracker` ACCOMMODATION case,
  `ShareButtons` analytics, `FavoriteButton` origin, the catalog schemas of the
  two analytics changes.
- **Updated:** `venue-detail-sections.test.ts`, `listing-section-tabs` tests,
  `ListingSectionTabs` tests, `ListingContactBar.test.tsx`, the repointed guards
  of §6.3 and §6.4, `listing-amenities-render.test.ts`,
  `desktop-card-visual-consistency.source.test.ts`,
  `experience-contact-block.test.ts`, `detail-contact-links.test.ts`,
  `share-buttons-in-detail-pages.test.ts` (now venue and experience too).
- **New guards (`apps/web/test/static-guards/`):**
  - `listing-detail-section-order.guard.test.ts` (AC-1);
  - `listing-detail-no-glyph-icons.guard.test.ts` (AC-20, with the mutation check
    in AC-21 performed once and recorded in the PR);
  - `listing-detail-shared-components.guard.test.ts`: the three pages import
    `ListingHeader`, `ListingContactBlock` and `LocationSection` from
    `components/listing/**`, and no page imports a deleted file (AC-8).

  Each guard's header lists what it cannot see, per repo convention.
- **E2E (Playwright, `apps/e2e/tests/guest/guest-13-listing-detail-standard.spec.ts`):**
  AC-4, AC-6, AC-33 and AC-34 at 360×740 and 390×844, plus AC-30.
  - Fixtures follow `apps/e2e/fixtures/listing-contact-fixtures.ts`: E2E-only
    rows cloned from a published seeded listing, idempotent by slug, never in
    `@repo/seed`.
  - Add to `LISTING_CONTACT_FIXTURE_SLUGS`:
    - `accommodationAllActions`: price, `hasWhatsapp`, phone (for AC-33);
    - `experienceWithMapTrait` / `experienceWithoutMapTrait` (AC-18), if the
      seed has no published experience with each trait value;
    - `venueWithHoursAndMenu` (AC-6).
  - Existing `guest-11-listing-detail-mobile.spec.ts` and
    `guest-12-experience-venue-contact-bar.spec.ts` are updated for the icon row
    (their «Consultar» text selectors become role+name selectors).
- **Not testable automatically → staging smoke** (label
  `status-needs-smoke-staging`): the bar over real browser chrome and safe
  area on a 360px phone, tap comfort, the Web Share sheet, and WhatsApp direct
  vs upsell with a VIP and a free account.
- Coverage ≥90% on new files. No `.only`, no hard-coded `.skip`. Run suites per
  file or package filter, never the full web suite locally.

## 12. Risks

| Risk | P | I | Mitigation |
|---|---|---|---|
| The smoke-feedback PR is still uncommitted; this spec's base moves | H | M | Hard dependency (§5.3); implementation starts after it merges; renames are followed and recorded |
| 6 icons + ai-chat overflow at 360px | M | H | Width budget in §6.10.2; E2E AC-33/34 at 360 and 390; Consultar is 52px, not a text button |
| Consultar loses weight as an icon | M | M | First position, filled gradient, larger; label in `aria-label`; staging smoke measures it; owner accepted the tradeoff |
| Reordering venue breaks the editor | L if done right | H | Catalog `order` untouched (AC-3); page ordering via `VENUE_SECTION_SLOT` |
| Deleting the three headers breaks WaveHeader compact states | M | H | Keep every `wh-compact-*` class; `wave-header-anim-sync` guard; CLS tests |
| Owner-panel counters lose `data-interaction-kind` in the contact rewrite | M | H | Builders own the attribute; `venue-interaction-attributes` stays green (AC-15) |
| `accommodation_viewed` payload drifts in the tracker migration | M | H | `toStrictEqual` payload test (AC-26) |
| Double analytics events (direct + delegated) | M | M | Rule in §6.10.4, AC-35 counts exactly one |
| Exact map for an unentitled experience leaks the paid trait | L | H | Gate stated in §6.11; AC-18 |
| Multi-typed experience JSON-LD read badly by a crawler | L | L | Validated with the Schema Markup Validator in the PR; fallback is to drop `offers` (§15) |
| Large PRs over the same three pages conflict | H | M | Umbrella branch and a strict PR order (§13) |

## 13. Implementation phases and PR split

**Tracking.** On approval, create one Linear sub-issue of HOS-2579 per row. Each
gets one PR. The sub-issue titles carry `[HOS-NNNN]`, and the PRs never carry a
magic word. Only the umbrella PR carries `Closes HOS-2579`.

**Branches.** This follows the DEC-CI-001 umbrella convention, as HOS-2520 did
(owner confirmation pending, §15). The umbrella is
`epic/HOS-2579-fichas-estandarizadas`, cut from `staging` after the
smoke-feedback PR merges. Each sub-issue branch is cut from the umbrella and
PRs back into it. `staging` is merged into the umbrella periodically. The
umbrella's own PR goes to `staging` once, after the staging smoke.

| # | Child issue (PR) | Content | ACs | Blocked by |
|---|---|---|---|---|
| 1 | Order contract + tabs | `listing-detail-order.ts`, slot wrappers on the three pages (no reordering yet), new tab keys, `VENUE_SECTION_SLOT` + `orderVenueDetailSections`, tabs on venue and experience | AC-2, 3, 5, 6, 7 | smoke-feedback PR |
| 2 | `ListingContactBlock` + `ListingSocialLinks` | rename, extract, builders, delete the three wrappers, repoint guards | AC-13–16 | 1 |
| 3 | `LocationSection` + map | move, builders, venue map, experience gate, delete `VenueAddress` and `ExperienceMeetingPoint` | AC-17–19 | 1 |
| 4 | `ListingHeader` | four components, builders, desktop share, `VenueSummary`, `ExperienceSummary`, delete the three headers | AC-8–12 | 1 |
| 5 | Reorder + content parity | apply the 13-slot order on the three pages, split `ExperienceInfo`, `ClampedText`, policies `<h2>`, order guard | AC-1, 4 (unit), 24, 25 | 2, 3, 4 |
| 6 | SEO + tracking | FAQ JSON-LD helper and venue/experience usage, richer experience JSON-LD, `EntityViewTracker` ACCOMMODATION | AC-22, 23, 26 | 1 |
| 7 | Icon sweep + guard | §6.7 replacements, `listing-detail-no-glyph-icons` guard, shared-components guard | AC-20, 21 | 2, 3, 4, 5 |
| 8 | Icon-only action bar | `ListingActionBarButtons`, `ShareButtons`/`FavoriteButton` props, analytics catalog changes, i18n | AC-27–32, 35–38 | 4 |
| 9 | E2E | fixtures + `guest-13`, update `guest-11` and `guest-12` | AC-4, 33, 34, 30 (E2E) | 5, 8 |

PRs 2, 3, 4 and 6 can run in parallel after 1. They touch different components,
and each changes only its own call site in the pages. PR 5 is the only one that
moves blocks around in the pages.

## 14. Follow-ups (create on approval)

- Reviews unification across the three verticals (NG-1).
- «Similares» carousels for venue and experience (NG-2).
- A host / «quién lo ofrece» section for venue and experience (NG-3).
- A `listing_compare_toggled` analytics event, if the owner wants compare
  usage measured from the bar.

## 15. Internal Review Notes

**Pass 1: completeness and junior-readability.**

- Every shared component got a file path, a prop shape and a delete list.
- The 13-slot table assigns every existing block of the three pages to a
  slot, so no block is left to judgment.
- The venue catalog-order conflict (found while reading
  `venue-detail-sections.ts`) is resolved explicitly in §6.2.3 instead of being
  left implicit.
- «Absent channel» and «no channel at all» cases state what renders.

**Pass 2: technical coherence.**

- The spec reuses `ListingSectionTabs`, `ClampedText`, `RatingStars`,
  `FavoriteButton` (shared store), `DetailCompareButton`, `ShareButtons`,
  `LocationMap` (no new mode), `FAQPageJsonLd`, `initContactLinkTracking` and
  the smoke-feedback `ListingContactChannels`, which is promoted instead of
  duplicated.
- No new dependency. Styling stays Astro scoped and CSS Modules, with no
  Tailwind.
- Session-blind rules are kept (§6.10.3).
- Today's venue status stays a client island, because a cached page cannot
  know «today».
- Correction found while verifying: the audit assumed "existing" share and
  favorite events with an origin. On `origin/staging` there is no share event,
  and the favorite events have no `origin`. §6.10.4 adds both additively.

**Pass 3: external accuracy.**

- schema.org `TouristAttraction`: verified against
  <https://schema.org/TouristAttraction> on 2026-11-23. `geo`,
  `aggregateRating`, `isAccessibleForFree` and `containedInPlace` are valid
  (from `Place`). `offers` and `priceRange` are **not**, which is why §6.6
  multi-types with `TouristTrip`.
- No other external service is touched. WhatsApp stays a plain `wa.me` link via
  `buildWhatsAppLink`.

**Pass 4: testability.**

- Every AC names its test kind.
- The width and tap-target claims are E2E (AC-33/34), because jsdom cannot
  compute widths (HOS-1780 header).
- AC-26 requires `toStrictEqual`, because `objectContaining` cannot see a
  missing field.
- The glyph guard has a mutation check (AC-21).

**Open questions for the owner. None blocks Phase 1 (PR 1), and each has a
recommendation:**

1. **Venue position 1, «Ver carta» vs «Consultar».** *Recommended:* keep «Ver
   carta» as the primary when there is a menu (HOS-2520 §7.8).
   *Alternative:* «Consultar» always, with the menu as the first row of the
   panel. That costs one extra tap to reach the menu.
2. **Experience price in JSON-LD as `TouristAttraction` + `TouristTrip`.**
   *Recommended:* multi-type with `offers`. *Alternative:* no price in JSON-LD,
   because `TouristAttraction` alone cannot carry it validly.
3. **Venue events in slot 6 (promotions)**, not slot 4 (what it offers).
   *Recommended:* slot 6.
4. **Umbrella branch for the 9 PRs**, as in HOS-2520. *Recommended:* yes. The
   nine PRs edit the same three pages, and an umbrella lets them reach
   `staging` as one tested unit.
5. **The in-flight smoke-feedback PR** had not been opened on 2026-11-23. This
   spec assumes it lands first, with `ListingContactChannels` as written in
   its worktree.
