import type {
    WithActivityState,
    WithAdminInfo,
    WithAudit,
    WithId,
    WithLifecycleState,
    WithSoftDelete
} from '@repo/types/common/helpers.types.js';
import type { AmenitiesTypeEnum } from '@repo/types/enums/amenity-type.enum.js';
import type { AccommodationId, AmenityId } from '../../common/id.types.js';
import type { BasePriceType } from '../../common/price.types.js';

/**
 * Generic amenity used to define a capability or service.
 */

export interface AmenityType
    extends WithId,
        WithAudit,
        WithLifecycleState,
        WithSoftDelete,
        WithAdminInfo {
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

export interface AccommodationAmenityType extends WithActivityState, WithAdminInfo {
    accommodationId: AccommodationId;
    amenityId: AmenityId;
    isOptional: boolean;
    additionalCost?: BasePriceType;
    additionalCostPercent?: number;
    amenity?: AmenityType;
}
