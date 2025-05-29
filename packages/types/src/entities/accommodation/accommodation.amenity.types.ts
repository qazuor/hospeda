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
    id: AmenityId;
    name: string;
    description?: string;
    icon?: string;
    isBuiltin: boolean;
    type: AmenitiesTypeEnum;
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
