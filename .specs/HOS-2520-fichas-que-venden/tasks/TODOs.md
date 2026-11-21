# HOS-2520 Listing detail pages that sell - TODOs

All tasks pending. Format: `T-NNN` title (complexity) <- blockedBy.

## Phase 1 (conversion)

### HOS-2521
- [ ] T-001 Add `contact` dock slot to MOBILE_DOCK_SLOTS and MobileDock.astro (c2, core) <- none
- [ ] T-002 Add contact-slot pin rule to mobile-dock-autohide (c2, core) <- T-001
- [ ] T-003 Add `sheet` variant to Dialog (bottom sheet at <=767px) (c3, core) <- none
- [ ] T-004 Create listing-contact-events bus with Zod payload (c2, core) <- none
- [ ] T-005 Add listing-contact i18n keys (es/en/pt) (c2, core) <- none
- [ ] T-006 Create build-inquiry-message pure function (c2, core) <- T-005
- [ ] T-007 Add listing_contact_clicked event to analytics catalog and web alias (c2, core) <- none
- [ ] T-008 Add WhatsappLogo icon to @repo/icons (c1, core) <- none

### HOS-2522
- [ ] T-009 Add sourcePage and origin optional props to ContactHost (c2, core) <- T-007
- [ ] T-010 Create ListingContactBar island (c3, core) <- T-001, T-004, T-005, T-007, T-008
- [ ] T-011 Create ListingContactPanel shell with sheet dialog and shortcuts (c3, core) <- T-003, T-004, T-005, T-007
- [ ] T-012 Add dates/guests fields and ContactHost wiring to the panel (c3, core) <- T-011, T-006, T-009
- [ ] T-013 Make WhatsAppContact emit tracking and honor panel focus (c2, core) <- T-007, T-011
- [ ] T-014 Wire bar and panel into alojamientos/[slug].astro (c3, integration) <- T-010, T-012, T-013, T-002

### HOS-2523
- [ ] T-015 Add after-content slot to DetailLayout and move RelatedCarousels (c3, core) <- T-001
- [ ] T-016 Create MobileBookingSummary.astro (c2, core) <- T-005
- [ ] T-017 Create MobileBookingSummaryActions island with tracking (c2, core) <- T-016, T-004, T-007
- [ ] T-018 Insert MobileBookingSummary after QuickFacts and hide PricingSidebar <=1024px (c2, integration) <- T-015, T-016, T-017

### HOS-2524
- [ ] T-019 Create useSwipe hook (c2, core) <- none
- [ ] T-020 Add touch swipe to the lightbox in ImageGallery (c2, core) <- T-019
- [ ] T-021 Create ImageGalleryMobileTrack scroll-snap track (c3, core) <- none
- [ ] T-022 Add mobile gallery overlays (back, share, favorite, counter, dots) (c3, core) <- T-021
- [ ] T-023 Integrate mobile track into ImageGallery detail variant (c3, integration) <- T-020, T-022

### HOS-2525
- [ ] T-024 Compact title block in DetailHeader at <=767px (c3, core) <- T-001
- [ ] T-025 Render QuickFacts on one line on mobile (c1, core) <- T-024
- [ ] T-026 Create track-contact-links delegated click tracker (c2, core) <- T-007
- [ ] T-027 Make partner page phone and email tappable with tracking (c2, core) <- T-026
- [ ] T-028 Add data-contact-channel to AccommodationContactBlock (c1, core) <- T-026
- [ ] T-029 Add data-contact-channel to Experience and Venue contact blocks (c2, core) <- T-026

### HOS-2526
- [ ] T-030 Write E2E guest-NN-listing-detail-mobile spec: bar and sheet (c3, testing) <- T-014
- [ ] T-031 Add E2E: panel form submit with dates (AC-1.11) (c2, testing) <- T-030
- [ ] T-032 Add E2E: summary above first carousel (AC-1.13) (c2, testing) <- T-030, T-018
- [ ] T-033 Add E2E: gallery swipe and lightbox (AC-1.16) (c2, testing) <- T-030, T-023

## Phase 2 (polish)

### HOS-2527
- [ ] T-034 Create ListingSectionTabs island (c3, core) <- T-005
- [ ] T-035 Add desktop price and Consultar to the section tabs (c2, core) <- T-034, T-004
- [ ] T-036 Wire ListingSectionTabs and section ids into the accommodation page (c2, integration) <- T-035

### HOS-2528
- [ ] T-037 Summarize AmenitiesGrid with pills and sheet dialog (c3, core) <- T-003, T-005
- [ ] T-038 Apply the summary treatment to FeaturesGrid (>6 items) (c2, core) <- T-037

### HOS-2529
- [ ] T-039 Clamp Description.astro with Leer mas toggle (c2, core) <- none
- [ ] T-040 Apply the clamp to the rich description on the accommodation page (c2, core) <- T-039

### HOS-2530
- [ ] T-041 Create HostSection.astro with panel button (c2, core) <- T-014, T-004
- [ ] T-042 Wire HostSection before the location section (c1, integration) <- T-041
- [ ] T-043 Add rating average and review cards track to ReviewPreview (c3, core) <- T-014
- [ ] T-044 Add "Ver las N resenas" opening ReviewsModal (c2, core) <- T-043

### HOS-2531
- [ ] T-045 Add dates/guests fields to the desktop sidebar card (c3, core) <- T-012, T-014
- [ ] T-046 Add "o contacta directo" row to the sidebar card (c2, core) <- T-045
- [ ] T-047 Add "Ver las N fotos" button to the gallery mosaic (c2, core) <- T-014

### HOS-2532
- [ ] T-048 Add experience price mapping and bar variant (c3, core) <- T-010, T-029
- [ ] T-049 Add channels-only panel variant for experience and venue (c3, core) <- T-011, T-029
- [ ] T-050 Wire bar, panel, gallery and compact header on experiencias/[slug].astro (c3, integration) <- T-048, T-049, T-023, T-024
- [ ] T-051 Wire bar, panel, gallery and compact header on comer-y-salir/[slug].astro (c3, integration) <- T-048, T-049, T-023, T-024
- [ ] T-052 Add guard test: no WhatsApp element on experience and venue pages (c1, testing) <- T-050, T-051

### HOS-2533
- [ ] T-053 Migrate ad-hoc detail CTA links to GradientButton/IconButton (c3, cleanup) <- T-018
- [ ] T-054 Reuse hero wave divider above after-content and align card/map tokens (c2, cleanup) <- T-015
