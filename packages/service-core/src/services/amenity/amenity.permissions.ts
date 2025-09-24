import type { Amenity } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils';

/**
 * Checks if the actor can create an amenity.
 * TODO: Review if a specific amenity.create permission should exist. Using ACCOMMODATION_FEATURES_EDIT as placeholder.
 */
export const checkCanCreateAmenity = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.ACCOMMODATION_FEATURES_EDIT)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing ACCOMMODATION_FEATURES_EDIT permission'
        );
    }
};

/**
 * Checks if the actor can update an amenity.
 * TODO: Review if a specific amenity.update permission should exist. Using ACCOMMODATION_FEATURES_EDIT as placeholder.
 */
export const checkCanUpdateAmenity = (actor: Actor, _amenity: Amenity): void => {
    if (!hasPermission(actor, PermissionEnum.ACCOMMODATION_FEATURES_EDIT)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing ACCOMMODATION_FEATURES_EDIT permission'
        );
    }
};

/**
 * Checks if the actor can delete an amenity.
 * TODO: Review if a specific amenity.delete permission should exist. Using ACCOMMODATION_FEATURES_EDIT as placeholder.
 */
export const checkCanDeleteAmenity = (actor: Actor, _amenity: Amenity): void => {
    if (!hasPermission(actor, PermissionEnum.ACCOMMODATION_FEATURES_EDIT)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing ACCOMMODATION_FEATURES_EDIT permission'
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
