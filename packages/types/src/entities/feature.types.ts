import type { AdminInfoType, BaseEntityType } from '../common.types';
import type { AccommodationType } from './accommodation.types';

/**
 * Base feature that can be applied to accommodations
 */
export interface FeatureType extends BaseEntityType {
    description?: string;
    icon?: string;
    isBuiltin: boolean;
}

/**
 * Relationship between an accommodation and a feature
 */
export interface AccommodationFeatureType {
    accommodationId: string;
    accommodation?: AccommodationType;
    featureId: string;
    feature?: FeatureType;
    hostReWriteName?: string | null;
    comments?: string | null;
    state: string;
    adminInfo?: AdminInfoType;
}
