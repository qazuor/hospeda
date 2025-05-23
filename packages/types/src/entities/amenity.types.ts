import type { AdminInfoType, BaseEntityType, BasePriceType } from '../common.types.js';
import type { AmenitiesTypeEnum } from '../enums.types.js';
import type { AccommodationType } from './accommodation.types.js';

/**
 * Base amenity that can be applied to accommodations
 */
export interface AmenityType extends BaseEntityType {
    description?: string;
    icon?: string;
    isBuiltin: boolean;
    type: AmenitiesTypeEnum;
}

/**
 * Relationship between an accommodation and an amenity
 */
export interface AccommodationAmenityType {
    accommodationId: string;
    accommodation?: AccommodationType;
    amenityId: string;
    amenity?: AmenityType;
    isOptional: boolean;
    additionalCost?: BasePriceType;
    additionalCostPercent?: number;
    state: string;
    adminInfo?: AdminInfoType;
}
