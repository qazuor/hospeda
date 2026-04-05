import type { Amenity } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils';

/**
 * Checks if the actor can create an amenity.
 * Requires AMENITY_CREATE permission.
 */
export const checkCanCreateAmenity = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.AMENITY_CREATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing AMENITY_CREATE permission'
        );
    }
};

/**
 * Checks if the actor can update an amenity.
 * Requires AMENITY_UPDATE permission.
 */
export const checkCanUpdateAmenity = (actor: Actor, _amenity: Amenity): void => {
    if (!hasPermission(actor, PermissionEnum.AMENITY_UPDATE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing AMENITY_UPDATE permission'
        );
    }
};

/**
 * Checks if the actor can delete an amenity.
 * Requires AMENITY_DELETE permission.
 */
export const checkCanDeleteAmenity = (actor: Actor, _amenity: Amenity): void => {
    if (!hasPermission(actor, PermissionEnum.AMENITY_DELETE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing AMENITY_DELETE permission'
        );
    }
};

/**
 * Checks if the actor can view an amenity.
 * All users can view amenities (public).
 */
export const checkCanViewAmenity = (_actor: Actor, _amenity: Amenity): void => {
    return;
};

/**
 * Checks if the actor can list amenities.
 * All users can list amenities (public).
 */
export const checkCanListAmenities = (actor: Actor): void => {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    // Listing is allowed for any actor; results are filtered elsewhere.
    return;
};

/**
 * Checks if the actor can count amenities.
 * All users can count amenities (public).
 */
export const checkCanCountAmenities = (actor: Actor): void => {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    // Counting is allowed for any actor; results are filtered elsewhere.
    return;
};

/**
 * Checks if the actor can search amenities. All users can search amenities (public).
 */
export const checkCanSearchAmenities = (actor: Actor): void => {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'FORBIDDEN: no actor');
    // Searching is allowed for any actor; results are filtered elsewhere.
    return;
};

/**
 * Checks if the actor can get amenities for accommodation. Requires ACCOMMODATION_AMENITIES_EDIT permission.
 */
export const checkCanGetAmenitiesForAccommodation = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.ACCOMMODATION_AMENITIES_EDIT)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing ACCOMMODATION_AMENITIES_EDIT permission'
        );
    }
};

/**
 * Checks if the actor can get accommodations by amenity. Requires ACCOMMODATION_AMENITIES_EDIT permission.
 */
export const checkCanGetAccommodationsByAmenity = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.ACCOMMODATION_AMENITIES_EDIT)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing ACCOMMODATION_AMENITIES_EDIT permission'
        );
    }
};

/**
 * Checks if the actor can add an amenity to an accommodation.
 * Uses ACCOMMODATION_AMENITIES_EDIT permission.
 */
export const checkCanAddAmenityToAccommodation = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.ACCOMMODATION_AMENITIES_EDIT)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing ACCOMMODATION_AMENITIES_EDIT permission'
        );
    }
};

/**
 * Checks if the actor can remove an amenity from an accommodation.
 * Uses ACCOMMODATION_AMENITIES_EDIT permission.
 */
export const checkCanRemoveAmenityFromAccommodation = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.ACCOMMODATION_AMENITIES_EDIT)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing ACCOMMODATION_AMENITIES_EDIT permission'
        );
    }
};

/**
 * Checks if an actor has permission to admin-list this entity type.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanAdminList(actor: Actor): void {
    if (!actor || !actor.id || !hasPermission(actor, PermissionEnum.AMENITY_VIEW)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: AMENITY_VIEW required for admin list'
        );
    }
}
