/**
 * Target and content rules of an owner promotion (HOS-2270).
 *
 * A promotion hangs from a listing through `entityType` + `entityId`, with no
 * foreign key because the target is polymorphic. Nothing in Postgres stops a
 * promotion from pointing at a listing that does not exist or belongs to somebody
 * else, so this module is where that integrity lives: the services call it before
 * every write.
 *
 * It also holds the two content rules that depend on the target: which benefit
 * types a venue or an accommodation may use, and the moderation of the free text of
 * a `special_offer`.
 *
 * @module services/owner-promotion/ownerPromotion.target
 */
import { moderateText } from '@repo/content-moderation';
import type { AccommodationModel, DrizzleClient, VenueModel } from '@repo/db';
import {
    ACCOMMODATION_PROMOTION_DISCOUNT_TYPES,
    OwnerPromotionDiscountTypeEnum,
    OwnerPromotionEntityTypeEnum,
    ServiceErrorCode,
    VENUE_PROMOTION_DISCOUNT_TYPES
} from '@repo/schemas';
import { ServiceError } from '../../types';
import { entityNotFoundError } from '../../utils/not-found';
import { getThresholdForContext } from '../contentModeration/get-threshold-for-context';

/** The entity name used in the 404 of a promotion whose target is not the owner's. */
const PROMOTION_ENTITY_NAME = 'ownerPromotion';

/** The target columns a promotion is written with, dual-written in release N. */
export interface PromotionTarget {
    readonly entityType: OwnerPromotionEntityTypeEnum;
    readonly entityId: string | null;
    /** Legacy column, kept equal to `entityId` for accommodations until release N+1. */
    readonly accommodationId: string | null;
}

/**
 * Resolves and validates where a new promotion hangs from.
 *
 * - `accommodation` + id: the accommodation must exist and be the owner's.
 *   `accommodationId` and `entityId` are written equal (dual write), whichever of
 *   the two the caller supplied.
 * - `accommodation` without id: "all of the owner's accommodations"; nothing to check.
 * - `venue`: the venue must exist and be the owner's; there is no legacy column.
 *
 * A listing that does not exist and one that belongs to somebody else answer the same
 * `NOT_FOUND`, so the id of a foreign listing is never confirmed.
 *
 * @param args.ownerId - The owner the promotion is created for.
 * @param args.entityType - Requested target type; absent means `accommodation`.
 * @param args.entityId - Requested target id.
 * @param args.accommodationId - Legacy target id (accommodation promotions).
 * @param args.accommodationModel - Used to read the accommodation.
 * @param args.venueModel - Used to read the venue.
 * @param args.tx - Optional transaction client.
 * @returns The normalized pair to persist.
 * @throws {ServiceError} NOT_FOUND when the target is missing or not the owner's;
 *   VALIDATION_ERROR when the two accommodation ids disagree or a venue has no id.
 */
export async function resolvePromotionTarget(args: {
    readonly ownerId: string;
    readonly entityType?: OwnerPromotionEntityTypeEnum | null;
    readonly entityId?: string | null;
    readonly accommodationId?: string | null;
    readonly accommodationModel: Pick<AccommodationModel, 'findById'>;
    readonly venueModel: Pick<VenueModel, 'findById'>;
    readonly tx?: DrizzleClient;
}): Promise<PromotionTarget> {
    const entityType = args.entityType ?? OwnerPromotionEntityTypeEnum.ACCOMMODATION;

    if (entityType === OwnerPromotionEntityTypeEnum.VENUE) {
        if (!args.entityId) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'zodError.ownerPromotion.entityId.requiredForVenue'
            );
        }
        const venue = await args.venueModel.findById(args.entityId, args.tx);
        if (!venue || venue.deletedAt || venue.ownerId !== args.ownerId) {
            throw entityNotFoundError({ entityName: PROMOTION_ENTITY_NAME });
        }
        return { entityType, entityId: args.entityId, accommodationId: null };
    }

    const accommodationId = args.accommodationId ?? args.entityId ?? null;
    if (args.accommodationId && args.entityId && args.accommodationId !== args.entityId) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'The accommodation and the entity of a promotion must be the same listing'
        );
    }
    if (accommodationId) {
        const accommodation = await args.accommodationModel.findById(accommodationId, args.tx);
        if (!accommodation || accommodation.deletedAt || accommodation.ownerId !== args.ownerId) {
            throw entityNotFoundError({ entityName: PROMOTION_ENTITY_NAME });
        }
    }
    return { entityType, entityId: accommodationId, accommodationId };
}

/**
 * Rejects a benefit type the target does not allow: `special_offer` is venue-only,
 * `free_night` is accommodation-only.
 *
 * @param args.entityType - The promotion's target type.
 * @param args.discountType - The benefit type being written.
 * @throws {ServiceError} VALIDATION_ERROR when the type is not allowed for the target.
 */
export function assertDiscountTypeForEntity(args: {
    readonly entityType: OwnerPromotionEntityTypeEnum;
    readonly discountType: OwnerPromotionDiscountTypeEnum;
}): void {
    const permittedTypes: readonly string[] =
        args.entityType === OwnerPromotionEntityTypeEnum.VENUE
            ? VENUE_PROMOTION_DISCOUNT_TYPES
            : ACCOMMODATION_PROMOTION_DISCOUNT_TYPES;
    if (!permittedTypes.includes(args.discountType)) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            args.entityType === OwnerPromotionEntityTypeEnum.VENUE
                ? 'zodError.ownerPromotion.discountType.notForVenue'
                : 'zodError.ownerPromotion.discountType.notForAccommodation'
        );
    }
}

/**
 * Validates the benefit of a promotion about to be created: the type must suit the
 * target and a `special_offer` needs a text that passes moderation.
 *
 * @param args.entityType - The resolved target type.
 * @param args.discountType - The benefit type.
 * @param args.description - The free text (a `special_offer` keeps it here).
 * @throws {ServiceError} VALIDATION_ERROR when any rule fails.
 */
export async function assertCreateBenefit(args: {
    readonly entityType: OwnerPromotionEntityTypeEnum;
    readonly discountType: OwnerPromotionDiscountTypeEnum;
    readonly description?: string | null;
}): Promise<void> {
    assertDiscountTypeForEntity(args);
    if (args.discountType !== OwnerPromotionDiscountTypeEnum.SPECIAL_OFFER) return;
    if (!args.description) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'zodError.ownerPromotion.specialOfferText.required'
        );
    }
    await moderatePromotionText({ text: args.description });
}

/**
 * Moderates the free text of a `special_offer` with the same engine the reviews and
 * provider replies use (`@repo/content-moderation`).
 *
 * A promotion has no pending queue, so there is no "hold for review" outcome: a text
 * the engine scores at or above the PENDING threshold is refused, and so is a text
 * the engine could not judge (`degraded`): fail closed, the same stance the review
 * path takes. The refusal is a 400, never a silent edit.
 *
 * @param args.text - The offer text to judge.
 * @throws {ServiceError} VALIDATION_ERROR when the text is refused.
 */
export async function moderatePromotionText(args: { readonly text: string }): Promise<void> {
    const [verdict, thresholds] = await Promise.all([
        moderateText({ text: args.text, context: 'promotion' }),
        getThresholdForContext({ context: 'promotion' })
    ]);
    if (verdict.degraded || verdict.score >= thresholds.pending) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'zodError.ownerPromotion.specialOfferText.rejected'
        );
    }
}

/**
 * Validates an update against the promotion's stored state and returns the extra
 * columns the write must carry.
 *
 * The update contract carries neither `entityType` nor `entityId` (the target never
 * changes), so the rules that depend on them are checked here against `previous`:
 * the benefit type must suit the target, a venue promotion has no `minNights`, a
 * `special_offer` text is moderated whenever it changes, and a re-targeted
 * accommodation promotion goes through {@link resolvePromotionTarget} again and keeps
 * both target columns equal (dual write).
 *
 * @param args.previous - The stored promotion.
 * @param args.data - The partial update.
 * @param args.accommodationModel - Used to validate a new accommodation target.
 * @param args.venueModel - Passed to {@link resolvePromotionTarget}.
 * @param args.tx - Optional transaction client.
 * @returns Columns to merge into the update (empty when the target is unchanged).
 * @throws {ServiceError} VALIDATION_ERROR or NOT_FOUND, as the rule dictates.
 */
export async function validatePromotionUpdate(args: {
    readonly previous: {
        readonly ownerId: string;
        readonly entityType?: OwnerPromotionEntityTypeEnum | null;
        readonly discountType: OwnerPromotionDiscountTypeEnum;
        readonly description?: string | null;
    };
    readonly data: {
        readonly discountType?: OwnerPromotionDiscountTypeEnum;
        readonly description?: string | null;
        readonly minNights?: number | null;
        readonly accommodationId?: string | null;
    };
    readonly accommodationModel: Pick<AccommodationModel, 'findById'>;
    readonly venueModel: Pick<VenueModel, 'findById'>;
    readonly tx?: DrizzleClient;
}): Promise<{ readonly entityId?: string | null; readonly accommodationId?: string | null }> {
    const { previous, data } = args;
    const entityType = previous.entityType ?? OwnerPromotionEntityTypeEnum.ACCOMMODATION;
    const isVenue = entityType === OwnerPromotionEntityTypeEnum.VENUE;

    if (data.discountType !== undefined) {
        assertDiscountTypeForEntity({ entityType, discountType: data.discountType });
    }
    if (isVenue && data.minNights !== undefined && data.minNights !== null) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'zodError.ownerPromotion.minNights.notForVenue'
        );
    }
    if (isVenue && data.accommodationId) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'A venue promotion cannot target an accommodation'
        );
    }

    const finalType = data.discountType ?? previous.discountType;
    const textChanged = data.description !== undefined || data.discountType !== undefined;
    if (finalType === OwnerPromotionDiscountTypeEnum.SPECIAL_OFFER && textChanged) {
        const text = data.description === undefined ? previous.description : data.description;
        if (!text) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'zodError.ownerPromotion.specialOfferText.required'
            );
        }
        await moderatePromotionText({ text });
    }

    if (!isVenue && data.accommodationId !== undefined) {
        const target = await resolvePromotionTarget({
            ownerId: previous.ownerId,
            entityType: OwnerPromotionEntityTypeEnum.ACCOMMODATION,
            accommodationId: data.accommodationId,
            accommodationModel: args.accommodationModel,
            venueModel: args.venueModel,
            tx: args.tx
        });
        return { entityId: target.entityId, accommodationId: target.accommodationId };
    }
    return {};
}
