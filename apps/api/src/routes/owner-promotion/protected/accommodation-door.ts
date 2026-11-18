/**
 * The accommodation door of the owner-promotion routes (HOS-2270, G-5).
 *
 * `/protected/owner-promotions` is the ACCOMMODATION owner's API. A promotion that hangs
 * from a venue belongs to the venue's own routes (`/protected/venues/{id}/promotions`),
 * so here it does not exist: one door per vertical, each answering 404 for the other's
 * rows. The 404 carries the service's own not-found message, byte-identical to a
 * promotion that really does not exist.
 *
 * @module routes/owner-promotion/protected/accommodation-door
 */
import { OwnerPromotionEntityTypeEnum, ServiceErrorCode } from '@repo/schemas';
import { entityNotFoundError, ServiceError } from '@repo/service-core';

/**
 * Throws `NOT_FOUND` when the promotion hangs from a venue.
 *
 * @param promotion - The promotion read by the route (`entityType` is all that is looked at).
 * @throws {ServiceError} NOT_FOUND for a venue promotion.
 */
export function assertAccommodationPromotion(
    promotion: { readonly entityType?: string | null } | null | undefined
): void {
    if (promotion?.entityType === OwnerPromotionEntityTypeEnum.VENUE) {
        const error = entityNotFoundError({ entityName: 'ownerPromotion' });
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, error.message);
    }
}
