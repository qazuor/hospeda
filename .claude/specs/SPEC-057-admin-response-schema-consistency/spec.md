# SPEC-057: Admin Response Schema Naming Consistency

> **Status**: completed
> **Completed**: 2026-03-31
> **Priority**: P2
> **Complexity**: Low
> **Origin**: SPEC-049 GAP-049-030
> **Created**: 2026-03-21
> **Updated**: 2026-03-31 (second exhaustive review: field modifiers verified against actual schemas, convention exceptions documented, response envelope corrected, verification commands improved)

## Problem Statement

Admin list routes have inconsistent response schema naming. Some routes use `*AdminSchema` variants (e.g., `AccommodationAdminSchema`), while others use the base `*Schema` directly (e.g., `TagSchema`). Since AdminSchema is an alias for the base schema (i.e., `export const TagAdminSchema = TagSchema;`), the actual response data is structurally identical in both cases. The base schemas already include audit fields (`createdAt`, `updatedAt`, `createdById`, `updatedById`, `deletedAt`, `deletedById`) via `BaseAuditFields`, and some also include `adminInfo` via `BaseAdminFields`.

This is purely a **naming consistency** issue, not a structural one. All 16 admin list routes already return the same data. The goal is to make every admin list route explicitly reference an `*AdminSchema` to signal intent and establish a consistent convention.

Additionally, the 6 entities missing `access.schema.ts` files are the only entities in the codebase without the standard three-tier access schema pattern (Public, Protected, Admin). This spec creates complete access schemas for consistency with the existing 10 entities that already define all three tiers.

> **Important**: Not all 6 entities include the same base field spreads. Only AccommodationReview, DestinationReview, and PostSponsor use `BaseAdminFields` (which adds `adminInfo`). OwnerPromotion, Sponsorship, and Tag do NOT have `adminInfo`. Each entity's access schema section below documents the exact fields available.

## Current State

### How AdminSchema Works (Aliasing, Not Extension)

The established pattern in the codebase is that `*AdminSchema` is a **simple alias** (re-export) of the base `*Schema`. It does NOT extend or add fields. The base schemas already include all audit fields.

Example from `packages/schemas/src/entities/accommodation/accommodation.access.schema.ts`:

```typescript
export const AccommodationAdminSchema = AccommodationSchema;
export type AccommodationAdmin = z.infer<typeof AccommodationAdminSchema>;
```

The access.schema.ts files also define `*PublicSchema` (a `.pick()` subset) and `*ProtectedSchema` (a larger `.pick()` subset), but the AdminSchema is always a direct alias of the full schema.

> **Exception**: `UserAdminSchema` is the only AdminSchema that uses `.extend()` instead of being a direct alias. It extends `UserProtectedSchema` with additional admin-only fields. This is intentional because User has sensitive fields that are segmented across tiers. The 6 entities in this spec do NOT need this pattern.. they follow the standard alias convention where AdminSchema = full base schema.

### Three-Tier Access Schema Pattern

All 10 existing `access.schema.ts` files follow the same structure:

1. **PublicSchema**: Uses `.pick()` to select only fields safe for unauthenticated users (IDs, names, content, aggregates, SEO)
2. **ProtectedSchema**: Uses `.pick()` to include all public fields plus ownership, lifecycle, and basic audit fields
3. **AdminSchema**: Direct alias of the full base schema (all fields including admin-only data)

All existing standard access.schema.ts files use `import type { z } from 'zod'` (type-only import) since `z` is only referenced in `z.infer<>` type annotations, never at runtime. The exception is `user.access.schema.ts`, which uses `import { z }` (without `type`) because it constructs new `z.object()` schemas rather than using `.pick()`. The 6 entities in this spec all use `.pick()`, so they follow the `import type` convention.

### Response Envelope Format

Handlers return `{ items, pagination }` directly. The `createListRoute` factory passes this to `createPaginatedResponse()`, which wraps it into the final HTTP response:

```typescript
// Handler returns:
{ items: [...], pagination: { page, pageSize, total, totalPages, hasNextPage, hasPreviousPage } }

// createPaginatedResponse wraps it into:
{ success: true, data: { items: [...], pagination: { page, pageSize, total, totalPages, hasNextPage, hasPreviousPage } } }
```

This wrapping is handled automatically by the route factory. Handlers should NOT return a `data` wrapper themselves.

### All 16 Admin List Routes

| # | Entity | Route File | Current responseSchema | Has access.schema.ts? | Work Needed? |
|---|--------|-----------|----------------------|----------------------|-------------|
| 1 | Accommodation | `apps/api/src/routes/accommodation/admin/list.ts` | `AccommodationAdminSchema` | Yes | No |
| 2 | AccommodationReview | `apps/api/src/routes/accommodation/reviews/admin/list.ts` | `AccommodationReviewSchema` | No | **Yes** |
| 3 | Amenity | `apps/api/src/routes/amenity/admin/list.ts` | `AmenityAdminSchema` | Yes | No |
| 4 | Attraction | `apps/api/src/routes/attraction/admin/list.ts` | `AttractionAdminSchema` | Yes | No |
| 5 | Destination | `apps/api/src/routes/destination/admin/list.ts` | `DestinationAdminSchema` | Yes | No |
| 6 | DestinationReview | `apps/api/src/routes/destination/reviews/admin/list.ts` | `DestinationReviewSchema` | No | **Yes** |
| 7 | Event | `apps/api/src/routes/event/admin/list.ts` | `EventAdminSchema` | Yes | No |
| 8 | EventLocation | `apps/api/src/routes/event-location/admin/list.ts` | `EventLocationAdminSchema` | Yes | No |
| 9 | EventOrganizer | `apps/api/src/routes/event-organizer/admin/list.ts` | `EventOrganizerAdminSchema` | Yes | No |
| 10 | Feature | `apps/api/src/routes/feature/admin/list.ts` | `FeatureAdminSchema` | Yes | No |
| 11 | OwnerPromotion | `apps/api/src/routes/owner-promotion/admin/list.ts` | `OwnerPromotionSchema` | No | **Yes** |
| 12 | Post | `apps/api/src/routes/post/admin/list.ts` | `PostAdminSchema` | Yes | No |
| 13 | PostSponsor | `apps/api/src/routes/postSponsor/admin/list.ts` | `PostSponsorSchema` | No | **Yes** |
| 14 | Sponsorship | `apps/api/src/routes/sponsorship/admin/list.ts` | `SponsorshipSchema` | No | **Yes** |
| 15 | Tag | `apps/api/src/routes/tag/admin/list.ts` | `TagSchema` | No | **Yes** |
| 16 | User | `apps/api/src/routes/user/admin/list.ts` | `UserAdminSchema` | Yes | No |

**Summary**: 10 entities already have access.schema.ts with all three tiers and use AdminSchema. 6 entities need a complete access.schema.ts file created and their admin list route updated.

### Existing Public/Protected Routes for the 6 Entities

These entities already have public/protected API routes that will benefit from having proper PublicSchema and ProtectedSchema definitions:

| Entity | Public Routes | Protected Routes | Notes |
|--------|-------------|-----------------|-------|
| AccommodationReview | Yes (list reviews) | Yes (create review) | Currently use full base schema |
| DestinationReview | Yes (list reviews) | Yes (create review) | Currently use full base schema |
| OwnerPromotion | Yes (list promotions) | Yes (CRUD operations) | Currently use full base schema |
| PostSponsor | None | None | Admin-only entity |
| Sponsorship | None | Yes (list, CRUD, analytics) | Currently use full base schema |
| Tag | Yes (getBySlug only) | None | Public route already uses a custom restricted schema |

> **Note**: This spec does NOT update the public/protected routes to use the new PublicSchema/ProtectedSchema. That is a separate concern. This spec only creates the schema definitions for consistency and updates the admin list routes.

## Proposed Solution

For each of the 6 missing entities, create a complete `access.schema.ts` file with all three access tiers (Public, Protected, Admin), update the entity's `index.ts` to re-export it, and update the admin list route to import the AdminSchema instead of the base schema.

### Scope

#### In Scope

- Create 6 new `access.schema.ts` files with PublicSchema, ProtectedSchema, and AdminSchema
- Update 6 entity `index.ts` files to re-export the new schemas
- Update 6 admin list route files to import `*AdminSchema` instead of base `*Schema`

#### Out of Scope

- Changing base entity schemas
- Adding or removing fields from any base schema
- Modifying non-list admin routes (detail, create, update, delete).. note that these routes for the 6 entities also currently use the base schema (e.g., `OwnerPromotionSchema` instead of `OwnerPromotionAdminSchema`). Updating them to use AdminSchema is a natural follow-up but is deferred to keep this spec focused on the admin LIST routes only
- Frontend changes (responses are structurally identical before and after)
- Updating public or protected routes to use the new PublicSchema/ProtectedSchema (future work)

## Implementation Details

### Base Field Reference

These base field spreads are used in entity schemas. Understanding them is essential for choosing which fields to pick for each access tier:

| Spread | Fields Added |
|--------|-------------|
| `BaseAuditFields` | `createdAt`, `updatedAt`, `createdById`, `updatedById`, `deletedAt`, `deletedById` |
| `BaseAdminFields` | `adminInfo` |
| `BaseLifecycleFields` | `lifecycleState` |
| `BaseContactFields` | `contactInfo` |
| `SocialNetworkFields` | `socialNetworks` |

### Access Tier Design Principles

Consistent with the existing 10 access.schema.ts files:

- **PublicSchema**: Minimum data safe for unauthenticated users. Includes identification (id, slug), content fields, and public-facing aggregates. Excludes ownership IDs, audit metadata, admin info, and sensitive operational data.
- **ProtectedSchema**: All public fields plus data relevant to authenticated users. Adds ownership references (e.g., `ownerId`), lifecycle state, and audit timestamps (`createdAt`, `updatedAt`). Does NOT include `*ById` audit fields (`createdById`, `updatedById`, `deletedById`).. those are Admin-only per the dominant convention (3 of 4 standard entities: accommodation, post, event). Note: `destination.access.schema.ts` is an exception that includes `createdById`/`updatedById` in its ProtectedSchema. The 6 entities in this spec follow the dominant pattern (no `*ById` in Protected).
- **AdminSchema**: Direct alias of the full base schema. Includes everything: soft-delete fields, admin info, all audit metadata.

### Step 1: Create access.schema.ts Files (6 files)

Each file follows the established three-tier pattern used by the existing 10 access.schema.ts files.

#### 1a. AccommodationReview

**File**: `packages/schemas/src/entities/accommodationReview/accommodationReview.access.schema.ts`

**Base schema fields**: `id`, `userId`, `accommodationId`, `title` (optional), `content` (optional), `rating` (object: `AccommodationRatingSchema` with sub-fields `cleanliness`, `hospitality`, `services`, `accuracy`, `communication`, `location`), `createdAt`, `updatedAt`, `createdById` (nullable), `updatedById` (nullable), `deletedAt` (nullable, optional), `deletedById` (nullable, optional) (BaseAuditFields), `adminInfo` (nullable, optional) (BaseAdminFields)

```typescript
import type { z } from 'zod';
import { AccommodationReviewSchema } from './accommodationReview.schema.js';

/**
 * PUBLIC ACCESS SCHEMA
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public review listing pages.
 *
 * Picks specific fields from the full schema to ensure only public data is exposed.
 */
export const AccommodationReviewPublicSchema = AccommodationReviewSchema.pick({
    // Identification
    id: true,

    // Relations (public safe)
    userId: true,
    accommodationId: true,

    // Review content
    title: true,
    content: true,
    rating: true,

    // Timestamp (when the review was posted)
    createdAt: true
});

export type AccommodationReviewPublic = z.infer<typeof AccommodationReviewPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA
 *
 * Contains data for authenticated users, including audit timestamps.
 * Used for authenticated review interactions (own reviews, moderation helpers).
 *
 * Extends public fields with audit timestamps.
 * Note: *ById fields (createdById, updatedById) are Admin-only per established convention.
 */
export const AccommodationReviewProtectedSchema = AccommodationReviewSchema.pick({
    // All public fields
    id: true,
    userId: true,
    accommodationId: true,
    title: true,
    content: true,
    rating: true,
    createdAt: true,

    // Audit timestamps (for authenticated users)
    updatedAt: true
});

export type AccommodationReviewProtected = z.infer<typeof AccommodationReviewProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA
 *
 * Contains ALL fields including sensitive admin-only data.
 * Used for admin dashboard, moderation, and management.
 *
 * This is essentially the full schema.
 */
export const AccommodationReviewAdminSchema = AccommodationReviewSchema;

export type AccommodationReviewAdmin = z.infer<typeof AccommodationReviewAdminSchema>;
```

#### 1b. DestinationReview

**File**: `packages/schemas/src/entities/destinationReview/destinationReview.access.schema.ts`

**Base schema fields**: `id`, `userId`, `destinationId`, `title` (optional), `content` (optional), `rating` (object: `DestinationRatingSchema` with 18 sub-fields including `landscape`, `attractions`, `accessibility`, `safety`, `cleanliness`, `hospitality`, `culturalOffer`, `gastronomy`, `affordability`, `nightlife`, `infrastructure`, `environmentalCare`, `wifiAvailability`, `shopping`, `beaches`, `greenSpaces`, `localEvents`, `weatherSatisfaction`), `visitDate` (optional), `tripType` (optional), `travelSeason` (optional), `isBusinessTravel` (default: false), `language` (optional), `isVerified` (default: false), `isPublished` (default: false), `isRecommended` (default: true), `wouldVisitAgain` (default: true), `helpfulVotes` (default: 0), `totalVotes` (default: 0), `hasOwnerResponse` (default: false), `createdAt`, `updatedAt`, `createdById` (nullable), `updatedById` (nullable), `deletedAt` (nullable, optional), `deletedById` (nullable, optional) (BaseAuditFields), `adminInfo` (nullable, optional) (BaseAdminFields)

```typescript
import type { z } from 'zod';
import { DestinationReviewSchema } from './destinationReview.schema.js';

/**
 * PUBLIC ACCESS SCHEMA
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public review listing and detail pages.
 *
 * Picks specific fields from the full schema to ensure only public data is exposed.
 */
export const DestinationReviewPublicSchema = DestinationReviewSchema.pick({
    // Identification
    id: true,

    // Relations (public safe)
    userId: true,
    destinationId: true,

    // Review content
    title: true,
    content: true,
    rating: true,

    // Visit context (public safe)
    visitDate: true,
    tripType: true,
    travelSeason: true,
    language: true,

    // Recommendation (public)
    isRecommended: true,
    wouldVisitAgain: true,

    // Voting aggregates (public)
    helpfulVotes: true,
    totalVotes: true,

    // Owner engagement indicator
    hasOwnerResponse: true,

    // Timestamp (when the review was posted)
    createdAt: true
});

export type DestinationReviewPublic = z.infer<typeof DestinationReviewPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA
 *
 * Contains data for authenticated users, including moderation status.
 * Used for authenticated review interactions (own reviews, voting, moderation helpers).
 *
 * Extends public fields with verification, publication status, and audit timestamps.
 * Note: *ById fields (createdById, updatedById) are Admin-only per established convention.
 */
export const DestinationReviewProtectedSchema = DestinationReviewSchema.pick({
    // All public fields
    id: true,
    userId: true,
    destinationId: true,
    title: true,
    content: true,
    rating: true,
    visitDate: true,
    tripType: true,
    travelSeason: true,
    language: true,
    isRecommended: true,
    wouldVisitAgain: true,
    helpfulVotes: true,
    totalVotes: true,
    hasOwnerResponse: true,
    createdAt: true,

    // Protected fields
    isBusinessTravel: true,
    isVerified: true,
    isPublished: true,

    // Audit timestamps (for authenticated users)
    updatedAt: true
});

export type DestinationReviewProtected = z.infer<typeof DestinationReviewProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA
 *
 * Contains ALL fields including sensitive admin-only data.
 * Used for admin dashboard, moderation, and management.
 *
 * This is essentially the full schema.
 */
export const DestinationReviewAdminSchema = DestinationReviewSchema;

export type DestinationReviewAdmin = z.infer<typeof DestinationReviewAdminSchema>;
```

#### 1c. OwnerPromotion

**File**: `packages/schemas/src/entities/owner-promotion/owner-promotion.access.schema.ts`

**Base schema fields**: `id`, `slug`, `ownerId`, `accommodationId` (nullable, optional), `title`, `description` (optional, nullable), `discountType`, `discountValue`, `minNights` (nullable, optional), `validFrom`, `validUntil` (nullable, optional), `maxRedemptions` (nullable, optional), `currentRedemptions` (default: 0), `isActive` (default: true), `createdAt`, `updatedAt`, `createdById` (nullable), `updatedById` (nullable), `deletedAt` (nullable, optional), `deletedById` (nullable, optional) (BaseAuditFields)

> **Note**: OwnerPromotion does NOT use `BaseAdminFields` (no `adminInfo` field).

```typescript
import type { z } from 'zod';
import { OwnerPromotionSchema } from './owner-promotion.schema.js';

/**
 * PUBLIC ACCESS SCHEMA
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public promotion listing and detail pages.
 *
 * Picks specific fields from the full schema to ensure only public data is exposed.
 * Excludes ownership details and redemption tracking.
 */
export const OwnerPromotionPublicSchema = OwnerPromotionSchema.pick({
    // Identification
    id: true,
    slug: true,

    // Relation (which accommodation)
    accommodationId: true,

    // Promotion content
    title: true,
    description: true,

    // Discount details (public)
    discountType: true,
    discountValue: true,
    minNights: true,

    // Validity period (public)
    validFrom: true,
    validUntil: true,

    // Status
    isActive: true
});

export type OwnerPromotionPublic = z.infer<typeof OwnerPromotionPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA
 *
 * Contains data for authenticated users, including ownership and redemption tracking.
 * Used for owner dashboards and authenticated promotion management.
 *
 * Extends public fields with ownership and operational data.
 */
export const OwnerPromotionProtectedSchema = OwnerPromotionSchema.pick({
    // All public fields
    id: true,
    slug: true,
    accommodationId: true,
    title: true,
    description: true,
    discountType: true,
    discountValue: true,
    minNights: true,
    validFrom: true,
    validUntil: true,
    isActive: true,

    // Ownership
    ownerId: true,

    // Redemption tracking
    maxRedemptions: true,
    currentRedemptions: true,

    // Audit (for owners)
    createdAt: true,
    updatedAt: true
});

export type OwnerPromotionProtected = z.infer<typeof OwnerPromotionProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA
 *
 * Contains ALL fields including sensitive admin-only data.
 * Used for admin dashboard, moderation, and management.
 *
 * This is essentially the full schema.
 */
export const OwnerPromotionAdminSchema = OwnerPromotionSchema;

export type OwnerPromotionAdmin = z.infer<typeof OwnerPromotionAdminSchema>;
```

#### 1d. PostSponsor

**File**: `packages/schemas/src/entities/postSponsor/postSponsor.access.schema.ts`

**Base schema fields**: `id`, `name`, `type`, `description`, `logo` (nullish), `contactInfo` (nullish) (BaseContactFields), `socialNetworks` (nullish) (SocialNetworkFields), `lifecycleState` (default: ACTIVE) (BaseLifecycleFields), `createdAt`, `updatedAt`, `createdById` (nullable), `updatedById` (nullable), `deletedAt` (nullable, optional), `deletedById` (nullable, optional) (BaseAuditFields), `adminInfo` (nullable, optional) (BaseAdminFields)

> **Note**: PostSponsor has NO public or protected API routes. Public and Protected schemas are created purely for pattern consistency and future use.

```typescript
import type { z } from 'zod';
import { PostSponsorSchema } from './postSponsor.schema.js';

/**
 * PUBLIC ACCESS SCHEMA
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public display of sponsor information alongside posts.
 *
 * Picks specific fields from the full schema to ensure only public data is exposed.
 * Excludes contact details, social networks, lifecycle, and admin info.
 */
export const PostSponsorPublicSchema = PostSponsorSchema.pick({
    // Identification
    id: true,

    // Sponsor branding
    name: true,
    type: true,
    description: true,
    logo: true
});

export type PostSponsorPublic = z.infer<typeof PostSponsorPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA
 *
 * Contains data for authenticated users, including contact and social info.
 * Used for authenticated interactions with sponsor entities.
 *
 * Extends public fields with contact, social, and lifecycle data.
 */
export const PostSponsorProtectedSchema = PostSponsorSchema.pick({
    // All public fields
    id: true,
    name: true,
    type: true,
    description: true,
    logo: true,

    // Contact and social (for authenticated users)
    contactInfo: true,
    socialNetworks: true,

    // Lifecycle
    lifecycleState: true,

    // Audit (basic timestamps)
    createdAt: true,
    updatedAt: true
});

export type PostSponsorProtected = z.infer<typeof PostSponsorProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA
 *
 * Contains ALL fields including sensitive admin-only data.
 * Used for admin dashboard, moderation, and management.
 *
 * This is essentially the full schema.
 */
export const PostSponsorAdminSchema = PostSponsorSchema;

export type PostSponsorAdmin = z.infer<typeof PostSponsorAdminSchema>;
```

#### 1e. Sponsorship

**File**: `packages/schemas/src/entities/sponsorship/sponsorship.access.schema.ts`

**Base schema fields**: `id`, `slug`, `sponsorUserId`, `targetType`, `targetId`, `levelId`, `packageId` (nullable, optional), `status` (default: PENDING), `startsAt`, `endsAt` (nullable, optional), `paymentId` (nullable, optional), `logoUrl` (nullable, optional), `linkUrl` (nullable, optional), `couponCode` (nullable, optional), `couponDiscountPercent` (nullable, optional), `analytics` (default: {impressions:0, clicks:0, couponsUsed:0}), `createdAt`, `updatedAt`, `createdById` (nullable), `updatedById` (nullable), `deletedAt` (nullable, optional), `deletedById` (nullable, optional) (BaseAuditFields)

> **Note**: Sponsorship does NOT use `BaseAdminFields` (no `adminInfo` field).

```typescript
import type { z } from 'zod';
import { SponsorshipSchema } from './sponsorship.schema.js';

/**
 * PUBLIC ACCESS SCHEMA
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public display of sponsorship information (badges, banners, coupons).
 *
 * Picks specific fields from the full schema to ensure only public data is exposed.
 * Excludes payment details, analytics, and internal references.
 */
export const SponsorshipPublicSchema = SponsorshipSchema.pick({
    // Identification
    id: true,
    slug: true,

    // Target reference (what is being sponsored)
    targetType: true,
    targetId: true,

    // Status and validity
    status: true,
    startsAt: true,
    endsAt: true,

    // Public branding
    logoUrl: true,
    linkUrl: true,

    // Coupon (public)
    couponCode: true,
    couponDiscountPercent: true
});

export type SponsorshipPublic = z.infer<typeof SponsorshipPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA
 *
 * Contains data for authenticated users, including sponsor identity and analytics.
 * Used for sponsor dashboards and authenticated sponsorship management.
 *
 * Extends public fields with ownership, package, and performance data.
 */
export const SponsorshipProtectedSchema = SponsorshipSchema.pick({
    // All public fields
    id: true,
    slug: true,
    targetType: true,
    targetId: true,
    status: true,
    startsAt: true,
    endsAt: true,
    logoUrl: true,
    linkUrl: true,
    couponCode: true,
    couponDiscountPercent: true,

    // Sponsor identity
    sponsorUserId: true,

    // Package and level references
    levelId: true,
    packageId: true,

    // Payment reference
    paymentId: true,

    // Analytics (for sponsor dashboard)
    analytics: true,

    // Audit (for sponsors)
    createdAt: true,
    updatedAt: true
});

export type SponsorshipProtected = z.infer<typeof SponsorshipProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA
 *
 * Contains ALL fields including sensitive admin-only data.
 * Used for admin dashboard, moderation, and management.
 *
 * This is essentially the full schema.
 */
export const SponsorshipAdminSchema = SponsorshipSchema;

export type SponsorshipAdmin = z.infer<typeof SponsorshipAdminSchema>;
```

#### 1f. Tag

**File**: `packages/schemas/src/entities/tag/tag.access.schema.ts`

**Base schema fields** (all inline, no spreads): `id`, `name`, `slug`, `color`, `icon` (nullish), `notes` (nullish), `lifecycleState`, `createdAt`, `updatedAt`, `createdById` (NOT nullable.. direct UserIdSchema), `updatedById` (NOT nullable.. direct UserIdSchema), `deletedAt` (optional, NOT nullable), `deletedById` (optional, NOT nullable)

> **Note**: Tag defines audit fields inline (not via `BaseAuditFields` spread). The field names are the same, but the nullability differs: Tag's `createdById`/`updatedById` are NOT nullable (direct `UserIdSchema`), and `deletedAt`/`deletedById` are optional but NOT nullable.. unlike `BaseAuditFields` where `createdById`/`updatedById` are `.nullable()` and `deletedAt` is `.nullable().optional()`. This has no impact on implementation since `.pick()` preserves the original field definitions. Tag does NOT use `BaseAdminFields` (no `adminInfo` field).

```typescript
import type { z } from 'zod';
import { TagSchema } from './tag.schema.js';

/**
 * PUBLIC ACCESS SCHEMA
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public tag display (filters, badges, labels).
 *
 * Picks specific fields from the full schema to ensure only public data is exposed.
 */
export const TagPublicSchema = TagSchema.pick({
    // Identification
    id: true,
    name: true,
    slug: true,

    // Display properties
    color: true,
    icon: true
});

export type TagPublic = z.infer<typeof TagPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA
 *
 * Contains data for authenticated users, including lifecycle and notes.
 * Used for authenticated tag management and contributor views.
 *
 * Extends public fields with lifecycle and audit data.
 */
export const TagProtectedSchema = TagSchema.pick({
    // All public fields
    id: true,
    name: true,
    slug: true,
    color: true,
    icon: true,

    // Lifecycle
    lifecycleState: true,

    // Additional metadata
    notes: true,

    // Audit (basic timestamps)
    createdAt: true,
    updatedAt: true
});

export type TagProtected = z.infer<typeof TagProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA
 *
 * Contains ALL fields including sensitive admin-only data.
 * Used for admin dashboard, moderation, and management.
 *
 * This is essentially the full schema.
 */
export const TagAdminSchema = TagSchema;

export type TagAdmin = z.infer<typeof TagAdminSchema>;
```

### Step 2: Update Entity index.ts Files (6 files)

Add a re-export line for the new access.schema.ts file to each entity's index.ts. Use the comment `// Access level schemas (public, protected, admin)` to match the convention in existing entities.

#### 2a. AccommodationReview

**File**: `packages/schemas/src/entities/accommodationReview/index.ts`

Add this line at the end:

```typescript
// Access level schemas (public, protected, admin)
export * from './accommodationReview.access.schema.js';
```

#### 2b. DestinationReview

**File**: `packages/schemas/src/entities/destinationReview/index.ts`

Add this line at the end:

```typescript
// Access level schemas (public, protected, admin)
export * from './destinationReview.access.schema.js';
```

#### 2c. OwnerPromotion

**File**: `packages/schemas/src/entities/owner-promotion/index.ts`

Add this line at the end:

```typescript
// Access level schemas (public, protected, admin)
export * from './owner-promotion.access.schema.js';
```

#### 2d. PostSponsor

**File**: `packages/schemas/src/entities/postSponsor/index.ts`

Add this line at the end:

```typescript
// Access level schemas (public, protected, admin)
export * from './postSponsor.access.schema.js';
```

#### 2e. Sponsorship

**File**: `packages/schemas/src/entities/sponsorship/index.ts`

Add this line at the end:

```typescript
// Access level schemas (public, protected, admin)
export * from './sponsorship.access.schema.js';
```

#### 2f. Tag

**File**: `packages/schemas/src/entities/tag/index.ts`

Add this line at the end:

```typescript
// Access level schemas (public, protected, admin)
export * from './tag.access.schema.js';
```

### Step 3: Update Admin List Route Files (6 files)

For each route file, change the import from the base schema to the AdminSchema variant.

#### 3a. AccommodationReview

**File**: `apps/api/src/routes/accommodation/reviews/admin/list.ts`

```typescript
// Before
import {
    AccommodationReviewAdminSearchSchema,
    AccommodationReviewSchema,
    PermissionEnum
} from '@repo/schemas';
// ...
    responseSchema: AccommodationReviewSchema,

// After
import {
    AccommodationReviewAdminSchema,
    AccommodationReviewAdminSearchSchema,
    PermissionEnum
} from '@repo/schemas';
// ...
    responseSchema: AccommodationReviewAdminSchema,
```

#### 3b. DestinationReview

**File**: `apps/api/src/routes/destination/reviews/admin/list.ts`

```typescript
// Before
import {
    DestinationReviewAdminSearchSchema,
    DestinationReviewSchema,
    PermissionEnum
} from '@repo/schemas';
// ...
    responseSchema: DestinationReviewSchema,

// After
import {
    DestinationReviewAdminSchema,
    DestinationReviewAdminSearchSchema,
    PermissionEnum
} from '@repo/schemas';
// ...
    responseSchema: DestinationReviewAdminSchema,
```

#### 3c. OwnerPromotion

**File**: `apps/api/src/routes/owner-promotion/admin/list.ts`

```typescript
// Before
import {
    OwnerPromotionAdminSearchSchema,
    OwnerPromotionSchema,
    PermissionEnum
} from '@repo/schemas';
// ...
    responseSchema: OwnerPromotionSchema,

// After
import {
    OwnerPromotionAdminSchema,
    OwnerPromotionAdminSearchSchema,
    PermissionEnum
} from '@repo/schemas';
// ...
    responseSchema: OwnerPromotionAdminSchema,
```

#### 3d. PostSponsor

**File**: `apps/api/src/routes/postSponsor/admin/list.ts`

```typescript
// Before
import { PermissionEnum, PostSponsorAdminSearchSchema, PostSponsorSchema } from '@repo/schemas';
// ...
    responseSchema: PostSponsorSchema,

// After
import { PermissionEnum, PostSponsorAdminSchema, PostSponsorAdminSearchSchema } from '@repo/schemas';
// ...
    responseSchema: PostSponsorAdminSchema,
```

#### 3e. Sponsorship

**File**: `apps/api/src/routes/sponsorship/admin/list.ts`

```typescript
// Before
import { PermissionEnum, SponsorshipAdminSearchSchema, SponsorshipSchema } from '@repo/schemas';
// ...
    responseSchema: SponsorshipSchema,

// After
import { PermissionEnum, SponsorshipAdminSchema, SponsorshipAdminSearchSchema } from '@repo/schemas';
// ...
    responseSchema: SponsorshipAdminSchema,
```

#### 3f. Tag

**File**: `apps/api/src/routes/tag/admin/list.ts`

```typescript
// Before
import { PermissionEnum, TagAdminSearchSchema, TagSchema } from '@repo/schemas';
// ...
    responseSchema: TagSchema,

// After
import { PermissionEnum, TagAdminSchema, TagAdminSearchSchema } from '@repo/schemas';
// ...
    responseSchema: TagAdminSchema,
```

## Complete File Manifest

### Files to Create (6)

| File Path | Content |
|-----------|---------|
| `packages/schemas/src/entities/accommodationReview/accommodationReview.access.schema.ts` | Public, Protected, Admin schemas |
| `packages/schemas/src/entities/destinationReview/destinationReview.access.schema.ts` | Public, Protected, Admin schemas |
| `packages/schemas/src/entities/owner-promotion/owner-promotion.access.schema.ts` | Public, Protected, Admin schemas |
| `packages/schemas/src/entities/postSponsor/postSponsor.access.schema.ts` | Public, Protected, Admin schemas |
| `packages/schemas/src/entities/sponsorship/sponsorship.access.schema.ts` | Public, Protected, Admin schemas |
| `packages/schemas/src/entities/tag/tag.access.schema.ts` | Public, Protected, Admin schemas |

### Files to Modify (12)

| File Path | Change |
|-----------|--------|
| `packages/schemas/src/entities/accommodationReview/index.ts` | Add re-export of access.schema.ts |
| `packages/schemas/src/entities/destinationReview/index.ts` | Add re-export of access.schema.ts |
| `packages/schemas/src/entities/owner-promotion/index.ts` | Add re-export of access.schema.ts |
| `packages/schemas/src/entities/postSponsor/index.ts` | Add re-export of access.schema.ts |
| `packages/schemas/src/entities/sponsorship/index.ts` | Add re-export of access.schema.ts |
| `packages/schemas/src/entities/tag/index.ts` | Add re-export of access.schema.ts |
| `apps/api/src/routes/accommodation/reviews/admin/list.ts` | Import AdminSchema, use as responseSchema |
| `apps/api/src/routes/destination/reviews/admin/list.ts` | Import AdminSchema, use as responseSchema |
| `apps/api/src/routes/owner-promotion/admin/list.ts` | Import AdminSchema, use as responseSchema |
| `apps/api/src/routes/postSponsor/admin/list.ts` | Import AdminSchema, use as responseSchema |
| `apps/api/src/routes/sponsorship/admin/list.ts` | Import AdminSchema, use as responseSchema |
| `apps/api/src/routes/tag/admin/list.ts` | Import AdminSchema, use as responseSchema |

**Total**: 6 new files + 12 modified files = 18 files. Approximately 350 lines of new schema code and 40 lines of import/reference changes.

## Testing Strategy

**No dedicated access schema tests are required.** This follows the established convention: none of the existing 10 `access.schema.ts` files have dedicated test files. The rationale:

- `AdminSchema` is a direct alias (`const X = Y;`).. no logic to test
- `PublicSchema` and `ProtectedSchema` use `.pick()`.. a Zod built-in with no custom logic
- Type correctness is verified by `pnpm typecheck` (TypeScript compilation)
- Functional correctness is verified by existing admin route integration tests (responses are structurally identical)

If future specs add transformation logic (not just `.pick()`) to access schemas, dedicated tests would be warranted at that point.

## Dependencies

### Recommended Execution Order

> **Execute SPEC-057 LAST in the 050-057 family.** While there are no direct file conflicts with any sibling spec, running SPEC-057 after the others ensures that base schemas are fully stabilized before creating access schema aliases. This avoids working in the same entity directories simultaneously and produces cleaner git history.

### Sibling Spec Analysis

- **~~SPEC-050~~ (deleted, superseded by SPEC-063 Lifecycle State Standardization)**: SPEC-050 was deleted. It originally modified `SponsorshipAdminSearchSchema` (a different file than the `access.schema.ts` created here). No direct file conflict existed. SPEC-057 is already completed; no sequencing concern remains.
- **SPEC-056 (Numeric Column Coercion)**: SPEC-056 changes `averageRating` columns from string to number type in DB schemas and Zod query schemas. Note: the AccommodationReview and DestinationReview **entity** Zod schemas use `rating` (a composite object via `AccommodationRatingSchema`/`DestinationRatingSchema`), NOT `averageRating`.. so SPEC-056's changes do not affect the fields picked in SPEC-057's access schemas. Any AdminSchema with numeric fields will automatically reflect correct types after SPEC-056 since AdminSchema is an alias, not a copy. Implementation order technically does not matter, but **run SPEC-056 first** for a cleaner sequence.

### No Overlap with Other SPECs (050-056)

The following specs in the same family have been reviewed and have **no overlap** with SPEC-057:

- **SPEC-051 (Admin Permission Hook)**: Operates on service-layer permission checks, not response schemas
- **SPEC-052 (Type-Safe Entity Filters)**: Operates on `AdminSearchExecuteParams` generics in service-core, not response schemas in packages/schemas
- **SPEC-053 (findAllWithRelations Transaction)**: Model-layer plumbing, orthogonal to response schemas
- **SPEC-054 (Admin Filter Bar UI)**: Frontend component work in apps/admin, consumes schemas but does not modify them
- **SPEC-055 (LIKE Wildcard Escaping)**: Modifies PostSponsor service methods and query schemas, but does NOT touch the base `postSponsor.schema.ts` that SPEC-057 imports from

## Acceptance Criteria

- [ ] All 16 admin list routes use `*AdminSchema` as their `responseSchema` parameter
- [ ] All 6 new `access.schema.ts` files define three tiers: `*PublicSchema`, `*ProtectedSchema`, `*AdminSchema`
- [ ] PublicSchema uses `.pick()` with appropriate public-safe fields for each entity
- [ ] ProtectedSchema uses `.pick()` extending PublicSchema fields with authenticated-user data
- [ ] AdminSchema follows the established alias pattern (`export const EntityAdminSchema = EntitySchema;`)
- [ ] All 6 entity `index.ts` files re-export the new access.schema.ts
- [ ] `pnpm typecheck` passes with no errors
- [ ] Existing admin route tests pass without modification (responses are structurally identical)
- [ ] No breaking changes for the admin frontend

## Verification Checklist

After implementation, verify:

1. **Schema exports**: Confirm each new AdminSchema is importable from `@repo/schemas`:

   ```bash
   rg "responseSchema:.*AdminSchema" apps/api/src/routes/ -g "**/admin/list.ts"
   ```

   Expected: 16 matches (one per admin list route).

2. **No base schema in admin list routes**: Confirm no admin list route still uses a non-Admin schema as responseSchema:

   ```bash
   # Search for responseSchema lines that do NOT contain "AdminSchema"
   rg "responseSchema:" apps/api/src/routes/ -g "**/admin/list.ts" | rg -v "AdminSchema"
   ```

   Expected: 0 matches.

3. **Three-tier completeness**: Confirm all 6 new access schemas export all three tiers:

   ```bash
   for entity in AccommodationReview DestinationReview OwnerPromotion PostSponsor Sponsorship Tag; do
     echo "--- $entity ---"
     rg "export const ${entity}(Public|Protected|Admin)Schema" packages/schemas/src/entities/
   done
   ```

   Expected: 3 exports per entity (18 total).

4. **TypeScript compilation**:

   ```bash
   pnpm typecheck
   ```

   Expected: No errors.

5. **Existing tests**:

   ```bash
   pnpm test
   ```

   Expected: All existing tests pass without modification.

6. **File count verification**: Confirm all 6 access.schema.ts files exist:

   ```bash
   ls packages/schemas/src/entities/accommodationReview/accommodationReview.access.schema.ts
   ls packages/schemas/src/entities/destinationReview/destinationReview.access.schema.ts
   ls packages/schemas/src/entities/owner-promotion/owner-promotion.access.schema.ts
   ls packages/schemas/src/entities/postSponsor/postSponsor.access.schema.ts
   ls packages/schemas/src/entities/sponsorship/sponsorship.access.schema.ts
   ls packages/schemas/src/entities/tag/tag.access.schema.ts
   ```

## Risks

- **Low risk**: Since AdminSchema is an alias of the base schema, the actual HTTP response payloads are structurally identical before and after this change. The only change is the import name used in route files.
- **Import path changes**: The 6 admin list route files will import a different symbol name from `@repo/schemas`. If any code outside these routes references these schemas by name, it will need updating. However, `responseSchema` is only used by the route factory internally, so this is unlikely.
- **No frontend impact**: The admin frontend receives the exact same JSON payloads. No frontend code needs to change.
- **PublicSchema/ProtectedSchema unused initially**: The new Public and Protected schemas are created for pattern consistency but are not referenced by any route in this spec. They become available for future public/protected route updates.
- **Non-list admin routes still use base schema**: After this spec, the 6 entities' non-list admin routes (getById, create, update, delete) will still import the base schema (e.g., `OwnerPromotionSchema`) rather than the new AdminSchema. This is intentionally deferred (see Out of Scope) but is a known follow-up for full naming consistency.
