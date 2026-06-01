# SPEC-176 T-005 — Codemod Report

- Mode: **DRY-RUN (no source modified)**
- Generated: 2026-05-30T19:04:03.701Z
- Files scanned under `apps/web/src/`: 505
- Replacement rules (replaces + replacesVariants): 155

## Summary

- Current total `oklch(from` occurrences: **679**
- Matched (would-replace) occurrences: **658**
- Files that would change: **133**
- Unmatched occurrences: **21**
- Residual-after-apply estimate (total − matched): **21** (should equal unmatched = 21)
- Reconciles: **YES**

## Conflicts (CRITICAL if any)

None. No literal is claimed by more than one token.

## Top tokens by replacement frequency

| Rank | Token | Replacements |
|---|---|---|
| 1 | `--brand-primary-a20` | 45 |
| 2 | `--brand-primary-a15` | 39 |
| 3 | `--brand-accent-a30` | 38 |
| 4 | `--brand-primary-a05` | 33 |
| 5 | `--brand-primary-a10` | 31 |
| 6 | `--brand-primary-a30` | 25 |
| 7 | `--core-foreground-a05` | 25 |
| 8 | `--brand-primary-a08` | 21 |
| 9 | `--brand-primary-a25` | 19 |
| 10 | `--brand-primary-a12` | 17 |
| 11 | `--brand-accent-a15` | 17 |
| 12 | `--brand-accent-a20` | 16 |
| 13 | `--brand-accent-a12` | 16 |
| 14 | `--core-foreground-a08` | 14 |
| 15 | `--destructive-a10` | 13 |
| 16 | `--destructive-a25` | 12 |
| 17 | `--brand-accent-a05` | 11 |
| 18 | `--brand-accent-a08` | 10 |
| 19 | `--core-foreground-a15` | 7 |
| 20 | `--destructive-a08` | 7 |

## Per-token totals (all matched tokens)

| Token | Replacements |
|---|---|
| `--brand-primary-a20` | 45 |
| `--brand-primary-a15` | 39 |
| `--brand-accent-a30` | 38 |
| `--brand-primary-a05` | 33 |
| `--brand-primary-a10` | 31 |
| `--brand-primary-a30` | 25 |
| `--core-foreground-a05` | 25 |
| `--brand-primary-a08` | 21 |
| `--brand-primary-a25` | 19 |
| `--brand-primary-a12` | 17 |
| `--brand-accent-a15` | 17 |
| `--brand-accent-a20` | 16 |
| `--brand-accent-a12` | 16 |
| `--core-foreground-a08` | 14 |
| `--destructive-a10` | 13 |
| `--destructive-a25` | 12 |
| `--brand-accent-a05` | 11 |
| `--brand-accent-a08` | 10 |
| `--core-foreground-a15` | 7 |
| `--destructive-a08` | 7 |
| `--brand-accent-a25` | 7 |
| `--destructive-a15` | 7 |
| `--core-foreground-a20` | 7 |
| `--core-card-a90` | 7 |
| `--border-a60` | 7 |
| `--brand-accent-a40` | 6 |
| `--muted-l105` | 6 |
| `--core-foreground-a10` | 6 |
| `--brand-accent-a10` | 6 |
| `--core-muted-foreground-a15` | 6 |
| `--brand-accent-a50` | 5 |
| `--brand-primary-a35` | 5 |
| `--brand-primary-lm05` | 5 |
| `--brand-accent-lm05` | 5 |
| `--core-muted-foreground-a20` | 5 |
| `--destructive-a12` | 5 |
| `--border-a50` | 5 |
| `--brand-accent-a35` | 4 |
| `--brand-primary-l85` | 4 |
| `--success-a12` | 4 |
| `--brand-accent-lm04` | 3 |
| `--core-muted-foreground-a12` | 3 |
| `--destructive-a05` | 3 |
| `--core-foreground-a55` | 3 |
| `--core-card-a85` | 3 |
| `--border-a40` | 3 |
| `--core-muted-foreground-a08` | 3 |
| `--border-lm05` | 3 |
| `--core-card-a95` | 3 |
| `--brand-accent-a55` | 2 |
| `--destructive-a18` | 2 |
| `--warning-a10` | 2 |
| `--accent-foreground-a35` | 2 |
| `--brand-primary-a40` | 2 |
| `--core-card-l97` | 2 |
| `--warning-a12` | 2 |
| `--core-foreground-a90` | 2 |
| `--core-card-a55` | 2 |
| `--core-card-a50` | 2 |
| `--core-card-a70` | 2 |
| `--core-card-a100` | 2 |
| `--brand-primary-l90` | 2 |
| `--core-foreground-a12` | 2 |
| `--warning-a35` | 2 |
| `--primary-foreground-a75` | 2 |
| `--core-foreground-a25` | 2 |
| `--border-a80` | 2 |
| `--white-a75` | 2 |
| `--brand-accent-a80` | 2 |
| `--brand-primary-l115` | 2 |
| `--brand-accent-l82` | 2 |
| `--brand-accent-l112` | 2 |
| `--brand-primary-l80` | 2 |
| `--info-a08` | 1 |
| `--brand-primary-lm06` | 1 |
| `--core-muted-foreground-a85` | 1 |
| `--core-muted-foreground-a40` | 1 |
| `--core-muted-foreground-a25` | 1 |
| `--success-a15` | 1 |
| `--success-a30` | 1 |
| `--brand-accent-lm06` | 1 |
| `--core-foreground-a30` | 1 |
| `--core-foreground-a82` | 1 |
| `--core-foreground-a40` | 1 |
| `--core-card-a60` | 1 |
| `--core-card-a25` | 1 |
| `--core-card-a30` | 1 |
| `--destructive-lm04` | 1 |
| `--surface-dark-lp05` | 1 |
| `--core-foreground-a45` | 1 |
| `--surface-dark-a40` | 1 |
| `--brand-accent-a70` | 1 |
| `--core-card-a75` | 1 |
| `--core-foreground-a50` | 1 |
| `--core-muted-foreground-a30` | 1 |
| `--primary-foreground-a85` | 1 |
| `--core-foreground-a75` | 1 |
| `--primary-foreground-a30` | 1 |
| `--primary-foreground-a80` | 1 |
| `--core-card-lm03` | 1 |
| `--brand-accent-lm15` | 1 |
| `--destructive-l85` | 1 |
| `--destructive-a35` | 1 |
| `--destructive-a50` | 1 |
| `--destructive-a80` | 1 |
| `--destructive-a04` | 1 |
| `--core-muted-foreground-a50` | 1 |
| `--core-background-a70` | 1 |
| `--core-muted-foreground-a35` | 1 |
| `--core-muted-foreground-a60` | 1 |
| `--core-foreground-a72` | 1 |
| `--border-a30` | 1 |
| `--border-a35` | 1 |
| `--brand-primary-lp10` | 1 |
| `--core-foreground-l115` | 1 |
| `--info-a20` | 1 |
| `--footer-fg-a08` | 1 |
| `--footer-fg-a12` | 1 |
| `--footer-fg-a50` | 1 |
| `--brand-accent-a85` | 1 |
| `--hospeda-sky-a15` | 1 |
| `--brand-primary-lm12` | 1 |
| `--surface-dark-foreground-a75` | 1 |
| `--brand-accent-l90` | 1 |
| `--core-background-a40` | 1 |
| `--brand-primary-a45` | 1 |
| `--brand-accent-a45` | 1 |
| `--ring-a50` | 1 |

## Per-file breakdown (files that would change)

| File | Total | Tokens (token×count) |
|---|---|---|
| `apps/web/src/components/CategoryTiles.astro` | 3 | brand-primary-a08×1, brand-primary-a12×1, brand-accent-a15×1 |
| `apps/web/src/components/ContactForm.module.css` | 8 | brand-accent-lm04×1, core-foreground-a15×1, brand-primary-a20×1, brand-accent-a55×1, brand-accent-a20×1, brand-accent-a50×1, destructive-a18×1, destructive-a10×1 |
| `apps/web/src/components/EmptyState.astro` | 1 | brand-primary-a08×1 |
| `apps/web/src/components/ErrorBanner.astro` | 3 | destructive-a08×1, warning-a10×1, info-a08×1 |
| `apps/web/src/components/GlobalAnnouncements.astro` | 4 | brand-primary-a12×1, brand-primary-a35×1, brand-accent-a15×1, brand-accent-a40×1 |
| `apps/web/src/components/MapPlaceholder.astro` | 2 | brand-primary-lm06×1, brand-primary-a30×1 |
| `apps/web/src/components/TagChips.astro` | 2 | brand-primary-a25×1, brand-accent-a30×1 |
| `apps/web/src/components/accommodation/ContactHost.module.css` | 11 | brand-primary-lm05×1, brand-accent-lm05×1, brand-primary-a08×1, brand-primary-a15×1, brand-accent-a08×1, brand-accent-a25×1, brand-primary-a10×1, brand-primary-a30×1, destructive-a15×1, destructive-a08×1, destructive-a25×1 |
| `apps/web/src/components/accommodation/OwnerCard.astro` | 1 | brand-primary-a25×1 |
| `apps/web/src/components/accommodation/RelatedCarousel.astro` | 1 | brand-primary-a12×1 |
| `apps/web/src/components/accommodation/ReviewSidebarCard.module.css` | 12 | core-foreground-a05×2, core-muted-foreground-a85×1, core-muted-foreground-a40×1, brand-primary-a05×1, brand-primary-a08×1, brand-primary-a15×1, brand-accent-a08×1, brand-accent-a12×1, brand-accent-a25×1, brand-primary-a20×1, accent-foreground-a35×1 |
| `apps/web/src/components/account/AccountSectionCards.astro` | 2 | brand-primary-a10×1, brand-primary-a40×1 |
| `apps/web/src/components/account/AccountStatsGrid.astro` | 5 | core-foreground-a08×2, core-foreground-a05×1, brand-primary-a10×1, brand-primary-a30×1 |
| `apps/web/src/components/account/ConversationReply.module.css` | 6 | brand-accent-lm05×1, brand-primary-a15×1, brand-primary-a10×1, brand-primary-a30×1, destructive-a08×1, destructive-a25×1 |
| `apps/web/src/components/account/CreateEditCollectionModal.module.css` | 6 | brand-primary-a08×1, brand-primary-a15×1, brand-accent-a12×1, brand-accent-a35×1, brand-primary-a20×1, destructive-a15×1 |
| `apps/web/src/components/account/EditableNote.module.css` | 4 | brand-primary-a05×2, brand-primary-a15×1, brand-primary-a20×1 |
| `apps/web/src/components/account/MoveToCollectionModal.module.css` | 3 | brand-primary-a05×2, brand-primary-a10×1 |
| `apps/web/src/components/account/PreferenceToggles.module.css` | 3 | brand-primary-a15×1, destructive-a25×1, destructive-a10×1 |
| `apps/web/src/components/account/ProfileCompletion.module.css` | 9 | brand-primary-a15×2, brand-primary-a20×2, core-foreground-a08×1, brand-accent-a20×1, destructive-a15×1, destructive-a25×1, destructive-a10×1 |
| `apps/web/src/components/account/ProfileEditForm.module.css` | 12 | core-foreground-a05×3, core-foreground-a08×1, brand-primary-a12×1, brand-primary-a15×1, brand-primary-a20×1, brand-primary-a25×1, brand-primary-a10×1, destructive-a15×1, destructive-a25×1, destructive-a10×1 |
| `apps/web/src/components/account/SetPassword.module.css` | 5 | core-muted-foreground-a20×1, brand-primary-a15×1, destructive-a15×1, destructive-a25×1, destructive-a10×1 |
| `apps/web/src/components/account/SubscriptionDashboard.module.css` | 14 | destructive-a25×3, destructive-a12×2, core-muted-foreground-a12×1, core-muted-foreground-a25×1, brand-accent-a15×1, brand-accent-a30×1, brand-accent-a12×1, brand-accent-a25×1, destructive-a05×1, success-a15×1, success-a30×1 |
| `apps/web/src/components/account/UserFavoritesList.module.css` | 6 | destructive-a10×2, core-muted-foreground-a12×1, brand-primary-a08×1, brand-primary-a12×1, destructive-a25×1 |
| `apps/web/src/components/account/UserReviewsList.module.css` | 10 | brand-accent-a15×2, brand-accent-lm04×1, brand-primary-a05×1, brand-primary-a15×1, brand-primary-a20×1, brand-primary-a25×1, brand-accent-a30×1, destructive-a25×1, destructive-a10×1 |
| `apps/web/src/components/auth/AuthRequiredPopover.module.css` | 12 | brand-primary-a20×7, brand-primary-a05×3, brand-primary-a10×2 |
| `apps/web/src/components/auth/ForgotPassword.module.css` | 3 | brand-primary-l85×1, brand-primary-a15×1, destructive-a10×1 |
| `apps/web/src/components/auth/ResetPassword.module.css` | 3 | brand-primary-l85×1, brand-primary-a15×1, destructive-a10×1 |
| `apps/web/src/components/auth/SignIn.module.css` | 6 | muted-l105×3, core-card-l97×1, brand-primary-a15×1, destructive-a10×1 |
| `apps/web/src/components/auth/SignUp.module.css` | 6 | muted-l105×3, core-card-l97×1, brand-primary-a15×1, destructive-a10×1 |
| `apps/web/src/components/auth/VerifyEmail.module.css` | 1 | brand-primary-a20×1 |
| `apps/web/src/components/billing/CheckoutResult.astro` | 3 | destructive-a12×1, success-a12×1, warning-a12×1 |
| `apps/web/src/components/billing/PlanPurchaseButton.module.css` | 4 | success-a12×2, brand-accent-lm06×1, accent-foreground-a35×1 |
| `apps/web/src/components/billing/PricingCardsGrid.astro` | 1 | core-foreground-a15×1 |
| `apps/web/src/components/contact/ContactFAQ.astro` | 2 | brand-accent-a15×1, brand-primary-a10×1 |
| `apps/web/src/components/contact/ContactMiniMap.astro` | 1 | brand-primary-a10×1 |
| `apps/web/src/components/destination/DestinationDetailHeader.astro` | 2 | brand-primary-a25×1, brand-primary-a10×1 |
| `apps/web/src/components/destination/DestinationRelatedPosts.astro` | 1 | brand-primary-a05×1 |
| `apps/web/src/components/destination/DestinationSidebarCtas.astro` | 1 | brand-primary-a05×1 |
| `apps/web/src/components/event/EventDateFilterChips.astro` | 4 | brand-primary-a25×1, brand-accent-a12×1, brand-accent-a30×1, brand-accent-a40×1 |
| `apps/web/src/components/event/EventDetailOrganizerCard.astro` | 3 | core-foreground-a10×2, brand-primary-a10×1 |
| `apps/web/src/components/event/EventDetailPricingCard.astro` | 5 | brand-primary-a05×1, brand-accent-a08×1, brand-accent-a15×1, brand-accent-a25×1, brand-primary-a40×1 |
| `apps/web/src/components/legal/CookieConsentBanner.module.css` | 7 | core-foreground-a20×2, core-foreground-a05×1, core-foreground-a30×1, brand-accent-a30×1, brand-accent-a40×1, success-a12×1 |
| `apps/web/src/components/maps/ListingMap.module.css` | 1 | brand-accent-a40×1 |
| `apps/web/src/components/maps/MapCardsSidebar.module.css` | 4 | core-foreground-a55×1, core-foreground-a82×1, core-foreground-a90×1, core-foreground-a40×1 |
| `apps/web/src/components/marketing/MarketingHero.astro` | 2 | brand-primary-a15×1, brand-accent-a08×1 |
| `apps/web/src/components/newsletter/NewsletterContentTypeToggles.module.css` | 3 | brand-primary-a05×1, brand-primary-a15×1, core-card-a60×1 |
| `apps/web/src/components/newsletter/NewsletterForm.module.css` | 12 | core-card-a50×2, brand-accent-lm05×1, core-foreground-a08×1, brand-primary-a12×1, brand-primary-a25×1, brand-accent-a30×1, destructive-a15×1, core-card-a25×1, core-card-a55×1, core-card-a30×1, core-card-a70×1 |
| `apps/web/src/components/newsletter/NewsletterPreferences.module.css` | 7 | brand-primary-a15×2, core-muted-foreground-a12×1, brand-accent-lm04×1, destructive-lm04×1, brand-primary-a08×1, brand-accent-a30×1 |
| `apps/web/src/components/post/PostAuthorCard.astro` | 1 | brand-primary-a15×1 |
| `apps/web/src/components/post/PostContent.astro` | 1 | brand-accent-a05×1 |
| `apps/web/src/components/post/PostDetailHeader.astro` | 1 | brand-primary-a12×1 |
| `apps/web/src/components/post/PostRelatedEntityCard.astro` | 1 | brand-primary-a05×1 |
| `apps/web/src/components/post/PostSponsorshipBanner.astro` | 2 | brand-accent-a05×1, brand-accent-a25×1 |
| `apps/web/src/components/post/PostTableOfContents.astro` | 2 | brand-primary-a05×1, brand-primary-a08×1 |
| `apps/web/src/components/search/SearchResultsLive.module.css` | 1 | brand-primary-a15×1 |
| `apps/web/src/components/sections/AnimatedCounter.module.css` | 2 | brand-accent-a10×2 |
| `apps/web/src/components/sections/CtaOwnersSection.astro` | 1 | brand-primary-a15×1 |
| `apps/web/src/components/sections/DestinationsIsland.module.css` | 3 | surface-dark-lp05×1, core-foreground-a45×1, surface-dark-a40×1 |
| `apps/web/src/components/sections/DestinationsMap.module.css` | 15 | brand-accent-a30×4, core-card-a90×4, core-card-a100×2, core-foreground-a20×1, brand-accent-a12×1, brand-accent-a55×1, brand-accent-a10×1, brand-accent-a70×1 |
| `apps/web/src/components/sections/HeroSection.astro` | 3 | core-foreground-a08×1, core-card-a55×1, core-card-a75×1 |
| `apps/web/src/components/sections/SearchBar.astro` | 1 | brand-primary-l90×1 |
| `apps/web/src/components/sections/SearchBar.module.css` | 12 | brand-primary-a08×3, core-foreground-a05×2, brand-primary-a05×2, brand-primary-l90×1, core-foreground-a12×1, core-foreground-a10×1, core-foreground-a50×1, brand-primary-a12×1 |
| `apps/web/src/components/sections/StatsSection.astro` | 1 | core-muted-foreground-a30×1 |
| `apps/web/src/components/shared/StatusPage.astro` | 30 | brand-primary-a20×6, brand-accent-a30×6, brand-primary-a30×4, brand-primary-a05×3, brand-primary-a12×3, brand-primary-a15×3, brand-accent-a20×3, brand-accent-a05×1, brand-accent-a12×1 |
| `apps/web/src/components/shared/cards/AccommodationCard.astro` | 2 | core-foreground-a55×1, core-card-a85×1 |
| `apps/web/src/components/shared/cards/ArticleCard.astro` | 2 | warning-a12×1, warning-a35×1 |
| `apps/web/src/components/shared/cards/DestinationCard.astro` | 8 | primary-foreground-a75×1, primary-foreground-a85×1, core-foreground-a55×1, core-foreground-a75×1, brand-primary-a08×1, brand-primary-a12×1, brand-primary-a25×1, brand-accent-a12×1 |
| `apps/web/src/components/shared/cards/DestinationRating.astro` | 1 | primary-foreground-a75×1 |
| `apps/web/src/components/shared/cards/EventCardFeatured.astro` | 1 | brand-primary-a10×1 |
| `apps/web/src/components/shared/cards/EventCardHorizontal.astro` | 7 | brand-primary-lm05×1, primary-foreground-a30×1, primary-foreground-a80×1, core-foreground-a05×1, core-card-lm03×1, brand-primary-a15×1, brand-primary-a10×1 |
| `apps/web/src/components/shared/cards/ReviewCard.module.css` | 5 | brand-accent-lm15×1, core-foreground-a05×1, core-foreground-a08×1, brand-primary-a12×1, brand-accent-a15×1 |
| `apps/web/src/components/shared/favorite/FavoriteButton.module.css` | 7 | destructive-l85×1, destructive-a08×1, destructive-a12×1, destructive-a35×1, destructive-a50×1, destructive-a80×1, core-card-a90×1 |
| `apps/web/src/components/shared/favorite/collection-picker-popover.css` | 14 | brand-primary-a20×7, brand-primary-a05×2, core-foreground-a15×1, core-foreground-a25×1, core-foreground-a10×1, brand-primary-a08×1, brand-primary-a10×1 |
| `apps/web/src/components/shared/feedback/EmptyState.astro` | 6 | brand-primary-a08×1, brand-accent-a05×1, brand-accent-a20×1, brand-accent-a10×1, brand-accent-a30×1, brand-accent-a50×1 |
| `apps/web/src/components/shared/feedback/ErrorBanner.astro` | 5 | destructive-a05×2, destructive-a08×1, destructive-a12×1, destructive-a04×1 |
| `apps/web/src/components/shared/feedback/Pagination.astro` | 1 | core-muted-foreground-a50×1 |
| `apps/web/src/components/shared/feedback/PaginationLoading.client.tsx` | 2 | brand-primary-a25×1, core-background-a70×1 |
| `apps/web/src/components/shared/filters/FilterSidebar.module.css` | 11 | border-a50×2, core-muted-foreground-a35×1, core-muted-foreground-a20×1, core-foreground-a05×1, brand-accent-a10×1, brand-accent-a20×1, brand-accent-a30×1, brand-accent-a50×1, core-card-a85×1, border-a40×1 |
| `apps/web/src/components/shared/filters/components/FilterGroup.module.css` | 6 | brand-accent-a05×1, brand-accent-a20×1, brand-accent-a10×1, brand-accent-a30×1, brand-accent-a50×1, border-a40×1 |
| `apps/web/src/components/shared/filters/components/SectionHeader.module.css` | 1 | brand-primary-a35×1 |
| `apps/web/src/components/shared/filters/components/SortPopover.module.css` | 4 | brand-primary-a05×2, brand-primary-a30×1, border-a50×1 |
| `apps/web/src/components/shared/filters/filter-types/DateRangeFilter.module.css` | 5 | core-foreground-a08×1, core-foreground-a20×1, brand-primary-a05×1, brand-primary-a08×1, brand-primary-a10×1 |
| `apps/web/src/components/shared/filters/filter-types/DualRangeFilter.module.css` | 4 | core-muted-foreground-a60×1, core-foreground-a12×1, brand-primary-a25×1, brand-accent-a35×1 |
| `apps/web/src/components/shared/filters/filter-types/FilterGroupContent.module.css` | 13 | brand-primary-a10×3, core-foreground-a05×1, brand-primary-a05×1, brand-primary-a15×1, brand-primary-a25×1, brand-primary-a35×1, brand-accent-a25×1, brand-primary-a20×1, brand-accent-a50×1, border-a40×1, border-a60×1 |
| `apps/web/src/components/shared/filters/filter-types/GeoRadiusFilter.module.css` | 6 | core-foreground-a20×2, core-foreground-a72×1, brand-primary-a20×1, brand-accent-a08×1, brand-accent-a15×1 |
| `apps/web/src/components/shared/filters/filter-types/IconChipsFilter.module.css` | 14 | brand-primary-a05×2, brand-primary-a10×2, border-a60×2, core-foreground-a05×1, brand-primary-a15×1, brand-primary-a25×1, brand-primary-a35×1, brand-primary-a20×1, brand-primary-a30×1, border-a30×1, border-a50×1 |
| `apps/web/src/components/shared/filters/filter-types/PriceCompositeFilter.module.css` | 1 | core-foreground-a08×1 |
| `apps/web/src/components/shared/filters/filter-types/SelectSearchFilter.module.css` | 6 | core-muted-foreground-a15×1, brand-primary-a08×1, brand-primary-a12×1, brand-primary-a15×1, brand-primary-a20×1, brand-primary-a10×1 |
| `apps/web/src/components/shared/filters/filter-types/StarsFilter.module.css` | 2 | brand-accent-a05×1, border-a80×1 |
| `apps/web/src/components/shared/filters/filter-types/StepperFilter.module.css` | 2 | brand-accent-a05×1, brand-accent-a12×1 |
| `apps/web/src/components/shared/filters/filter-types/ToggleFilter.module.css` | 1 | border-a80×1 |
| `apps/web/src/components/shared/navigation/MobileMenu.module.css` | 10 | border-a60×4, core-foreground-a05×2, core-foreground-a08×1, destructive-a08×1, border-a35×1, border-a50×1 |
| `apps/web/src/components/shared/navigation/SettingsDropdown.module.css` | 3 | brand-primary-lm05×1, core-foreground-a05×1, core-foreground-a15×1 |
| `apps/web/src/components/shared/navigation/UserMenu.module.css` | 4 | core-foreground-a05×2, brand-primary-lm05×1, core-foreground-a15×1 |
| `apps/web/src/components/shared/preferences/LanguageSwitcher.module.css` | 1 | core-foreground-a05×1 |
| `apps/web/src/components/shared/preferences/ThemeControl.module.css` | 1 | core-foreground-a05×1 |
| `apps/web/src/components/shared/ui/AccommodationTypeBadge.astro` | 1 | brand-primary-lp10×1 |
| `apps/web/src/components/shared/ui/Badge.module.css` | 1 | core-foreground-l115×1 |
| `apps/web/src/components/shared/ui/badge.types.ts` | 2 | brand-accent-a15×1, brand-accent-a30×1 |
| `apps/web/src/components/shared/ui/badge.utils.ts` | 2 | core-muted-foreground-a08×1, core-muted-foreground-a15×1 |
| `apps/web/src/components/skeletons/EventCardHorizontalSkeleton.astro` | 4 | border-lm05×3, brand-primary-a15×1 |
| `apps/web/src/components/skeletons/NextEventsSectionSkeleton.astro` | 1 | core-foreground-a08×1 |
| `apps/web/src/components/ui/PasswordField.module.css` | 3 | core-muted-foreground-a20×1, brand-primary-a15×1, destructive-a15×1 |
| `apps/web/src/components/ui/ToastViewport.module.css` | 6 | core-foreground-a10×2, core-foreground-a05×1, core-foreground-a15×1, core-foreground-a25×1, info-a20×1 |
| `apps/web/src/layouts/AccountLayout.astro` | 5 | core-foreground-a05×2, core-foreground-a08×1, brand-primary-a05×1, brand-accent-a12×1 |
| `apps/web/src/layouts/BetaDocLayout.astro` | 4 | brand-primary-a35×1, brand-accent-a12×1, brand-primary-a10×1, brand-accent-a40×1 |
| `apps/web/src/layouts/Footer.astro` | 3 | footer-fg-a08×1, footer-fg-a12×1, footer-fg-a50×1 |
| `apps/web/src/layouts/Header.astro` | 3 | core-card-a85×1, core-card-a95×1, core-card-a70×1 |
| `apps/web/src/lib/colors.ts` | 13 | brand-accent-a15×3, core-muted-foreground-a08×2, core-muted-foreground-a20×2, brand-accent-a30×2, brand-primary-a15×1, brand-primary-a30×1, brand-accent-a85×1, hospeda-sky-a15×1 |
| `apps/web/src/pages/404.astro` | 1 | brand-primary-a05×1 |
| `apps/web/src/pages/[lang]/alojamientos/mapa.astro` | 1 | core-card-a90×1 |
| `apps/web/src/pages/[lang]/auth/forgot-password.astro` | 4 | brand-primary-a15×1, brand-primary-a25×1, brand-accent-a05×1, brand-accent-a30×1 |
| `apps/web/src/pages/[lang]/auth/reset-password.astro` | 2 | brand-primary-a15×1, brand-primary-a25×1 |
| `apps/web/src/pages/[lang]/auth/signin.astro` | 5 | brand-primary-l85×1, brand-primary-a15×1, brand-primary-a30×1, brand-accent-a05×1, brand-accent-a30×1 |
| `apps/web/src/pages/[lang]/auth/signup.astro` | 6 | brand-primary-l85×1, brand-primary-a05×1, brand-primary-a30×1, brand-accent-a15×1, brand-accent-a25×1, brand-accent-a30×1 |
| `apps/web/src/pages/[lang]/auth/verify-email.astro` | 4 | brand-primary-a20×1, brand-primary-a30×1, brand-accent-a08×1, brand-accent-a30×1 |
| `apps/web/src/pages/[lang]/beneficios/index.astro` | 10 | brand-primary-a30×2, brand-accent-a20×2, brand-accent-a30×2, brand-primary-a12×1, brand-primary-a20×1, brand-primary-a25×1, brand-accent-a12×1 |
| `apps/web/src/pages/[lang]/contacto/index.astro` | 7 | brand-primary-a20×2, brand-primary-a10×2, brand-primary-a08×1, brand-accent-a08×1, brand-accent-a12×1 |
| `apps/web/src/pages/[lang]/destinos/index.astro` | 2 | brand-primary-a12×1, brand-accent-a12×1 |
| `apps/web/src/pages/[lang]/guest/messages/[token].astro` | 1 | white-a75×1 |
| `apps/web/src/pages/[lang]/guest/messages/request-access.astro` | 6 | brand-accent-lm05×1, brand-primary-a15×1, brand-primary-a10×1, brand-primary-a30×1, destructive-a08×1, destructive-a25×1 |
| `apps/web/src/pages/[lang]/guest/messages/verify-expired.astro` | 1 | brand-accent-lm05×1 |
| `apps/web/src/pages/[lang]/mi-cuenta/consultas/[conversationId].astro` | 1 | white-a75×1 |
| `apps/web/src/pages/[lang]/mi-cuenta/favoritos/index.astro` | 1 | core-muted-foreground-a15×1 |
| `apps/web/src/pages/[lang]/mi-cuenta/index.astro` | 10 | brand-primary-a20×2, brand-primary-a25×2, brand-primary-lm12×1, core-foreground-a08×1, brand-primary-a05×1, brand-accent-a05×1, brand-accent-a20×1, brand-primary-a30×1 |
| `apps/web/src/pages/[lang]/nosotros/index.astro` | 10 | brand-primary-a30×2, brand-accent-a30×2, brand-primary-a08×1, brand-primary-a15×1, brand-primary-a20×1, brand-primary-a25×1, brand-accent-a08×1, brand-accent-a20×1 |
| `apps/web/src/pages/[lang]/preguntas-frecuentes/index.astro` | 17 | brand-primary-a08×2, brand-primary-a30×2, brand-accent-a20×2, brand-primary-a10×2, brand-accent-a30×2, brand-primary-lm05×1, core-foreground-a08×1, brand-primary-a15×1, brand-accent-a05×1, brand-accent-a12×1, brand-accent-a15×1, core-card-a90×1 |
| `apps/web/src/pages/[lang]/publicaciones/[slug].astro` | 2 | warning-a35×1, warning-a10×1 |
| `apps/web/src/pages/[lang]/publicar/index.astro` | 10 | brand-primary-a20×2, core-foreground-a05×1, core-foreground-a20×1, brand-accent-a08×1, brand-accent-a12×1, brand-accent-a15×1, brand-accent-a35×1, brand-primary-a10×1, brand-accent-a80×1 |
| `apps/web/src/pages/[lang]/publicar/nueva.astro` | 4 | brand-primary-a20×1, brand-accent-a08×1, brand-accent-a12×1, brand-accent-a30×1 |
| `apps/web/src/pages/[lang]/suscriptores/propietarios/index.astro` | 10 | brand-accent-a20×2, surface-dark-foreground-a75×1, brand-primary-a12×1, brand-primary-a25×1, brand-primary-a10×1, brand-primary-a20×1, brand-primary-a30×1, brand-accent-a30×1, brand-accent-a80×1 |
| `apps/web/src/styles/components.css` | 34 | core-muted-foreground-a15×3, brand-accent-a30×3, brand-primary-l115×2, brand-accent-l82×2, brand-accent-l112×2, brand-primary-l80×2, brand-primary-a30×2, core-card-a95×2, brand-accent-l90×1, core-foreground-a15×1, core-foreground-a90×1, core-background-a40×1, brand-primary-a05×1, brand-primary-a08×1, brand-primary-a15×1, brand-primary-a20×1, brand-primary-a45×1, brand-accent-a15×1, brand-accent-a35×1, brand-accent-a40×1, brand-accent-a45×1, brand-primary-a10×1, destructive-a18×1, destructive-a10×1 |
| `apps/web/src/styles/global.css` | 1 | ring-a50×1 |

## Unmatched occurrences (residual after apply)

### Category counts

| Category | Count |
|---|---|
| var-fallback-no-base | 6 |
| var-fallback-alpha-gap | 0 |
| var-fallback-lightness-gap | 0 |
| var-with-fallback | 0 |
| dynamic-template-literal | 8 |
| oklch-from-white | 1 |
| alpha-zero | 3 |
| other | 3 |

### Full list (file:line — snippet)

#### var-fallback-no-base (6)

- `apps/web/src/components/ShareButtons.module.css:146` — `oklch(from var(--primary, oklch(0.55 0.17 264)) l c h / 0.1)` — **GAP**: base --primary has no variant tokens (not a gated base)
- `apps/web/src/components/account/SubscriptionDashboard.module.css:88` — `oklch(from var(--primary, oklch(0.5 0.18 260)) l c h / 0.12)` — **GAP**: base --primary has no variant tokens (not a gated base)
- `apps/web/src/components/account/SubscriptionDashboard.module.css:90` — `oklch(from var(--primary, oklch(0.5 0.18 260)) l c h / 0.25)` — **GAP**: base --primary has no variant tokens (not a gated base)
- `apps/web/src/components/shared/cards/EventCardFeatured.astro:295` — `oklch(from var(--event-cat-bg, var(--brand-primary)) l c h / 0.15)` — **GAP**: base --event-cat-bg has no variant tokens (not a gated base)
- `apps/web/src/components/shared/cards/EventCardFeatured.astro:296` — `oklch(from var(--event-cat-bg, var(--brand-primary)) l c h / 0.3)` — **GAP**: base --event-cat-bg has no variant tokens (not a gated base)
- `apps/web/src/components/shared/cards/EventCardFeatured.astro:356` — `oklch(from var(--event-cat-bg, var(--brand-primary)) l c h / 0.85)` — **GAP**: base --event-cat-bg has no variant tokens (not a gated base)

#### dynamic-template-literal (8)

- `apps/web/src/components/account/CollectionCard.tsx:61` — `oklch(from ${color} l c h / 0.15)`,`
- `apps/web/src/components/account/CollectionCard.tsx:62` — `oklch(from ${color} l c h / 0.30)``
- `apps/web/src/components/account/CollectionCard.tsx:104` — `oklch(from ${color} l c h / 0.12)`,`
- `apps/web/src/lib/colors.ts:72` — `oklch(from var(--${cssToken}) l c h / ${bgOpacity})`,`
- `apps/web/src/lib/colors.ts:74` — `oklch(from var(--${cssToken}) l c h / ${borderOpacity})``
- `apps/web/src/lib/colors.ts:98` — `oklch(from var(--${cssToken}) ${clampedL} c h)`,`
- `apps/web/src/lib/colors.ts:100` — `oklch(from var(--${cssToken}) calc(${clampedL} * 0.7) c h)``
- `apps/web/src/pages/500.astro:54` — `oklch(from ${destructiveColor} l c h / 0.06)`} />`

#### oklch-from-white (1)

- `apps/web/src/styles/components.css:539` — `oklch(from white l c h / 0.95)) {`

#### alpha-zero (3)

- `apps/web/src/components/shared/cards/DestinationCard.astro:296` — `oklch(from var(--core-foreground) l c h / 0) 30%,`
- `apps/web/src/components/shared/cards/DestinationCard.astro:306` — `oklch(from var(--core-foreground) l c h / 0) 20%,`
- `apps/web/src/styles/components.css:287` — `oklch(from currentColor l c h / 0);`

#### other (3)

- `apps/web/src/components/GlobalAnnouncements.astro:130` — `oklch(from #ef4444 l c h / 0.14);`
- `apps/web/src/components/GlobalAnnouncements.astro:131` — `oklch(from #ef4444 l c h / 0.5);`
- `apps/web/src/styles/css-var-themes.css:25` — `oklch(from ... l c h / N)`)`
