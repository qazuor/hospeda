# Public Route Audit — SPEC-210: Response-Schema Tier Enforcement

**Audited:** 2026-06-22  
**Auditor:** SPEC-210 T-001 automated audit  
**Scope:** All HTTP routes registered under `apps/api/src/routes/**/public/**/*.ts`

---

## Summary

| Classification | Count | % of Total |
|---|---|---|
| **OK** | 72 | 72% |
| **LEAK** | 10 | 10% |
| **PASSTHROUGH** | 1 | 1% |
| **MISSING** | 5 | 5% |
| **BORDERLINE** (owner decision needed) | 12 | 12% |
| **Total routes** | **100** | 100% |

> **PASSTHROUGH** = `z.record`, `z.any`, `z.unknown`, or `.passthrough()` object. Strips nothing.  
> **LEAK** = full entity schema (`*Schema` without `Public` in name) that includes `BaseAuditFields` (`createdById`, `updatedById`, `deletedAt`, `deletedById`) or admin-only fields (`adminInfo`, `moderationState`, `translationMeta`, `adminNote`, `status` workflow, `lastWarnedAt`).  
> **MISSING** = raw `createRouter()` with manual `createResponse()` calls and no `responseSchema` argument passed.  
> **BORDERLINE** = a handcrafted or query `.pick()` schema that excludes the worst audit fields but still exposes lifecycle/timestamp fields not present in the canonical `*PublicSchema`. Needs owner decision.

---

## Route Classification Table

| Route file | Method + Path | Entity | Response schema wired | Classification | Offending columns | PublicSchema exists? | Notes |
|---|---|---|---|---|---|---|---|
| `accommodation/public/list.ts` | GET `/` | Accommodation | `AccommodationPublicSchema` | **OK** | — | Yes | |
| `accommodation/public/getById.ts` | GET `/{id}` | Accommodation | `AccommodationPublicSchema.nullable()` | **OK** | — | Yes | |
| `accommodation/public/getBySlug.ts` | GET `/slug/{slug}` | Accommodation | `AccommodationPublicSchema.nullable()` | **OK** | — | Yes | |
| `accommodation/public/getStats.ts` | GET `/{id}/stats` | Accommodation (stats) | `AccommodationStatsSchema.nullable()` | **OK** | — | N/A — dedicated stats shape, no audit fields | Standalone `z.object` with totals only |
| `accommodation/public/getSummary.ts` | GET `/{id}/summary` | Accommodation | `AccommodationSummarySchema.nullable()` | **BORDERLINE** | `ownerId`, `createdAt`, `updatedAt` beyond `AccommodationPublicSchema`; no `createdById`/`deletedAt` | No `AccommodationSummaryPublicSchema` | See owner decisions §1 |
| `accommodation/public/getByDestination.ts` | GET `/destination/{destinationId}` | Accommodation | `AccommodationListWrapperSchema` | **LEAK** | `createdById`, `updatedById`, `deletedAt`, `deletedById`, `adminInfo`, `moderationState`, `lastWarnedAt`, `translationMeta` | Yes (`AccommodationPublicSchema`) | Wrapper contains `z.array(AccommodationSchema)` — full entity, not Public |
| `accommodation/public/getTopRatedByDestination.ts` | GET `/destination/{destinationId}/top-rated` | Accommodation | `AccommodationTopRatedOutputSchema` | **LEAK** | Same as above | Yes (`AccommodationPublicSchema`) | `AccommodationTopRatedOutputSchema = AccommodationSearchResultSchema = PaginationResultSchema(AccommodationSchema)` |
| `accommodation/public/similar.ts` | GET `/{id}/similar` | Accommodation | `z.array(z.record(z.string(), z.unknown()))` | **PASSTHROUGH** | All fields (but handler does manual data-level strip of most internal cols) | Yes (`AccommodationPublicSchema`) | Data-level strip in handler mitigates partially; schema still passes unknown keys |
| `accommodation/reviews/public/list.ts` | GET `/{accommodationId}/reviews` | AccommodationReview | `AccommodationReviewPublicSchema.omit({user,accommodation}).extend({user:{name,image}})` | **OK** | — | Yes (`AccommodationReviewPublicSchema`) | Local narrowing schema based on PublicSchema |
| `accommodation-external-reputation/public/get-external-reputation.ts` | GET `/{id}/external-reputation` | ExternalReputation | `ExternalReputationBlockSchema` | **OK** | — | N/A — dedicated public-only block schema | All fields in `ExternalReputationBlockSchema` are public-safe |
| `amenity/public/getById.ts` | GET `/{id}` | Amenity | `AmenityPublicSchema.nullable()` | **OK** | — | Yes | |
| `amenity/public/list.ts` | GET `/` | Amenity | `AmenityPublicSchema` | **OK** | — | Yes | |
| `attraction/public/getById.ts` | GET `/{id}` | Attraction | `AttractionPublicSchema.nullable()` | **OK** | — | Yes | |
| `attraction/public/getBySlug.ts` | GET `/slug/{slug}` | Attraction | `AttractionPublicSchema.nullable()` | **OK** | — | Yes | |
| `attraction/public/list.ts` | GET `/` | Attraction | `AttractionPublicSchema` | **OK** | — | Yes | |
| `billing/public/listPlans.ts` | GET `/` | BillingPlan | `PlansListResponseSchema` (local `z.array(PlanPublicSchema)`) | **OK** | — | N/A — inline public projection; no audit/internal fields | Locally defined `PlanPublicSchema` with explicit field list |
| `commerce/public/create-lead.ts` | POST `/` | CommerceLead | `CommerceLeadSchema.partial()` | **LEAK** | `adminNote`, `status` (workflow), `createdById`, `updatedById`, `deletedAt`, `deletedById` | No `CommerceLeadPublicSchema` | Full entity schema returned on create; admin workflow fields exposed |
| `conversations/public/guest-reply.ts` | POST `/:token/messages` | Conversation message | None — raw `createResponse(messageResult.data, c, 201)` | **MISSING** | All fields of whatever `messageResult.data` contains | No public schema | Custom router bypasses factory entirely |
| `conversations/public/guest-thread.ts` | GET `/:token` | Conversation + messages | None — raw `createResponse({conversation, messages, hasMore}, c, 200)` | **MISSING** | All fields of conversation and messages service output | No public schema | Custom router bypasses factory entirely |
| `conversations/public/initiate.ts` | POST `/` | Conversation (initiation) | None — raw `createResponse({status, conversationId}, c, 200)` | **MISSING** | Minimal: `{status, conversationId}` only — low risk | N/A — shape is narrow | Custom router; shape is manually narrow (low risk but still unprotected) |
| `conversations/public/request-access.ts` | POST `/` | — | None — raw `createResponse({status:'sent_if_exists'}, c, 200)` | **MISSING** | Minimal — low risk | N/A | Custom router; effectively a boolean response |
| `conversations/public/verify.ts` | GET `/:verificationToken` | — | None — redirect only (no response body on success) | **MISSING** | None on success (302 redirect); error returns `createErrorResponse` | N/A | Redirect endpoint; body exposure is not a concern |
| `destination/public/list.ts` | GET `/` | Destination | `DestinationPublicSchema` | **OK** | — | Yes | |
| `destination/public/getById.ts` | GET `/{id}` | Destination | `DestinationPublicSchema.nullable()` | **OK** | — | Yes | |
| `destination/public/getBySlug.ts` | GET `/slug/{slug}` | Destination | `DestinationPublicSchema.nullable()` | **OK** | — | Yes | |
| `destination/public/getByPath.ts` | GET `/by-path` | Destination | `DestinationPublicSchema.nullable()` | **OK** | — | Yes | |
| `destination/public/getAccommodations.ts` | GET `/{id}/accommodations` | Accommodation | `z.array(AccommodationPublicSchema)` | **OK** | — | Yes | Wraps in `z.array` correctly |
| `destination/public/getAncestors.ts` | GET `/{id}/ancestors` | Destination | `z.object({ancestors: z.array(DestinationPublicSchema)})` | **OK** | — | Yes | |
| `destination/public/getBreadcrumb.ts` | GET `/{id}/breadcrumb` | Destination (breadcrumb) | `z.object({breadcrumb: BreadcrumbResponseSchema})` | **OK** | — | N/A — `BreadcrumbResponseSchema` is a dedicated hierarchy shape (id, name, slug, level) | |
| `destination/public/getChildren.ts` | GET `/{id}/children` | Destination | `z.object({children: z.array(DestinationPublicSchema)})` | **OK** | — | Yes | |
| `destination/public/getDescendants.ts` | GET `/{id}/descendants` | Destination | `z.object({descendants: z.array(DestinationPublicSchema)})` | **OK** | — | Yes | |
| `destination/public/getStats.ts` | GET `/{id}/stats` | Destination (stats) | `DestinationStatsSchema` | **OK** | — | N/A — standalone stats shape | |
| `destination/public/getSummary.ts` | GET `/{id}/summary` | Destination | `DestinationSummarySchema.nullable()` | **BORDERLINE** | `accommodationsCount`, `path`, `level` — not in `DestinationPublicSchema`; no audit fields | No `DestinationSummaryPublicSchema` | See owner decisions §2 |
| `destination/public/getWeather.ts` | GET `/{id}/weather` | Destination (weather) | `DestinationWeatherCacheSchema.nullable()` | **OK** | — | N/A — dedicated weather cache schema; no audit fields | |
| `destination/reviews/public/list.ts` | GET `/{destinationId}/reviews` | DestinationReview | Local `PublicReviewWithUserSchema` (picks from `DestinationReviewPublicSchema`) | **OK** | — | Yes (`DestinationReviewPublicSchema`) | Local narrowing built from PublicSchema |
| `event-location/public/getById.ts` | GET `/{id}` | EventLocation | `EventLocationPublicSchema.nullable()` | **OK** | — | Yes | |
| `event-location/public/getBySlug.ts` | GET `/slug/{slug}` | EventLocation | `EventLocationPublicSchema.nullable()` | **OK** | — | Yes | |
| `event-location/public/list.ts` | GET `/` | EventLocation | `EventLocationPublicSchema` | **OK** | — | Yes | |
| `event-organizer/public/getById.ts` | GET `/{id}` | EventOrganizer | `EventOrganizerPublicSchema.nullable()` | **OK** | — | Yes | |
| `event-organizer/public/getBySlug.ts` | GET `/slug/{slug}` | EventOrganizer | `EventOrganizerPublicSchema.nullable()` | **OK** | — | Yes | |
| `event-organizer/public/list.ts` | GET `/` | EventOrganizer | `EventOrganizerPublicSchema` | **OK** | — | Yes | |
| `event/public/list.ts` | GET `/` | Event | `EventPublicSchema` | **OK** | — | Yes | |
| `event/public/getById.ts` | GET `/{id}` | Event | `EventPublicSchema.nullable()` | **OK** | — | Yes | |
| `event/public/getBySlug.ts` | GET `/slug/{slug}` | Event | `EventPublicSchema.nullable()` | **OK** | — | Yes | |
| `event/public/getByAuthor.ts` | GET `/author/{authorId}` | Event | `EventPublicSchema` | **OK** | — | Yes | |
| `event/public/getByLocation.ts` | GET `/location/{locationId}` | Event | `EventPublicSchema` | **OK** | — | Yes | |
| `event/public/getByOrganizer.ts` | GET `/organizer/{organizerId}` | Event | `EventPublicSchema` | **OK** | — | Yes | |
| `event/public/getSummary.ts` | GET `/{id}/summary` | Event | `EventSummarySchema.nullable()` | **OK** | — | N/A — standalone `z.object`; no audit fields | |
| `event/public/getUpcoming.ts` | GET `/upcoming` | Event | `EventPublicSchema` | **OK** | — | Yes | |
| `event/comments/public/list.ts` | GET `/{eventId}/comments` | EntityComment | `EntityCommentPublicItemSchema` | **OK** | — | Yes (`EntityCommentPublicItemSchema` from access schema) | |
| `exchange-rates/public/convert.ts` | GET `/convert` | ExchangeRate | `ExchangeRateConvertOutputSchema` | **OK** | — | N/A — dedicated conversion output schema | |
| `exchange-rates/public/list.ts` | GET `/` | ExchangeRate | `ExchangeRateSchema` | **LEAK** | `source`, `isManualOverride`, `expiresAt`, `createdAt`, `updatedAt` | Yes (`ExchangeRatePublicSchema` exists and excludes `source`, `isManualOverride`, `expiresAt`) | `ExchangeRatePublicSchema` exists in `exchange-rate.access.schema.ts`; route uses the full base schema |
| `experience/public/list.ts` | GET `/` | Experience | `ExperiencePublicSchema` | **OK** | — | Yes | |
| `experience/public/getById.ts` | GET `/{id}` | Experience | `ExperiencePublicSchema.nullable()` | **OK** | — | Yes | |
| `experience/public/getBySlug.ts` | GET `/slug/{slug}` | Experience | `ExperiencePublicSchema.nullable()` | **OK** | — | Yes | |
| `experience/public/getByDestination.ts` | GET `/destination/{destinationId}` | Experience | `ExperiencePublicSchema` | **OK** | — | Yes | |
| `experience/public/getFaqs.ts` | GET `/{experienceId}/faqs` | ExperienceFaq | `ExperienceFaqListOutputSchema` | **LEAK** | `createdAt`, `updatedAt`, `createdById`, `updatedById`, `deletedAt`, `deletedById`, `lifecycleState` | No `ExperienceFaqPublicSchema` | `ExperienceFaqSchema extends BaseFaqSchema` which spreads `BaseAuditFields` and `BaseLifecycleFields` |
| `experience/public/getReviews.ts` | GET `/{experienceId}/reviews` | ExperienceReview | Local `ExperienceReviewPublicSchema` (`.pick({id,experienceId,userId,title,content,rating,averageRating,overallRating,reviewerName,createdAt,updatedAt})`) | **OK** | — | No canonical `ExperienceReviewPublicSchema` in `@repo/schemas` | Local pick is safe; no `createdById`/`deletedAt`/admin fields |
| `feature/public/list.ts` | GET `/` | Feature | `FeatureListItemSchema` | **BORDERLINE** | `lifecycleState`, `createdAt`, `updatedAt` not in `FeaturePublicSchema` | Yes (`FeaturePublicSchema` exists, narrower) | See owner decisions §3 |
| `feature/public/search.ts` | GET `/search` | Feature | `FeatureListItemSchema` | **BORDERLINE** | Same as above | Yes | Same decision as `feature/public/list.ts` |
| `feature/public/getFeaturesForAccommodation.ts` | GET `/accommodation/{accommodationId}` | Feature | `FeatureListItemSchema` | **BORDERLINE** | Same as above | Yes | Same decision |
| `feature/public/getAccommodationsByFeature.ts` | GET `/{featureId}/accommodations` | Accommodation | `AccommodationListItemSchema` | **BORDERLINE** | `ownerId`, `createdAt`, `updatedAt` not in `AccommodationPublicSchema`; no `createdById`/admin fields | Yes (`AccommodationPublicSchema`) | See owner decisions §4 |
| `feature/public/show.ts` | GET `/{id}` | Feature | `FeaturePublicSchema.nullable()` | **OK** | — | Yes | |
| `feedback/public/submit.ts` | POST `/` | Feedback | `FeedbackResponseSchema` (local `z.object({linearIssueId,linearIssueUrl,message})`) | **OK** | — | N/A — inline action response; no entity data | |
| `gastronomy/public/list.ts` | GET `/` | Gastronomy | `GastronomyPublicSchema` | **OK** | — | Yes | |
| `gastronomy/public/getById.ts` | GET `/{id}` | Gastronomy | `GastronomyPublicSchema.nullable()` | **OK** | — | Yes | |
| `gastronomy/public/getBySlug.ts` | GET `/slug/{slug}` | Gastronomy | `GastronomyPublicSchema.nullable()` | **OK** | — | Yes | |
| `gastronomy/public/getByDestination.ts` | GET `/destination/{destinationId}` | Gastronomy | `GastronomyPublicSchema` | **OK** | — | Yes | |
| `gastronomy/public/getFaqs.ts` | GET `/{gastronomyId}/faqs` | GastronomyFaq | `GastronomyFaqListOutputSchema` | **LEAK** | Same as experience FAQs: `createdAt`, `updatedAt`, `createdById`, `updatedById`, `deletedAt`, `deletedById`, `lifecycleState` | No `GastronomyFaqPublicSchema` | `GastronomyFaqSchema extends BaseFaqSchema` → same audit leak |
| `gastronomy/public/getReviews.ts` | GET `/{gastronomyId}/reviews` | GastronomyReview | Local `GastronomyReviewPublicSchema` (`.pick({id,gastronomyId,userId,title,content,rating,averageRating,overallRating,reviewerName,createdAt,updatedAt})`) | **OK** | — | No canonical schema | Local pick is safe |
| `newsletter/public/subscribe.ts` | POST `/subscribe` | Newsletter subscription | Local `z.object({status: z.enum(...)})` | **OK** | — | N/A — action response | |
| `newsletter/public/resend.ts` | POST `/resend` | Newsletter subscription | Local `z.object({sent: z.literal(true)})` | **OK** | — | N/A — action response | |
| `owner-promotion/public/getById.ts` | GET `/{id}` | OwnerPromotion | `OwnerPromotionPublicSchema.nullable()` | **OK** | — | Yes | |
| `owner-promotion/public/list.ts` | GET `/` | OwnerPromotion | `OwnerPromotionPublicSchema` | **OK** | — | Yes | |
| `platform-settings/public/index.ts` | GET `/` | PlatformSettings (announcements) | `z.array(AnnouncementItemSchema)` | **OK** | — | N/A — `AnnouncementItemSchema` is a dedicated standalone shape; no audit fields | |
| `post/public/list.ts` | GET `/` | Post | `PostPublicSchema` | **OK** | — | Yes | |
| `post/public/getById.ts` | GET `/{id}` | Post | `PostPublicSchema.nullable()` | **OK** | — | Yes | |
| `post/public/getBySlug.ts` | GET `/slug/{slug}` | Post | `PostPublicSchema.nullable()` | **OK** | — | Yes | |
| `post/public/getByCategory.ts` | GET `/category/{category}` | Post | `PostListItemSchema` | **BORDERLINE** | `lifecycleState`, `authorId` vs `PostPublicSchema`; no `createdById`/admin fields | Yes (`PostPublicSchema`) | See owner decisions §5 |
| `post/public/getByRelatedAccommodation.ts` | GET `/related/accommodation/{accommodationId}` | Post | `PostListItemSchema` | **BORDERLINE** | Same as above | Yes | |
| `post/public/getByRelatedDestination.ts` | GET `/related/destination/{destinationId}` | Post | `PostListItemSchema` | **BORDERLINE** | Same as above | Yes | |
| `post/public/getByRelatedEvent.ts` | GET `/related/event/{eventId}` | Post | `PostListItemSchema` | **BORDERLINE** | Same as above | Yes | |
| `post/public/getFeatured.ts` | GET `/featured` | Post | `PostListItemSchema` | **BORDERLINE** | Same as above | Yes | |
| `post/public/getNews.ts` | GET `/news` | Post | `PostListItemSchema` | **BORDERLINE** | Same as above | Yes | |
| `post/public/getStats.ts` | GET `/stats` | Post | `PostStatsSchema` | **OK** | — | N/A — standalone stats shape | |
| `post/public/getSummary.ts` | GET `/{id}/summary` | Post | `PostSummarySchema` | **OK** | — | N/A — dedicated summary shape; no audit fields | |
| `post/comments/public/list.ts` | GET `/{postId}/comments` | EntityComment | `EntityCommentPublicItemSchema` | **OK** | — | Yes | |
| `search/public/search.ts` | GET `/` | Multi-entity | `PublicSearchResponseSchema` | **OK** | — | Yes — `PublicSearchGroupSchema` wraps `PublicSearchItemSchema` which is ID+name+slug+type only | |
| `sponsorship-level/public/getById.ts` | GET `/{id}` | SponsorshipLevel | `SponsorshipLevelSchema.nullable()` | **LEAK** | `createdAt`, `updatedAt`, `createdById`, `updatedById`, `deletedAt`, `deletedById` | No `SponsorshipLevelPublicSchema` | Full entity schema; `BaseAuditFields` included |
| `sponsorship-level/public/list.ts` | GET `/` | SponsorshipLevel | `SponsorshipLevelSchema` | **LEAK** | Same as above | No | Same issue |
| `sponsorship-package/public/getById.ts` | GET `/{id}` | SponsorshipPackage | `SponsorshipPackageSchema.nullable()` | **LEAK** | `createdAt`, `updatedAt`, `createdById`, `updatedById`, `deletedAt`, `deletedById` | No `SponsorshipPackagePublicSchema` | Full entity schema; `BaseAuditFields` included |
| `sponsorship-package/public/list.ts` | GET `/` | SponsorshipPackage | `SponsorshipPackageSchema` | **LEAK** | Same as above | No | Same issue |
| `stats/public/get-platform-stats.ts` | GET `/` | Platform stats | `PublicPlatformStatsSchema` | **OK** | — | Yes — dedicated public stats shape | |
| `tag/post-tag/public/list.ts` | GET `/` | PostTag | Local `z.array(PublicPostTagWithCountSchema)` | **OK** | — | N/A — locally defined public projection; no audit fields | |
| `testimonials/public/list.ts` | GET `/` | Review (mixed) | Local `TestimonialItemSchema` | **OK** | — | N/A — locally defined testimonial shape; no entity fields | |
| `user-bookmark/public/count.ts` | GET `/count` | UserBookmark | `UserBookmarkCountResponseSchema` | **OK** | — | Yes — dedicated count response schema | |
| `user/public/batch.ts` | POST `/batch` | User | `UserPublicBatchResponseSchema` | **OK** | — | Yes — wraps `UserPublicSchema` | |
| `user/public/getAccommodations.ts` | GET `/{id}/accommodations` | Accommodation | `AccommodationPublicSchema` | **OK** | — | Yes | |
| `user/public/getById.ts` | GET `/{id}` | User | `UserPublicSchema.nullable()` | **OK** | — | Yes | |
| `user/public/getBySlug.ts` | GET `/by-slug/{slug}` | User | Local `UserAuthorPublicResponseSchema.nullable()` (`z.object({id,displayName,slug,avatar,bio})`) | **OK** | — | N/A — locally defined narrow shape | |

---

## Confirmed Known Leaks (from SPEC-210 brief)

1. **`accommodation/public/similar.ts`** — `z.array(z.record(z.string(), z.unknown()))` — confirmed PASSTHROUGH. The handler applies manual data-level projection (columns excluded: `richDescription`, `adminInfo`, `deletedAt`, `deletedById`, `createdById`, `updatedById`, `lastWarnedAt`, `moderationState`, `schedule`, `rating`) which provides partial protection, but the schema itself passes through any keys without enforcement. Classification: **PASSTHROUGH**.

2. **`exchange-rates/public/list.ts`** — `ExchangeRateSchema` — confirmed LEAK. `ExchangeRatePublicSchema` already exists in `packages/schemas/src/entities/exchangeRate/exchange-rate.access.schema.ts` and properly excludes `source`, `isManualOverride`, `expiresAt`. The route imports and uses the full base schema instead.

3. **`sponsorship-level/public/getById.ts` + `list.ts`** — `SponsorshipLevelSchema` — confirmed LEAK. `BaseAuditFields` is spread inside (`createdById`, `updatedById`, `deletedAt`, `deletedById`). No `SponsorshipLevelPublicSchema` exists.

4. **Additional discovered:** `sponsorship-package/public/getById.ts` + `list.ts` use `SponsorshipPackageSchema` — same pattern. No `SponsorshipPackagePublicSchema` exists.

---

## Remediation Backlog

### Group A — Re-wire to existing `*PublicSchema` (fix without creating new schema)

| Route | Fix |
|---|---|
| `exchange-rates/public/list.ts` | Replace `ExchangeRateSchema` → `ExchangeRatePublicSchema` (already in `exchange-rate.access.schema.ts`) |
| `accommodation/public/getByDestination.ts` | Replace `AccommodationListWrapperSchema` → `z.object({accommodations: z.array(AccommodationPublicSchema)})` |
| `accommodation/public/getTopRatedByDestination.ts` | Replace `AccommodationTopRatedOutputSchema` (= full `AccommodationSchema` wrapped) → proper paginated public schema. Requires creating `AccommodationTopRatedPublicOutputSchema` |
| `accommodation/public/similar.ts` | Replace `z.array(z.record(...))` → `z.array(AccommodationPublicSchema)` (and keep data-level strip for defense-in-depth) |

### Group B — Create new `*PublicSchema` + re-wire (no canonical public schema exists)

| Route | New schema needed | Fields to decide (see owner decisions) |
|---|---|---|
| `sponsorship-level/public/getById.ts` + `list.ts` | `SponsorshipLevelPublicSchema` | Which fields beyond `id, slug, name, description, targetType, tier, priceAmount, priceCurrency, benefits, sortOrder, isActive` are public? |
| `sponsorship-package/public/getById.ts` + `list.ts` | `SponsorshipPackagePublicSchema` | Which fields beyond `id, slug, name, description, priceAmount, priceCurrency, includedPosts, includedEvents, eventLevelId, isActive, sortOrder` are public? |
| `commerce/public/create-lead.ts` | `CommerceLeadCreateResponseSchema` | What should a public create response return? Only `id` and confirmation (exclude `adminNote`, `status`, audit fields) |
| `experience/public/getFaqs.ts` | `ExperienceFaqPublicSchema` / `ExperienceFaqListPublicOutputSchema` | Should FAQs expose `lifecycleState`, `createdAt`, `updatedAt`? (See §6) |
| `gastronomy/public/getFaqs.ts` | `GastronomyFaqPublicSchema` / `GastronomyFaqListPublicOutputSchema` | Same as experience FAQs |

### Group C — Address MISSING coverage (conversation routes bypass factory)

All 5 `conversations/public/` routes use a raw `createRouter()` pattern and call `createResponse()` directly without a `responseSchema`. This makes them invisible to `stripWithSchema` enforcement. Since conversations contain message bodies and guest contact data, these need evaluation:

| Route | Risk level | Recommendation |
|---|---|---|
| `conversations/public/verify.ts` | None — issues redirect, no body | Keep as-is or add `z.null()` placeholder |
| `conversations/public/request-access.ts` | Very low — returns `{status:'sent_if_exists'}` | Add inline local `z.object({status: z.literal('sent_if_exists')})` |
| `conversations/public/initiate.ts` | Low — returns `{status, conversationId}` | Add inline local schema for `{status, conversationId}` |
| `conversations/public/guest-reply.ts` | Medium — returns raw `messageResult.data` | Owner decision needed: what message fields are safe to return to guest? |
| `conversations/public/guest-thread.ts` | Medium — returns `{conversation, messages, hasMore}` | Owner decision needed: what conversation/message fields are safe for guest access? |

### Group D — Owner decision before any change (BORDERLINE routes)

These routes use handcrafted `.pick()` query schemas that are narrower than the full entity schema but slightly broader than the canonical `*PublicSchema`. They do NOT leak `createdById`/`updatedById`/`deletedAt`/admin fields but expose a few extra operational fields. No change is strictly required until the owner decides the desired public field set.

---

## Owner Decisions Required

### §1 — `AccommodationSummarySchema` vs `AccommodationPublicSchema`

`AccommodationSummarySchema` (used by `getSummary`) adds `ownerId`, `createdAt`, `updatedAt` beyond `AccommodationPublicSchema`. `ownerId` is already in `AccommodationPublicSchema` so only `createdAt`/`updatedAt` are extra.

**Decision needed:** Are `createdAt` and `updatedAt` publicly acceptable on the summary endpoint? If yes, mark OK. If no, create `AccommodationSummaryPublicSchema` that omits them.

### §2 — `DestinationSummarySchema` extra fields

`DestinationSummarySchema` adds `accommodationsCount`, `path`, `level` which are not present in `DestinationPublicSchema`. None are audit fields. These are descriptive hierarchical metadata.

**Decision needed:** Are `accommodationsCount`, `path`, and `level` intended to be public? Very likely yes (useful for breadcrumbs/maps), but should be explicit.

### §3 — `FeatureListItemSchema` vs `FeaturePublicSchema`

`FeatureListItemSchema` adds `lifecycleState`, `createdAt`, `updatedAt` vs `FeaturePublicSchema`. Used by `feature/public/list.ts`, `search.ts`, `getFeaturesForAccommodation.ts`.

**Decision needed:** Should `lifecycleState`, `createdAt`, `updatedAt` be on the public feature list? `lifecycleState` exposes internal operational state. If the answer is no, these 3 routes should switch to `FeaturePublicSchema`.

### §4 — `AccommodationListItemSchema` in `getAccommodationsByFeature`

`AccommodationListItemSchema` adds `ownerId`, `createdAt`, `updatedAt`, `description` (with min(30) constraint) vs `AccommodationPublicSchema`. `ownerId` is already in `AccommodationPublicSchema`. `createdAt` is in `AccommodationPublicSchema`. `description` is also in `AccommodationPublicSchema`. So the main difference is `updatedAt`.

**Decision needed:** Is `updatedAt` publicly acceptable in accommodation lists filtered by feature? Almost certainly yes. This can likely be marked OK after confirming.

### §5 — `PostListItemSchema` vs `PostPublicSchema`

`PostListItemSchema` adds `lifecycleState`, `authorId` vs `PostPublicSchema`. Used by `getByCategory`, `getByRelatedAccommodation/Destination/Event`, `getFeatured`, `getNews`.

**Decision needed:** Are `lifecycleState` and `authorId` acceptable on these public list endpoints? `lifecycleState` exposes operational state; `authorId` is a user UUID. If `PostPublicSchema` intentionally omits them, these routes should be updated.

### §6 — FAQ audit fields on public endpoints

Both `ExperienceFaqListOutputSchema` and `GastronomyFaqListOutputSchema` embed `BaseFaqSchema` which includes `BaseAuditFields` (`createdById`, `updatedById`, `deletedAt`, `deletedById`) and `BaseLifecycleFields` (`lifecycleState`). These are full internal audit trails on a public read endpoint.

**Decision needed:** What fields should public FAQ responses expose? Minimum safe set: `id`, `question`, `answer`, `category`. `createdAt`/`updatedAt` borderline (freshness display). `createdById`, `deletedAt`, `lifecycleState` should NOT be public.

### §7 — Commerce lead create response

`CommerceLeadSchema.partial()` exposes `adminNote`, `status` (workflow enum: pending/contacted/converted/rejected), audit fields. The route returns the raw service result.

**Decision needed:** What should a public lead-creation response contain? Recommendation: only `{id: string, status: 'pending'}` or a simple `{success: boolean}` — no admin workflow state.

### §8 — Conversation guest routes

`guest-thread.ts` returns `{conversation, messages, hasMore}` — the conversation and message shapes from the service layer. These may include internal fields depending on service output.

**Decision needed:** Define explicit public-safe schemas for the conversation thread and message shapes returned to guests.

---

## Web + Admin Consumer Evidence

The following greps identify which public fields are actually consumed by `apps/web` and `apps/admin`, supporting owner decisions about what is genuinely needed in the public payload.

```
# Run from repo root to see web consumers of exchange rate fields:
grep -r "expiresAt\|isManualOverride\|\.source" apps/web/src --include="*.ts" --include="*.tsx" --include="*.astro"

# See web consumers of sponsorship level/package fields:
grep -r "SponsorshipLevel\|SponsorshipPackage\|createdById\|deletedAt" apps/web/src --include="*.ts" --include="*.tsx"

# See web consumers of accommodation similar route:
grep -r "similar\|cityDestination\|richDescription" apps/web/src --include="*.ts" --include="*.tsx"
```

> Note: these greps were not executed during the audit as the goal is read-only schema classification. The patterns above should be run before finalizing remediation scope.

---

## Classification Notes

### Why the `conversations/public/` routes are MISSING and not LEAK

The conversation routes do not use the tiered route factory at all — they register a raw Hono router via `createRouter()`. This means `stripWithSchema` is never called. The risk is different from a LEAK: a LEAK has a known bad schema wired; MISSING has no schema at all, so the response is whatever the service layer returns, unguarded. Three of the five routes are low-risk (narrow manual shapes), but `guest-reply` and `guest-thread` return richer data whose fields are not constrained by any schema.

### Why `AccommodationListItemSchema` is BORDERLINE not LEAK

It uses `.pick()` from `AccommodationSchema` and does NOT include `createdById`, `updatedById`, `deletedAt`, `deletedById`, `adminInfo`, `moderationState`, `lastWarnedAt`, or `translationMeta`. The extra fields (`ownerId`, `createdAt`, `updatedAt`) are all present in `AccommodationPublicSchema`. So this is a schema consistency issue (not using the canonical public schema) rather than an actual sensitive-field leak.

### Why `AccommodationTopRatedOutputSchema` is LEAK not BORDERLINE

`AccommodationTopRatedOutputSchema = AccommodationSearchResultSchema = PaginationResultSchema(AccommodationSchema)`. `PaginationResultSchema` wraps the schema as `z.array(itemSchema)` inside a paginated envelope. `AccommodationSchema` spreads `BaseAuditFields` directly, exposing `createdById`, `updatedById`, `deletedAt`, `deletedById`, and also includes `adminInfo`, `moderationState`, `lastWarnedAt`, `translationMeta`, `scheduleData`. This is a definite audit and admin-only field leak.
