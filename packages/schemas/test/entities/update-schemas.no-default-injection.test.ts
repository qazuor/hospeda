import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import { AccommodationUpdateHttpSchema } from '../../src/entities/accommodation/accommodation.http.schema.js';
import { AccommodationReviewUpdateInputSchema } from '../../src/entities/accommodationReview/accommodationReview.crud.schema.js';
import { AccommodationReviewUpdateHttpSchema } from '../../src/entities/accommodationReview/accommodationReview.http.schema.js';
import { AmenityUpdateInputSchema } from '../../src/entities/amenity/amenity.crud.schema.js';
import { AmenityUpdateHttpSchema } from '../../src/entities/amenity/amenity.http.schema.js';
import { AttractionUpdateInputSchema } from '../../src/entities/attraction/attraction.crud.schema.js';
import { AttractionUpdateHttpSchema } from '../../src/entities/attraction/attraction.http.schema.js';
import { DestinationUpdateInputSchema } from '../../src/entities/destination/destination.crud.schema.js';
import { DestinationUpdateHttpSchema } from '../../src/entities/destination/destination.http.schema.js';
import { DestinationReviewUpdateInputSchema } from '../../src/entities/destinationReview/destinationReview.crud.schema.js';
import { DestinationReviewUpdateHttpSchema } from '../../src/entities/destinationReview/destinationReview.http.schema.js';
import { EventUpdateInputSchema } from '../../src/entities/event/event.crud.schema.js';
import { EventUpdateHttpSchema } from '../../src/entities/event/event.http.schema.js';
import { EventLocationUpdateInputSchema } from '../../src/entities/eventLocation/eventLocation.crud.schema.js';
import { EventLocationUpdateHttpSchema } from '../../src/entities/eventLocation/eventLocation.http.schema.js';
import { EventOrganizerUpdateInputSchema } from '../../src/entities/eventOrganizer/eventOrganizer.crud.schema.js';
import { ExchangeRateConfigUpdateInputSchema } from '../../src/entities/exchangeRate/exchange-rate-config.crud.schema.js';
import { FeatureUpdateInputSchema } from '../../src/entities/feature/feature.crud.schema.js';
import { FeatureUpdateHttpSchema } from '../../src/entities/feature/feature.http.schema.js';
import { OwnerPromotionUpdateHttpSchema } from '../../src/entities/ownerPromotion/owner-promotion.http.schema.js';
import { OwnerPromotionUpdateInputSchema } from '../../src/entities/ownerPromotion/owner-promotion.schema.js';
import { PostUpdateInputSchema } from '../../src/entities/post/post.crud.schema.js';
import { PostUpdateHttpSchema } from '../../src/entities/post/post.http.schema.js';
import { PostSponsorshipUpdateInputSchema } from '../../src/entities/postSponsorship/postSponsorship.crud.schema.js';
import { SponsorshipLevelUpdateInputSchema } from '../../src/entities/sponsorship/sponsorship-level.schema.js';
import { SponsorshipPackageUpdateInputSchema } from '../../src/entities/sponsorship/sponsorship-package.schema.js';
import { SponsorshipUpdateHttpSchema } from '../../src/entities/sponsorship/sponsorship.http.schema.js';
import { SponsorshipUpdateInputSchema } from '../../src/entities/sponsorship/sponsorship.schema.js';
import { UpdatePostTagSchema } from '../../src/entities/tag/post-tag.crud.schema.js';
import { TagUpdateInputSchema } from '../../src/entities/tag/tag.crud.schema.js';
import { UserUpdateInputSchema } from '../../src/entities/user/user.crud.schema.js';
import { UserUpdateHttpSchema } from '../../src/entities/user/user.http.schema.js';

/**
 * SPEC-217 repo-wide regression. In Zod 4, `ZodObject.partial()` does NOT strip
 * `.default()` (Zod 3 did). Every `*UpdateInputSchema` / `*UpdateHttpSchema` built
 * via `.partial()` over a defaulted base therefore used to inject those defaults on
 * every parse — silently overwriting server state on PATCH ("absent key = no change"
 * violated) and, for accommodation, bypassing the publish trial flow. The fix wraps
 * each base shape with `stripShapeDefaults` before `.partial()`. These cases lock the
 * contract for all 32 affected schemas: an empty patch must inject NONE of the
 * previously-defaulted fields. Accommodation has its own dedicated test.
 */
type UpdateSchemaCase = {
    readonly name: string;
    readonly schema: z.ZodTypeAny;
    /** Fields that carried `.default()` in the base and must NOT be injected on `{}`. */
    readonly defaulted: readonly string[];
};

const CASES: readonly UpdateSchemaCase[] = [
    // CRUD update schemas
    {
        name: 'AmenityUpdateInputSchema',
        schema: AmenityUpdateInputSchema,
        defaulted: ['lifecycleState', 'isBuiltin', 'isFeatured', 'displayWeight']
    },
    {
        name: 'AttractionUpdateInputSchema',
        schema: AttractionUpdateInputSchema,
        defaulted: ['lifecycleState', 'isFeatured', 'isBuiltin', 'displayWeight']
    },
    {
        name: 'DestinationUpdateInputSchema',
        schema: DestinationUpdateInputSchema,
        defaulted: [
            'lifecycleState',
            'visibility',
            'moderationState',
            'isFeatured',
            'accommodationsCount',
            'reviewsCount',
            'averageRating'
        ]
    },
    {
        name: 'DestinationReviewUpdateInputSchema',
        schema: DestinationReviewUpdateInputSchema,
        defaulted: [
            'lifecycleState',
            'isBusinessTravel',
            'isVerified',
            'isPublished',
            'isRecommended',
            'wouldVisitAgain',
            'helpfulVotes',
            'totalVotes',
            'hasOwnerResponse'
        ]
    },
    {
        name: 'AccommodationReviewUpdateInputSchema',
        schema: AccommodationReviewUpdateInputSchema,
        defaulted: ['lifecycleState']
    },
    {
        name: 'EventUpdateInputSchema',
        schema: EventUpdateInputSchema,
        defaulted: ['lifecycleState', 'visibility', 'moderationState', 'isFeatured']
    },
    {
        name: 'EventLocationUpdateInputSchema',
        schema: EventLocationUpdateInputSchema,
        defaulted: ['lifecycleState']
    },
    {
        name: 'EventOrganizerUpdateInputSchema',
        schema: EventOrganizerUpdateInputSchema,
        defaulted: ['lifecycleState']
    },
    {
        name: 'FeatureUpdateInputSchema',
        schema: FeatureUpdateInputSchema,
        defaulted: ['lifecycleState', 'isBuiltin', 'isFeatured', 'displayWeight']
    },
    {
        name: 'PostUpdateInputSchema',
        schema: PostUpdateInputSchema,
        defaulted: [
            'lifecycleState',
            'visibility',
            'moderationState',
            'isFeatured',
            'isFeaturedInWebsite',
            'isNews',
            'likes',
            'comments',
            'shares',
            'readingTimeMinutes'
        ]
    },
    {
        name: 'TagUpdateInputSchema',
        schema: TagUpdateInputSchema,
        defaulted: ['lifecycleState']
    },
    {
        name: 'UpdatePostTagSchema',
        schema: UpdatePostTagSchema,
        defaulted: ['lifecycleState']
    },
    {
        name: 'UserUpdateInputSchema',
        schema: UserUpdateInputSchema,
        defaulted: [
            'lifecycleState',
            'visibility',
            'emailVerified',
            'banned',
            'permissions',
            'profileCompleted',
            'setPasswordPrompted',
            'serviceSuspended'
        ]
    },
    {
        name: 'ExchangeRateConfigUpdateInputSchema',
        schema: ExchangeRateConfigUpdateInputSchema,
        defaulted: [
            'defaultRateType',
            'dolarApiFetchIntervalMinutes',
            'exchangeRateApiFetchIntervalHours',
            'showConversionDisclaimer',
            'enableAutoFetch'
        ]
    },
    {
        name: 'PostSponsorshipUpdateInputSchema',
        schema: PostSponsorshipUpdateInputSchema,
        defaulted: ['lifecycleState', 'isHighlighted']
    },
    {
        name: 'OwnerPromotionUpdateInputSchema',
        schema: OwnerPromotionUpdateInputSchema,
        defaulted: ['lifecycleState']
    },
    {
        name: 'SponsorshipUpdateInputSchema',
        schema: SponsorshipUpdateInputSchema,
        // `sponsorshipStatus` carried a default in the base but the schema's own
        // `.extend({ sponsorshipStatus: ...optional() })` already removed it before
        // stripShapeDefaults runs, so only `lifecycleState` is stripped here.
        defaulted: ['lifecycleState']
    },
    {
        name: 'SponsorshipLevelUpdateInputSchema',
        schema: SponsorshipLevelUpdateInputSchema,
        defaulted: ['priceCurrency', 'benefits', 'sortOrder', 'isActive']
    },
    {
        name: 'SponsorshipPackageUpdateInputSchema',
        schema: SponsorshipPackageUpdateInputSchema,
        defaulted: ['priceCurrency', 'isActive', 'sortOrder']
    },
    // HTTP update schemas
    {
        name: 'AccommodationUpdateHttpSchema',
        schema: AccommodationUpdateHttpSchema,
        defaulted: ['isFeatured', 'isAvailable', 'allowsPets', 'currency']
    },
    {
        name: 'AmenityUpdateHttpSchema',
        schema: AmenityUpdateHttpSchema,
        defaulted: ['priority', 'isActive', 'isPopular', 'isFeatured', 'displayWeight']
    },
    {
        name: 'AttractionUpdateHttpSchema',
        schema: AttractionUpdateHttpSchema,
        defaulted: ['isFeatured', 'isBuiltin', 'displayWeight']
    },
    {
        name: 'DestinationUpdateHttpSchema',
        schema: DestinationUpdateHttpSchema,
        defaulted: ['isFeatured']
    },
    {
        name: 'DestinationReviewUpdateHttpSchema',
        schema: DestinationReviewUpdateHttpSchema,
        defaulted: ['isBusinessTravel', 'isRecommended', 'wouldVisitAgain', 'language']
    },
    {
        name: 'AccommodationReviewUpdateHttpSchema',
        schema: AccommodationReviewUpdateHttpSchema,
        defaulted: ['isBusinessTravel', 'language']
    },
    {
        name: 'FeatureUpdateHttpSchema',
        schema: FeatureUpdateHttpSchema,
        defaulted: ['priority', 'isAvailable', 'isPremium', 'requiresPayment', 'displayWeight']
    },
    {
        name: 'EventUpdateHttpSchema',
        schema: EventUpdateHttpSchema,
        defaulted: ['isFeatured', 'isVirtual', 'isPrivate', 'requiresRegistration']
    },
    {
        name: 'PostUpdateHttpSchema',
        schema: PostUpdateHttpSchema,
        defaulted: ['isFeatured', 'isPublished']
    },
    {
        name: 'UserUpdateHttpSchema',
        schema: UserUpdateHttpSchema,
        defaulted: ['role', 'status']
    },
    {
        name: 'OwnerPromotionUpdateHttpSchema',
        schema: OwnerPromotionUpdateHttpSchema,
        defaulted: ['lifecycleState']
    },
    {
        name: 'SponsorshipUpdateHttpSchema',
        schema: SponsorshipUpdateHttpSchema,
        defaulted: ['lifecycleState']
    },
    // HTTP update schemas (continued)
    {
        name: 'EventLocationUpdateHttpSchema',
        schema: EventLocationUpdateHttpSchema,
        defaulted: [
            'hasWifi',
            'hasParking',
            'hasAirConditioning',
            'isAccessible',
            'hasAudioVisual',
            'hasCatering'
        ]
    }
];

describe('Update/Patch schemas — no default injection (SPEC-217 repo-wide)', () => {
    it('covers all 32 schemas the rollout touched', () => {
        expect(CASES).toHaveLength(32);
    });

    it.each(CASES)(
        '$name parses an empty patch without injecting defaults',
        ({ schema, defaulted }) => {
            const result = schema.safeParse({});
            expect(result.success).toBe(true);
            if (result.success) {
                for (const field of defaulted) {
                    expect(result.data).not.toHaveProperty(field);
                }
            }
        }
    );

    it.each(CASES)('$name parses an empty patch to an empty object', ({ schema }) => {
        expect(schema.parse({})).toEqual({});
    });
});
