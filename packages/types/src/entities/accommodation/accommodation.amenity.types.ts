import type {
    NewEntityInput,
    WithAdminInfo,
    WithAudit,
    WithLifecycleState,
    Writable
} from '../../common/helpers.types.js';
import type { AccommodationId, AmenityId } from '../../common/id.types.js';
import type { BasePriceType } from '../../common/price.types.js';
import type { AmenitiesTypeEnum } from '../../enums/amenity-type.enum.js';

/**
 * Generic amenity used to define a capability or service.
 */

export interface AmenityType extends WithAudit, WithLifecycleState, WithAdminInfo {
    /**
     * Unique identifier for the amenity.
     */
    id: AmenityId;
    /**
     * Unique, URL-friendly identifier for the amenity. Auto-generated from name if not provided.
     */
    slug: string;
    /**
     * Name of the amenity.
     */
    name: string;
    /**
     * Optional description of the amenity.
     */
    description?: string;
    /**
     * Optional icon for the amenity.
     */
    icon?: string;
    /**
     * Whether this amenity is built-in (system default).
     */
    isBuiltin: boolean;
    /**
     * Type/category of the amenity.
     */
    type: AmenitiesTypeEnum;
    /**
     * Whether this amenity is featured (highlighted in UI).
     */
    isFeatured: boolean;
}

/**
 * Relationship between an accommodation and an amenity
 */

export interface AccommodationAmenityType {
    accommodationId: AccommodationId;
    amenityId: AmenityId;
    isOptional: boolean;
    additionalCost?: BasePriceType;
    additionalCostPercent?: number;
    amenity?: AmenityType;
}

export type PartialAmenityType = Partial<Writable<AmenityType>>;
export type NewAmenityInputType = NewEntityInput<AmenityType>;
export type UpdateAmenityInputType = PartialAmenityType;
