import type { Feature } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils';

/**
 * Checks if the actor can create a feature.
 */
export const checkCanCreateFeature = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.ACCOMMODATION_FEATURES_EDIT)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing ACCOMMODATION_FEATURES_EDIT permission'
        );
    }
};

/**
 * Checks if the actor can update a feature.
 */
export const checkCanUpdateFeature = (actor: Actor, _feature: Feature): void => {
    if (!hasPermission(actor, PermissionEnum.ACCOMMODATION_FEATURES_EDIT)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing ACCOMMODATION_FEATURES_EDIT permission'
        );
    }
};

/**
 * Checks if the actor can delete a feature.
 */
export const checkCanDeleteFeature = (actor: Actor, _feature: Feature): void => {
    if (!hasPermission(actor, PermissionEnum.ACCOMMODATION_FEATURES_EDIT)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing ACCOMMODATION_FEATURES_EDIT permission'
        );
    }
};

/**
 * Checks if the actor can view a feature. All users can view features (public).
 */
export const checkCanViewFeature = (_actor: Actor, _feature: Feature): void => {
    return;
};

/**
 * Checks if the actor can list features. Requires ACCOMMODATION_FEATURES_EDIT permission.
 */
export const checkCanListFeatures = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.ACCOMMODATION_FEATURES_EDIT)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing ACCOMMODATION_FEATURES_EDIT permission'
        );
    }
};

/**
 * Checks if the actor can count features. Requires ACCOMMODATION_FEATURES_EDIT permission.
 */
export const checkCanCountFeatures = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.ACCOMMODATION_FEATURES_EDIT)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing ACCOMMODATION_FEATURES_EDIT permission'
        );
    }
};

/**
 * Checks if the actor can add a feature to an accommodation.
 * Uses ACCOMMODATION_FEATURES_EDIT permission.
 */
export const checkCanAddFeatureToAccommodation = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.ACCOMMODATION_FEATURES_EDIT)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing ACCOMMODATION_FEATURES_EDIT permission'
        );
    }
};

/**
 * Checks if the actor can remove a feature from an accommodation.
 * Uses ACCOMMODATION_FEATURES_EDIT permission.
 */
export const checkCanRemoveFeatureFromAccommodation = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.ACCOMMODATION_FEATURES_EDIT)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing ACCOMMODATION_FEATURES_EDIT permission'
        );
    }
};

/**
 * Checks if the actor can search features. Requires ACCOMMODATION_FEATURES_EDIT permission.
 */
export const checkCanSearchFeatures = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.ACCOMMODATION_FEATURES_EDIT)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing ACCOMMODATION_FEATURES_EDIT permission'
        );
    }
};

/**
 * Checks if the actor can get features for an accommodation. Requires ACCOMMODATION_FEATURES_EDIT permission.
 */
export const checkCanGetFeaturesForAccommodation = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.ACCOMMODATION_FEATURES_EDIT)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing ACCOMMODATION_FEATURES_EDIT permission'
        );
    }
};

/**
 * Checks if the actor can get accommodations by feature. Requires ACCOMMODATION_FEATURES_EDIT permission.
 */
export const checkCanGetAccommodationsByFeature = (actor: Actor): void => {
    if (!hasPermission(actor, PermissionEnum.ACCOMMODATION_FEATURES_EDIT)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Forbidden: missing ACCOMMODATION_FEATURES_EDIT permission'
        );
    }
};
