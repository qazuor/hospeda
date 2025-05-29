import type {
    NewEntityInput,
    WithAdminInfo,
    WithAudit,
    WithLifecycleState,
    Writable
} from '../../common/helpers.types.js';
import type { AccommodationId, FeatureId } from '../../common/id.types.js';

/**
 * Generic feature that can be assigned to accommodations.
 */
export interface FeatureType extends WithAudit, WithLifecycleState, WithAdminInfo {
    id: FeatureId;
    name: string;
    description?: string;
    icon?: string;
    isBuiltin: boolean;
}

/**
 * Relationship between an accommodation and a feature
 */
export interface AccommodationFeatureType {
    accommodationId: AccommodationId;
    featureId: FeatureId;
    hostReWriteName?: string | null;
    comments?: string | null;
    feature?: FeatureType;
}

export type PartialFeatureType = Partial<Writable<FeatureType>>;
export type NewFeatureInputType = NewEntityInput<FeatureType>;
export type UpdateFeatureInputType = PartialFeatureType;
